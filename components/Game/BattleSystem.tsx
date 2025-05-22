import { useState, useEffect, useCallback } from 'react';
import { parseEther, formatEther, Hex, parseGwei } from 'viem';
import { publicClient } from '@/utils/publicClient';
import { 
  isOnCooldown, 
  getCooldownRemaining, 
  formatCooldownTime, 
  startCooldown, 
  calculateAttackTime,
  normalizeRarity,
  resetAllCooldowns
} from '@/lib/cooldownManager';
import { useRouter } from 'next/navigation';

// Define interfaces for component props and state
interface BattleSystemProps {
  walletAddress: string;
  walletClient: any;
  inventory: any[];
  onShowToast: (message: string) => void;
  onBattleComplete: (txHash: string) => void;
}

interface GroupedInventory {
  [key: string]: {
    count: number;
    items: any[];
  }
}

// Random boss selection
const BOSS_IMAGES = ['/boss/boss1.gif', '/boss/boss2.gif', '/boss/boss3.gif'];

export default function BattleSystem({
  walletAddress,
  walletClient,
  inventory,
  onShowToast,
  onBattleComplete,
}: BattleSystemProps) {
  // Battle state
  const [selectedRarity, setSelectedRarity] = useState<string | null>(null);
  const [attackTimeRemaining, setAttackTimeRemaining] = useState<number>(0);
  const [initialAttackTime, setInitialAttackTime] = useState<number>(0);
  const [isAttacking, setIsAttacking] = useState<boolean>(false);
  const [attackTimerId, setAttackTimerId] = useState<NodeJS.Timeout | null>(null);
  const [battleState, setBattleState] = useState<'selection' | 'battle' | 'results'>('selection');
  const [cooldownRefreshCounter, setCooldownRefreshCounter] = useState<number>(0);
  const [selectedBossImage, setSelectedBossImage] = useState<string>(BOSS_IMAGES[0]);
  const [isBattleStarted, setIsBattleStarted] = useState<boolean>(false);
  const [attacksPerformed, setAttacksPerformed] = useState<number>(0);
  const [bossHealth, setBossHealth] = useState<number>(100);
  
  // Group inventory by rarity
  const groupedInventory = inventory.reduce<GroupedInventory>((acc, item) => {
    const rarity = item.rarity.toLowerCase().replace(/\s+/g, '');
    const rarityKey = rarity === 'ultrarare' ? 'ultraRare' : rarity;
    
    if (!acc[rarityKey]) {
      acc[rarityKey] = {
        count: 0,
        items: []
      };
    }
    
    acc[rarityKey].count += 1;
    acc[rarityKey].items.push(item);
    return acc;
  }, {});
  
  // Debug logging for inventory
  useEffect(() => {
    if (inventory && inventory.length > 0) {
      console.log(`BattleSystem: Received ${inventory.length} inventory items`);
      console.log("Inventory first few items:", inventory.slice(0, 3));
      console.log("Grouped inventory:", groupedInventory);
    } else {
      console.log("BattleSystem: No inventory items received yet");
    }
  }, [inventory, groupedInventory]);
  
  // Get list of available rarities (not on cooldown)
  const availableRarities = Object.keys(groupedInventory).filter(rarity => 
    !isOnCooldown(rarity)
  );
  
  // Get cooldown information for all rarities
  const cooldownInfo = Object.keys(groupedInventory).map(rarity => {
    const remaining = getCooldownRemaining(rarity);
    const formattedTime = formatCooldownTime(remaining);
    return {
      rarity,
      count: groupedInventory[rarity].count,
      isOnCooldown: remaining > 0,
      cooldownRemaining: remaining,
      formattedTime
    };
  });
  
  // Update cooldowns every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCooldownRefreshCounter(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  // Random boss selection when starting battle
  useEffect(() => {
    if (battleState === 'battle' && !isBattleStarted) {
      const randomBoss = BOSS_IMAGES[Math.floor(Math.random() * BOSS_IMAGES.length)];
      setSelectedBossImage(randomBoss);
      setIsBattleStarted(true);
    }
  }, [battleState, isBattleStarted]);
  
  // Handle attack timer
  useEffect(() => {
    if (attackTimeRemaining > 0 && battleState === 'battle') {
      const timer = setTimeout(() => {
        setAttackTimeRemaining(prevTime => prevTime - 1);
        
        // Update boss health proportionally to timer
        if (isBattleStarted && initialAttackTime > 0) {
          // Calculate new health based on remaining time percentage
          const healthPercentage = Math.max(0, Math.ceil((attackTimeRemaining - 1) / initialAttackTime * 100));
          setBossHealth(healthPercentage);
          
          // End battle if timer reaches zero
          if (attackTimeRemaining === 1) {
            // This will execute when timer hits zero on next tick
            setTimeout(() => {
              if (battleState === 'battle') {
                handleBattleComplete();
              }
            }, 1000);
          }
        }
      }, 1000);
      
      setAttackTimerId(timer);
      return () => clearTimeout(timer);
    }
    
    return undefined;
  }, [attackTimeRemaining, battleState, isBattleStarted, initialAttackTime]);
  
  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (attackTimerId) {
        clearTimeout(attackTimerId);
      }
    };
  }, [attackTimerId]);
  
  // Start battle with selected rarity
  const startBattle = useCallback(() => {
    if (!selectedRarity || !groupedInventory[selectedRarity]) {
      onShowToast('Please select a rarity first');
      return;
    }
    
    // Calculate attack time based on rarity and count
    const count = groupedInventory[selectedRarity].count;
    const attackTime = calculateAttackTime(selectedRarity, count);
    
    setAttackTimeRemaining(attackTime);
    setInitialAttackTime(attackTime);
    setBattleState('battle');
    setIsBattleStarted(false);
    setBossHealth(100); // Reset boss health to 100%
    setAttacksPerformed(0); // Reset attacks performed
  }, [selectedRarity, groupedInventory, onShowToast]);
  
  // Handle rarity selection
  const selectRarity = useCallback((rarity: string) => {
    if (isOnCooldown(rarity)) {
      onShowToast(`${rarity} is on cooldown!`);
      return;
    }
    
    setSelectedRarity(rarity);
  }, [onShowToast]);
  
  // Handle attack button press
  const handleAttack = useCallback(async () => {
    if (!walletAddress || !walletClient || !selectedRarity || attackTimeRemaining <= 0) {
      onShowToast('No wallet or rarity selected or battle time has ended');
      return;
    }
    
    setIsAttacking(true);
    
    try {
      // Get current nonce
      let nonce = 0;
      try {
        nonce = await publicClient.getTransactionCount({ 
          address: walletAddress as Hex 
        });
      } catch (nonceError) {
        console.error("Error getting nonce:", nonceError);
        throw new Error("Failed to get transaction nonce");
      }
      
      // Sign the transaction
      const signedTransaction = await walletClient.signTransaction({
        to: walletAddress as Hex,
        account: walletAddress as Hex,
        value: parseEther("0.00001"),
        nonce,
        gas: BigInt(21000),
        maxFeePerGas: parseGwei("50"),
        maxPriorityFeePerGas: parseGwei("5"),
      });
      
      // Send the transaction
      const hash = await publicClient.sendRawTransaction({
        serializedTransaction: signedTransaction
      });
      
      // Record that an attack was performed
      setAttacksPerformed(prev => prev + 1);
      
      // Damage the boss but don't defeat it
      const damageAmount = Math.min(bossHealth, 20); // 20% damage per attack, can't go below 0
      const newHealth = Math.max(0, bossHealth - damageAmount);
      setBossHealth(newHealth);
      
      // Show attack success
      onShowToast(`Attack successful! Boss health: ${newHealth}%`);
      onBattleComplete(hash);
      
    } catch (error) {
      console.error("Attack failed:", error);
      onShowToast(`Attack failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAttacking(false);
    }
  }, [walletAddress, walletClient, selectedRarity, bossHealth, attackTimeRemaining, onShowToast, onBattleComplete]);
  
  // End battle and set cooldown
  const endBattle = useCallback((hash: string) => {
    if (!selectedRarity) return;
    
    // Start cooldown for this rarity
    startCooldown(selectedRarity);
    
    // Clear timer
    if (attackTimerId) {
      clearTimeout(attackTimerId);
    }
    
    // Show success and move to results
    onShowToast('Battle complete! Boss defeated!');
    onBattleComplete(hash);
    setBattleState('results');
    setBossHealth(0);
  }, [selectedRarity, attackTimerId, onShowToast, onBattleComplete]);
  
  // Handle battle completion (when timer runs out)
  const handleBattleComplete = useCallback(async () => {
    if (!walletAddress || !walletClient || !selectedRarity) {
      onShowToast('No wallet or rarity selected');
      return;
    }
    
    setIsAttacking(true);
    
    try {
      // Get current nonce
      let nonce = 0;
      try {
        nonce = await publicClient.getTransactionCount({ 
          address: walletAddress as Hex 
        });
      } catch (nonceError) {
        console.error("Error getting nonce:", nonceError);
        throw new Error("Failed to get transaction nonce");
      }
      
      // Sign the transaction
      const signedTransaction = await walletClient.signTransaction({
        to: walletAddress as Hex,
        account: walletAddress as Hex,
        value: parseEther("0.00001"),
        nonce,
        gas: BigInt(21000),
        maxFeePerGas: parseGwei("50"),
        maxPriorityFeePerGas: parseGwei("5"),
      });
      
      // Send the transaction
      const hash = await publicClient.sendRawTransaction({
        serializedTransaction: signedTransaction
      });
      
      // End the battle (this happens when timer runs out)
      endBattle(hash);
      
    } catch (error) {
      console.error("Battle completion failed:", error);
      onShowToast(`Failed to complete battle: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAttacking(false);
    }
  }, [walletAddress, walletClient, selectedRarity, endBattle]);
  
  // Reset battle system
  const resetBattle = useCallback(() => {
    setSelectedRarity(null);
    setAttackTimeRemaining(0);
    setInitialAttackTime(0);
    setBattleState('selection');
    setIsBattleStarted(false);
    setAttacksPerformed(0);
    setBossHealth(100);
    if (attackTimerId) {
      clearTimeout(attackTimerId);
    }
  }, [attackTimerId]);
  
  // Reset all cooldowns (for testing)
  const handleResetCooldowns = useCallback(() => {
    resetAllCooldowns();
    onShowToast('All cooldowns have been reset for testing');
    setCooldownRefreshCounter(prev => prev + 1); // Force refresh
  }, [onShowToast]);
  
  // Debug refresh button - hard reload the page
  const handleDebugRefresh = useCallback(() => {
    window.location.reload();
  }, []);
  
  // Get rarity color class based on rarity
  const getRarityColorClass = (rarity: string): string => {
    const lowerRarity = rarity.toLowerCase();
    if (lowerRarity === 'common') return 'text-gray-200';
    if (lowerRarity === 'uncommon') return 'text-green-400';
    if (lowerRarity === 'epic') return 'text-purple-400';
    if (lowerRarity === 'legendary') return 'text-yellow-400';
    if (lowerRarity === 'ultrarare') return 'text-red-400';
    return 'text-white';
  };
  
  // Character Selection Screen
  if (battleState === 'selection') {
    // Debug information
    console.log("Inventory length:", inventory?.length);
    console.log("Grouped inventory:", groupedInventory);
    console.log("Cooldown info:", cooldownInfo);
    
    return (
      <div className="ro-window w-full max-w-md mx-auto mt-6">
        <div className="ro-window-header text-center py-2 bg-[var(--ro-bg-dark)]">
          <h2 className="text-lg font-pixel text-[var(--ro-gold)]">SELECT YOUR ELEMENTAL</h2>
        </div>
        <div className="p-4">
          {inventory.length === 0 ? (
            <div className="text-center p-4">
              <p className="text-yellow-500 mb-3">You don't have any Elementals yet!</p>
              <p className="text-sm mb-4">Get some by hatching them in the main game</p>
              <button 
                onClick={() => window.location.href = '/'}
                className="ro-button py-2 px-4"
              >
                Go to Main Game
              </button>
            </div>
          ) : (
            <>
              <div className="text-center mb-4">
                <p className="text-yellow-400 mb-2">Choose your Elemental by rarity tier</p>
                <p className="text-xs text-gray-400">
                  Each rarity has its own cooldown timer. After use, you'll need to wait before using that rarity again.
                </p>
                
                {/* Test Button - will be removed later */}
                <button 
                  onClick={handleResetCooldowns}
                  className="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-xs rounded text-white"
                >
                  Reset All Cooldowns (Testing)
                </button>
              </div>
              
              {/* Rarity Cards */}
              <div className="grid gap-3 mb-4">
                {cooldownInfo
                  .sort((a, b) => {
                    // Custom sort order: Common first, then others
                    const order = {
                      common: 1,
                      uncommon: 2,
                      epic: 3,
                      legendary: 4,
                      ultraRare: 5
                    };
                    return (order[a.rarity as keyof typeof order] || 99) - (order[b.rarity as keyof typeof order] || 99);
                  })
                  .map(info => (
                  <div 
                    key={info.rarity}
                    className={`border rounded-md p-3 cursor-pointer transition-all ${
                      selectedRarity === info.rarity ? 'border-yellow-400 bg-gray-800' : 'border-gray-700 bg-gray-900'
                    } ${info.isOnCooldown ? 'opacity-50' : 'hover:border-yellow-300'}`}
                    onClick={() => !info.isOnCooldown && selectRarity(info.rarity)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className={`font-pixel text-lg capitalize ${getRarityColorClass(info.rarity)}`}>
                          {info.rarity === 'ultraRare' ? 'Ultra Rare' : info.rarity}
                        </h3>
                        <p className="text-sm text-gray-400">
                          {info.count} {info.count === 1 ? 'Elemental' : 'Elementals'}
                        </p>
                        <p className="text-xs text-yellow-300 mt-1">
                          Attack Time: {calculateAttackTime(info.rarity, info.count)}s
                        </p>
                      </div>
                      
                      {info.isOnCooldown ? (
                        <div className="bg-gray-800 rounded-md py-1 px-2">
                          <p className="text-red-400 text-xs">On Cooldown</p>
                          <p className="text-red-300 text-xs">{info.formattedTime}</p>
                        </div>
                      ) : (
                        <div className="bg-gray-800 rounded-md py-1 px-2">
                          <p className="text-green-400 text-xs">Ready</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {cooldownInfo.length === 0 && (
                  <p className="text-center text-gray-400 py-4">No elementals found</p>
                )}
              </div>
              
              {/* Battle Button */}
              <button
                onClick={startBattle}
                disabled={!selectedRarity}
                className={`w-full py-3 font-pixel text-lg ${
                  selectedRarity 
                    ? 'ro-button bg-red-700 hover:bg-red-600' 
                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
              >
                {selectedRarity ? 'START BATTLE' : 'SELECT A RARITY'}
              </button>
              
              {/* Help Text */}
              <div className="mt-4 text-center">
                <p className="text-xs text-gray-500">
                  Base time × number of NFTs = your battle window
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Attack to damage the boss (20% per attack)
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Battle automatically ends when timer expires
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  After battle, the rarity goes on cooldown for 4 hours
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
  
  // Battle Screen
  if (battleState === 'battle') {
    return (
      <div className="ro-window w-full max-w-md mx-auto mt-6">
        <div className="ro-window-header text-center py-2 bg-[var(--ro-bg-dark)]">
          <h2 className="text-lg font-pixel text-red-400">BATTLE IN PROGRESS</h2>
        </div>
        <div className="p-4">
          <div className="text-center mb-4">
            <p className="text-lg text-yellow-400 mb-2">
              {selectedRarity && (
                <span className={`font-pixel ${getRarityColorClass(selectedRarity)}`}>
                  {selectedRarity === 'ultraRare' ? 'Ultra Rare' : selectedRarity.charAt(0).toUpperCase() + selectedRarity.slice(1)}
                </span>
              )} Elemental
            </p>
            <p className="text-sm text-gray-400">
              Time remaining: <span className="text-yellow-300">{attackTimeRemaining}s</span>
            </p>
            <p className="text-sm text-white mt-2">
              Attack to damage boss! Battle ends when timer expires
            </p>
          </div>
          
          {/* Boss Health Bar */}
          <div className="w-full bg-gray-700 h-4 rounded-full mb-2">
            <div 
              className="bg-red-600 h-full rounded-full transition-all duration-300" 
              style={{ width: `${bossHealth}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-xs mb-4">
            <span>Boss Health: {bossHealth}%</span>
            <span>Attacks: {attacksPerformed}</span>
          </div>
          
          <div className="flex justify-center my-4">
            <div className="border-2 border-gray-700 rounded-md overflow-hidden w-48 h-48">
              <img 
                src={selectedBossImage} 
                alt="Boss"
                className="w-full h-full object-contain pixelated"
              />
            </div>
          </div>
          
          <div className="text-center mb-6">
            <h3 className="text-red-400 font-pixel mb-1">BOSS BATTLE</h3>
          </div>
          
          {/* Attack Button */}
          <button
            onClick={handleAttack}
            disabled={isAttacking || attackTimeRemaining <= 0}
            className={`w-full py-3 ro-button ${
              attackTimeRemaining <= 0 
                ? 'bg-gray-700 cursor-not-allowed' 
                : isAttacking 
                  ? 'bg-red-800' 
                  : 'bg-red-700 hover:bg-red-600'
            } font-pixel text-lg`}
          >
            {isAttacking 
              ? 'ATTACKING...' 
              : attackTimeRemaining <= 0 
                ? 'TIME EXPIRED' 
                : 'ATTACK!'}
          </button>
          
          {/* Escape Button */}
          <button
            onClick={resetBattle}
            className="w-full py-2 mt-3 bg-gray-800 text-gray-300 hover:bg-gray-700 font-pixel"
          >
            ESCAPE (FORFEIT)
          </button>
        </div>
      </div>
    );
  }
  
  // Results Screen
  return (
    <div className="ro-window w-full max-w-md mx-auto mt-6">
      <div className="ro-window-header text-center py-2 bg-[var(--ro-bg-dark)]">
        <h2 className="text-lg font-pixel text-[var(--ro-gold)]">BATTLE RESULTS</h2>
      </div>
      <div className="p-4 text-center">
        <p className="text-xl text-yellow-400 mb-3">Battle Complete!</p>
        
        {/* Battle Stats */}
        <div className="mb-3 bg-gray-800 rounded-lg p-3">
          {bossHealth <= 0 ? (
            <p className="text-green-400 font-pixel mb-2">Boss Defeated!</p>
          ) : (
            <p className="text-orange-400 font-pixel mb-2">Battle Time Expired!</p>
          )}
          <div className="flex justify-between text-xs mb-2">
            <span>Total Attacks:</span>
            <span className="text-yellow-300">{attacksPerformed}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span>Damage Dealt:</span>
            <span className="text-red-400">{Math.min(attacksPerformed * 20, 100)}%</span>
          </div>
          <div className="flex justify-between text-xs mt-2">
            <span>Boss Health:</span>
            <span className={`${bossHealth <= 0 ? 'text-green-400' : 'text-red-400'}`}>{bossHealth}%</span>
          </div>
        </div>
        
        {selectedRarity && (
          <div className="mb-4">
            <p className="text-sm text-gray-300 mb-1">
              Your <span className={`font-pixel ${getRarityColorClass(selectedRarity)}`}>
                {selectedRarity === 'ultraRare' ? 'Ultra Rare' : selectedRarity.charAt(0).toUpperCase() + selectedRarity.slice(1)}
              </span> Elemental is now on cooldown
            </p>
            <p className="text-xs text-gray-500">
              You can use it again in 4 hours
            </p>
          </div>
        )}
        
        <div className="flex justify-center my-4">
          <div className="border-2 border-gray-700 rounded-md overflow-hidden w-32 h-32">
            <img 
              src={selectedBossImage} 
              alt="Boss"
              className="w-full h-full object-contain pixelated"
            />
          </div>
        </div>
        
        {/* Result Message */}
        <p className="text-sm text-gray-300 mb-4">
          {bossHealth <= 0
            ? "The boss was defeated before time ran out! Well done!"
            : "Remember: Even with maximum attacks, you must wait for the timer to end."}
        </p>
        
        <div className="flex flex-col gap-3 mt-6">
          <button
            onClick={resetBattle}
            className="w-full py-3 ro-button bg-yellow-700 hover:bg-yellow-600 font-pixel"
          >
            BATTLE AGAIN
          </button>
          
          <button
            onClick={resetBattle}
            className="w-full py-2 bg-gray-800 text-gray-300 hover:bg-gray-700 font-pixel"
          >
            RETURN TO SELECTION
          </button>
        </div>
      </div>
    </div>
  );
} 