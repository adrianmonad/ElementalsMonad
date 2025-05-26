import { useState, useEffect } from "react";
import { parseEther } from "viem";
import { monadTestnet } from "viem/chains";
import {
  useAccount,
  useWriteContract,
  useSwitchChain,
  useConnect,
  useDisconnect,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { farcasterFrame } from "@farcaster/frame-wagmi-connector";
import ElementalHatcherABI from "@/abi/ElementalHatcherRandom.json";
import { getElementalGif, getElementalName, getRarityTier, createElementalShareMessage } from "@/lib/elementals";
import { useMiniAppContext } from "@/hooks/use-miniapp-context";
import { useRouter } from "next/navigation";

// Use proper typing for the contract address with `0x${string}` format
const HATCHER_CONTRACT = "0x13712F7026faDb5299d3b04f687244EC1bc9252c" as `0x${string}`;
const MONAD_TESTNET_ID = 10143;

// Increased gas limit to 5 million (5x the original)
const GAS_LIMIT = BigInt(5000000);

// Higher gas limit for retry (8 million)
const HIGHER_GAS_LIMIT = BigInt(8000000);

type GameStep = "start" | "hatch" | "adventure";

// Before the GameFlow component definition, add this helper function
function isGasRelatedError(errorMessage: string | undefined): boolean {
  if (!errorMessage) return false;
  
  const gasErrorTerms = [
    'gas',
    'out of gas',
    'exceeds gas limit',
    'intrinsic gas',
    'insufficient funds',
    'underpriced',
    'transaction reverted'
  ];
  
  return gasErrorTerms.some(term => 
    errorMessage.toLowerCase().includes(term.toLowerCase())
  );
}

export function GameFlow() {
  const [gameStep, setGameStep] = useState<GameStep>("start");
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [txHash, setTxHash] = useState<string>("");
  const [hatchedTokenId, setHatchedTokenId] = useState<number | null>(null);
  
  // Add a new state variable for higher gas retry
  const [useHigherGas, setUseHigherGas] = useState(false);

  const { isConnected, address, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { connect } = useConnect();
  const { actions } = useMiniAppContext();
  const router = useRouter();
  
  // Listen for reset events from parent component
  useEffect(() => {
    function handleResetGameFlow(event: Event) {
      const customEvent = event as CustomEvent;
      if (customEvent.detail && customEvent.detail.reset) {
        // Reset game state
        setGameStep("start");
        setDebugInfo("");
        setTxHash("");
        setHatchedTokenId(null);
        setUseHigherGas(false);
        reset(); // Reset any previous transaction state
      }
    }
    
    window.addEventListener('resetGameFlow', handleResetGameFlow);
    return () => {
      window.removeEventListener('resetGameFlow', handleResetGameFlow);
    };
  }, []);
  
  // Emit game state changes to parent component
  useEffect(() => {
    // Dispatch event to notify parent component about game state changes
    window.dispatchEvent(new CustomEvent('gameStateChange', { 
      detail: { gameStep }
    }));
  }, [gameStep]);
  
  const { 
    data: hash, 
    writeContract, 
    isPending, 
    isSuccess, 
    isError, 
    error,
    reset 
  } = useWriteContract();
  
  const { data: txReceipt, isLoading: isWaitingForTx, error: txError } = useWaitForTransactionReceipt({
    hash,
    confirmations: 1,
  });
  
  // Read available tokens
  const { data: availableTokens } = useReadContract({
    address: HATCHER_CONTRACT,
    abi: ElementalHatcherABI,
    functionName: 'getAvailableTokenCount',
    // Only attempt to read if connected and on the right chain
    query: {
      enabled: Boolean(isConnected && chainId === MONAD_TESTNET_ID),
    },
  });
  
  // Read claimed tokens
  const { data: claimedTokens } = useReadContract({
    address: HATCHER_CONTRACT,
    abi: ElementalHatcherABI,
    functionName: 'getClaimedTokenCount',
    // Only attempt to read if connected and on the right chain
    query: {
      enabled: Boolean(isConnected && chainId === MONAD_TESTNET_ID),
    },
  });

  // Read the treasury's actual NFT balance
  const NFT_CONTRACT = "0x8549FaF1d5553dB17C9c6154141e5357758006cC" as `0x${string}`;
  const TREASURY_ADDRESS = "0x20ce27B140A0EEECceF880e01D2082558400FDd6" as `0x${string}`;
  
  const { data: treasuryBalance } = useReadContract({
    address: NFT_CONTRACT,
    abi: [
      {
        "inputs": [{"internalType": "address", "name": "owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
      }
    ],
    functionName: 'balanceOf',
    args: [TREASURY_ADDRESS],
    query: {
      enabled: Boolean(isConnected && chainId === MONAD_TESTNET_ID),
    },
  });

  // Display debug info when error occurs
  useEffect(() => {
    if (error) {
      let errorMsg = `Error: ${error.message}\n`;
      errorMsg += `Chain ID: ${chainId}\n`;
      errorMsg += `Address: ${address}\n`;
      
      // Add more detailed error information if available
      if ('details' in error) {
        errorMsg += `Details: ${(error as any).details}\n`;
      }
      
      setDebugInfo(errorMsg);
    }
  }, [error, chainId, address]);
  
  // Handle transaction errors
  useEffect(() => {
    if (txError) {
      setDebugInfo(prev => `${prev}\nTransaction Error: ${txError.message}`);
    }
  }, [txError]);
  
  // Reset state when transaction is successful and extract tokenId
  useEffect(() => {
    if (isSuccess && hash) {
      setTxHash(hash);
      
      if (txReceipt && !isWaitingForTx) {
        // Transaction is confirmed - extract tokenId from logs
        try {
          // Find the AdventurerClaimed event in logs
          // The event signature hash for AdventurerClaimed(address,uint256)
          const eventSignature = "0x1698438c124846665bf3551d426f46fe4b8ff030ccfe14512b94a62c7f3519fd";
          
          // Look for the event in the logs
          const claimEvent = txReceipt.logs && txReceipt.logs.find(log => 
            log.topics && log.topics[0] && log.topics[0].toLowerCase() === eventSignature.toLowerCase()
          );
          
          if (claimEvent && claimEvent.topics && claimEvent.topics.length >= 3) {
            // Topic[2] contains the tokenId (in hex)
            const tokenIdHex = claimEvent.topics[2];
            // Parse the hex value to a decimal integer
            const tokenId = parseInt(tokenIdHex || '0', 16);
            setHatchedTokenId(tokenId);
            
            const elementalName = getElementalName(tokenId);
            const rarityTier = getRarityTier(tokenId);
            
            // No need to save to localStorage anymore since we're using on-chain data
            
            setDebugInfo(`Success! You hatched a ${rarityTier} ${elementalName} (Token #${tokenId}).`);
          } else {
            setDebugInfo(`Transaction confirmed! Token has been minted to your wallet.`);
          }
        } catch (e) {
          console.error("Failed to extract tokenId from logs:", e);
          setDebugInfo(`Transaction confirmed! Token has been minted to your wallet.`);
        }
      } else {
        setDebugInfo(`Transaction sent with hash: ${hash}\nWaiting for confirmation...`);
      }
    }
  }, [isSuccess, hash, txReceipt, isWaitingForTx]);

  function startGame() {
    reset(); // Reset any previous transaction state
    setDebugInfo(""); // Clear debug info
    setTxHash(""); // Clear transaction hash
    setHatchedTokenId(null); // Clear any previous hatched token
    setGameStep("hatch");
  }

  async function claimAdventurerHandler() {
    try {
      // Clear previous debug info
      setDebugInfo("");
      setTxHash("");
      setHatchedTokenId(null);
      
      // Check if wallet is connected
      if (!isConnected) {
        setDebugInfo("Wallet not connected");
        return;
      }
      
      // Check if on correct chain - use the chainId from useAccount hook
      if (chainId !== MONAD_TESTNET_ID) {
        setDebugInfo(`Wrong network. Expected ${MONAD_TESTNET_ID}, got ${chainId}`);
        try {
          await switchChain({ chainId: MONAD_TESTNET_ID });
          return;
        } catch (e) {
          setDebugInfo(`Failed to switch chain: ${e instanceof Error ? e.message : String(e)}`);
          return;
        }
      }
      
      // Choose the appropriate gas limit based on whether we're retrying with higher gas
      const currentGasLimit = useHigherGas ? HIGHER_GAS_LIMIT : GAS_LIMIT;
      
      // Build transaction parameters compatible with wagmi v2
      const txParams = {
        address: HATCHER_CONTRACT,
        abi: ElementalHatcherABI,
        functionName: 'claimAdventurer',
        value: parseEther("0.1"),
        // Use gas option for wagmi v2
        gas: currentGasLimit
      };
      
      setDebugInfo(`Sending transaction with params:\nContract: ${txParams.address}\nValue: 0.1 MONAD\nGas: ${currentGasLimit.toString()}${useHigherGas ? " (Increased)" : ""}`);
      
      // Reset the higher gas flag after using it
      if (useHigherGas) {
        setUseHigherGas(false);
      }
      
      // Call the contract with wagmi v2 format
      writeContract(txParams);
    } catch (e) {
      setDebugInfo(`Unexpected error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function continueToAdventure() {
    setGameStep("adventure");
  }

  // Function to navigate to inventory
  function viewInventory() {
    // Dispatch a custom event to navigate to inventory
    window.dispatchEvent(new CustomEvent('navigate', { 
      detail: { page: 'inventory' }
    }));
  }

  function shareOnFarcaster() {
    if (hatchedTokenId && actions?.composeCast) {
      const shareMessage = createElementalShareMessage(hatchedTokenId);
      const elementalImage = getElementalGif(hatchedTokenId);
      
      actions.composeCast({
        text: shareMessage,
        embeds: [`${window.location.origin}${elementalImage}`],
      });
    }
  }

  // Render different game steps
  if (gameStep === "start") {
    return (
      <div className="p-4 game-panel">
        <div className="flex flex-col items-center justify-center">
          <div className="mb-4 text-center">
            <h2 className="text-xl font-pixel text-yellow-400 mb-3">
              BEGIN YOUR QUEST
            </h2>
            <p className="text-sm mb-4 text-yellow-400">Embark on an adventure in the Elementals universe!</p>
          </div>
          
          <div className="flex justify-center">
            <button
              className="game-button flex items-center justify-center py-3 px-6 bg-[var(--game-panel-bg)] hover:bg-[#2a2a5a]"
              onClick={startGame}
            >
              <span className="mr-2">🔮</span>
              START ADVENTURE
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameStep === "hatch") {
    return (
      <div className="pt-6 pb-4 px-4 game-panel">
        <div className="flex flex-col items-center justify-center">
          <div className="mb-3 text-center">
            <h2 className="text-xl font-pixel text-[var(--ro-gold)] mb-1">
              {hatchedTokenId ? "ELEMENTAL HATCHED!" : "HATCH AN ELEMENTAL"}
            </h2>
            <p className="text-sm mb-2 text-[var(--ro-gold)]">
              {hatchedTokenId ? "Your new companion has arrived!" : "Summon a mystical Elemental companion!"}
            </p>
            
            {/* Add eggs.gif - ONLY show when no elemental has been hatched yet */}
            {!hatchedTokenId && (
              <div className="flex justify-center mb-3">
                <img 
                  src="/assets/eggs.gif" 
                  alt="Elemental Eggs" 
                  className="w-24 h-24 object-contain pixelated"
                />
              </div>
            )}
          </div>
          
          {/* Show hatching interface if no elemental has been hatched yet */}
          {!hatchedTokenId && (
            <div className="w-full max-w-md mx-auto mb-3">
              <p className="text-center mb-1 text-sm text-[var(--ro-gold)]">Ready to hatch your Elemental?</p>
              <p className="text-xs text-center mb-3 text-[var(--ro-gold)]">Cost: 0.1 MONAD</p>
              
              {/* Connection status */}
              <div className="mb-3">
                {!isConnected ? (
                  <button
                    className="game-button w-full py-2"
                    onClick={() => connect({ connector: farcasterFrame() })}
                  >
                    CONNECT WALLET
                  </button>
                ) : chainId !== MONAD_TESTNET_ID ? (
                  <button
                    className="game-button w-full py-2"
                    onClick={() => switchChain({ chainId: MONAD_TESTNET_ID })}
                  >
                    SWITCH TO MONAD TESTNET
                  </button>
                ) : (
                  <button
                    className="game-button w-full py-2"
                    onClick={claimAdventurerHandler}
                    disabled={isPending || isWaitingForTx}
                  >
                    {isPending || isWaitingForTx ? "HATCHING..." : "HATCH ELEMENTAL"}
                  </button>
                )}
              </div>
              
              {/* Battle Arena Button - updated name and makes it open in a new tab */}
              <a href="https://elementals-monad.vercel.app/battle-arena" target="_blank" rel="noopener noreferrer" className="w-full">
                <button
                  className="game-button w-full py-2 mt-2 bg-[var(--ro-accent)] text-black font-pixel text-lg border-2 border-[var(--ro-gold)] shadow-lg hover:bg-yellow-400 transition-all"
                >
                  BATTLE ARENA
                </button>
              </a>
              
              {/* Error display */}
              {isError && (
                <div className="mb-3 p-2 game-panel bg-red-900/30 text-xs">
                  <p className="text-red-400 mb-1">Error hatching Elemental:</p>
                  <p className="break-all">{error?.message || "Unknown error"}</p>
                  
                  {isGasRelatedError(error?.message) && !useHigherGas && (
                    <button
                      className="game-button mt-2 py-1 text-xs w-full"
                      onClick={() => {
                        setUseHigherGas(true);
                        claimAdventurerHandler();
                      }}
                    >
                      RETRY WITH HIGHER GAS
                    </button>
                  )}
                </div>
              )}
              
              {/* Transaction status */}
              {txHash && (
                <div className="mb-3 p-2 game-panel bg-blue-900/30 text-xs">
                  <p className="text-blue-400 mb-1">Transaction sent!</p>
                  <p className="break-all">{txHash}</p>
                  <a
                    href={`https://testnet.monadexplorer.com/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 underline mt-1 block"
                  >
                    View on Explorer
                  </a>
                </div>
              )}
              
              {/* Debug info */}
              {debugInfo && (
                <div className="mb-3 p-2 game-panel bg-gray-900/30 text-xs">
                  <p className="text-gray-400 mb-1">Debug Info:</p>
                  <p className="break-all">{debugInfo}</p>
                </div>
              )}
            </div>
          )}
          
          {/* Show hatched elemental */}
          {hatchedTokenId && (
            <div className="game-panel p-3 w-full max-w-md mx-auto">
              <div className="flex flex-col items-center">
                <img 
                  src={getElementalGif(hatchedTokenId)} 
                  alt={`${getElementalName(hatchedTokenId)}`}
                  className="w-32 h-32 mb-2 pixelated"
                />
                <h3 className="text-lg font-pixel">{getElementalName(hatchedTokenId)}</h3>
                <p className="text-[var(--game-gold)] text-xs">{getRarityTier(hatchedTokenId)}</p>
                <p className="text-xs text-gray-400">#{hatchedTokenId}</p>
                
                {txHash && (
                  <a
                    href={`https://testnet.monadexplorer.com/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 underline mt-2 text-xs"
                  >
                    View on Monad Explorer
                  </a>
                )}
                
                <div className="flex flex-wrap justify-center gap-2 mt-3">
                  <button onClick={continueToAdventure} className="game-button py-2 px-3 text-xs">
                    ADVENTURE
                  </button>
                  <a href="https://elementals-monad.vercel.app/battle-arena" target="_blank" rel="noopener noreferrer">
                    <button className="game-button py-2 px-3 text-xs bg-blue-600">
                      BATTLE ARENA
                    </button>
                  </a>
                  <button
                    className="game-button py-2 px-3 text-xs flex items-center"
                    onClick={shareOnFarcaster}
                  >
                    <span className="mr-1">🔊</span> SHARE ON FARCASTER
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (gameStep === "adventure") {
    return (
      <div className="p-6 game-panel">
        <h3 className="text-lg font-pixel text-center text-[var(--game-gold)] mb-4">YOUR ADVENTURE BEGINS!</h3>
        
        {hatchedTokenId && (
          <div className="flex flex-col items-center mb-4">
            <p className="mb-2 text-sm text-center">Your Elemental Adventurer is ready to explore</p>
            
            <div className="game-panel p-4 mb-3 text-center">
              <p className="text-xs mb-1">Token #{hatchedTokenId}</p>
              <p className="text-sm font-pixel mb-1">{getElementalName(hatchedTokenId)}</p>
              <p className="text-xs mb-3 text-[var(--game-gold)]">{getRarityTier(hatchedTokenId)} Rarity</p>
              
              {txHash && (
                <a
                  href={`https://testnet.monadexplorer.com/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 underline text-xs block mb-3"
                >
                  View on Monad Explorer
                </a>
              )}
              
              <div className="w-32 h-32 mx-auto relative">
                <img 
                  src={getElementalGif(hatchedTokenId)} 
                  alt={`${getElementalName(hatchedTokenId)} #${hatchedTokenId}`}
                  className="w-full h-full object-contain pixelated"
                />
              </div>
            </div>
          </div>
        )}
        
        <div className="game-panel p-4 w-full">
          <p className="text-center text-sm">Game content coming soon...</p>
          <div className="flex justify-center mt-4">
            <button
              className="game-button py-2 px-3 text-xs"
              onClick={viewInventory}
            >
              VIEW INVENTORY
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 game-panel">
      <div className="flex flex-col space-y-4 items-center">
        <p className="text-center">Welcome to Elementals Adventure!</p>
        <p className="text-center text-xs">Begin your journey by hatching an Elemental Adventurer</p>
        <button
          className="game-button py-2 px-4"
          onClick={startGame}
        >
          START GAME
        </button>
      </div>
    </div>
  );
}