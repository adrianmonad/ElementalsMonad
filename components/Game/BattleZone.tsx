"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMiniAppContext } from "@/hooks/use-miniapp-context";
import { useAccount } from "wagmi";
import { usePrivy } from "@privy-io/react-auth";
import Image from "next/image";
import useMagicEdenInventory from '@/hooks/useMagicEdenInventory';
import { useTransaction } from '@/hooks/useTransaction';
import useWalletTransactions from '@/hooks/useWalletTransactions';
import type { InventoryItem } from '@/hooks/useMagicEdenInventory';
import { ethers } from "ethers";
import { createWalletClient, custom, parseEther } from 'viem';
import { defineChain } from 'viem';
import { formatEther } from "viem";
import { toast, Toaster } from "sonner";

// Boss imagery for the battle
const BOSSES = [
  "/boss/boss1.gif",
  "/boss/boss2.gif",
  "/boss/boss3.gif"
];

// Elemental characters
const ELEMENTALS = [
  "/assets/Emberith.gif",
  "/assets/Nyxar.gif",
  "/assets/Rhoxodon.gif",
  "/assets/Infermor.gif",
  "/assets/Nactivyx.gif"
];

// Timeout durations in milliseconds
const LOADING_TIMEOUT = 10000; // 10 seconds
const AUTH_COMPLETION_TIMEOUT = 5000; // 5 seconds for auth to complete

// Rarity color mapping
const rarityColors: { [key: string]: string } = {
  'Common': 'text-yellow-300',
  'Uncommon': 'text-green-400',
  'Epic': 'text-purple-400',
  'Legendary': 'text-orange-400',
  'Ultra Rare': 'text-pink-400',
};

const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet-rpc.monad.xyz/'] },
  },
});

// Add this at the top, after imports
const LOCAL_MOCK_WALLET_ADDRESS = "0x20ce27B140A0EEECceF880e01D2082558400FDd6";

export default function BattleZone() {
  console.log('BattleZone component starting to render');
  
  // All hooks must be at the top, before any return
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => { 
    console.log('hasMounted effect running');
    setHasMounted(true); 
  }, []);
  const [battleStarted, setBattleStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [selectedBoss, setSelectedBoss] = useState<string | null>(null);
  const [playerElemental, setPlayerElemental] = useState<string | null>(null);
  const [playerHealth, setPlayerHealth] = useState(100);
  const [bossHealth, setBossHealth] = useState(100);
  const [loadingState, setLoadingState] = useState<'init' | 'ready'>('init');
  const [isStuck, setIsStuck] = useState(false);
  const [authInProgress, setAuthInProgress] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(0);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [showKeyReminder, setShowKeyReminder] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const authTimerRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();
  const { context } = useMiniAppContext();
  const { address, isConnected } = useAccount();
  const { user, ready, authenticated, login, logout } = usePrivy();
  
  // Always use the Privy embedded wallet if available
  let privyUserAddress = user?.wallet?.address || null;

  // For local development, use a mock wallet address if Privy is not available
  if (!privyUserAddress && typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    privyUserAddress = LOCAL_MOCK_WALLET_ADDRESS;
  }

  const hasWallet = authenticated && !!privyUserAddress;
  const [walletTimeout, setWalletTimeout] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  // TEST TX and wallet readiness hooks
  const [testTxHash, setTestTxHash] = useState<string | null>(null);
  const [testTxLoading, setTestTxLoading] = useState(false);
  const { sendTx, sendRawTransactionAndConfirm, txLoading, ready: txReady, balance, address: txAddress, resetNonceAndBalance } = useTransaction();

  // Helper to get the balance display
  const getBalanceDisplay = () => {
    if (balance) {
      return `${formatEther(balance)} MONAD`;
    } else {
      return "Loading...";
    }
  };

  // Detect mobile device - MOVED UP HERE WITH OTHER HOOKS
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = typeof window.navigator === 'undefined' ? '' : navigator.userAgent;
      const mobile = Boolean(
        userAgent.match(/Android|BlackBerry|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i)
      );
      setIsMobile(mobile);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Optimize for mobile - bypass more checks on mobile
  useEffect(() => {
    if (isMobile && authenticated && privyUserAddress) {
      setWalletTimeout(true);
      setForceRefresh(prev => prev + 1);
      setTimeout(() => {
        setLoadingState('ready');
      }, 1000);
    }
  }, [isMobile, authenticated, privyUserAddress]);

  // Mobile-specific helper for transaction capability
  const canSendTransactionsOnMobile = useCallback(() => {
    // For mobile, we want to be more permissive about starting transactions
    if (isMobile && authenticated && privyUserAddress) {
      return true;
    }
    return txReady;
  }, [isMobile, authenticated, privyUserAddress, txReady]);

  // DEBUG LOGGING - REMOVE AFTER DEBUGGING
  // eslint-disable-next-line no-console
  console.log('BATTLEZONE DEBUG:', {
    ready,
    loadingState,
    authenticated,
    user,
    privyUserAddress
  });

  // For local development, immediately set loading state to ready
  useEffect(() => {
    // This effect always runs (no conditions on hook itself)
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      console.log("Using mock wallet for local development:", LOCAL_MOCK_WALLET_ADDRESS);
      // Force the loading state to ready after a short delay
      setTimeout(() => {
        setLoadingState('ready');
      }, 100);
    }
  }, []);  // Empty dependency array

  // NFT selection state and logic (must be inside component)
  type SelectedPerRarity = { [rarity: string]: InventoryItem };
  const [selectedPerRarity, setSelectedPerRarity] = useState<SelectedPerRarity>({});
  const [showTokenPicker, setShowTokenPicker] = useState<{rarity: string, open: boolean}>({rarity: '', open: false});
  const [tokenPickerList, setTokenPickerList] = useState<InventoryItem[]>([]);
  const { inventory, isLoading: inventoryLoading } = useMagicEdenInventory(privyUserAddress || address);
  const groupedByRarity = inventory.reduce((acc: Record<string, InventoryItem[]>, item: InventoryItem) => {
    if (!acc[item.rarity]) acc[item.rarity] = [];
    acc[item.rarity].push(item);
    return acc;
  }, {});
  const rarityOrder = ['Common', 'Uncommon', 'Epic', 'Legendary', 'Ultra Rare'];

  // Group inventory by name+rarity
  const groupedInventory = inventory.reduce((acc: Record<string, InventoryItem[]>, item) => {
    const key = `${item.name}-${item.rarity}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
  const groupedList = Object.values(groupedInventory).map(group => group.sort((a, b) => Number(a.tokenId) - Number(b.tokenId)));

  // Modal state for selection
  const [showSelectModal, setShowSelectModal] = useState(false);
  // Timer mapping for rarity
  const rarityTimers: { [key: string]: number } = {
    'Common': 10,
    'Uncommon': 20,
    'Epic': 40,
    'Legendary': 60,
    'Ultra Rare': 120,
  };

  // State for wave-based battle
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [roundInProgress, setRoundInProgress] = useState(false);
  const [battleResults, setBattleResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  // Store the order of selected rarities (lowest to highest)
  const selectedRarities = rarityOrder.filter(rarity => selectedPerRarity[rarity]);

  // Check session storage to see if we already refreshed after login
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check for "just logged in" flag
      const justLoggedIn = sessionStorage.getItem('justLoggedIn');
      
      if (authenticated && justLoggedIn === 'true') {
        console.log("First load after login - updating UI state");
        // Force a component re-render to ensure all state is fresh
        setForceRefresh(prev => prev + 1);
        // Clear the flag so we don't refresh again
        sessionStorage.removeItem('justLoggedIn');
      }
    }
  }, [authenticated]);

  // Set loading time detection
  useEffect(() => {
    // Clear any existing timers when loading state changes
    if (loadingTimerRef.current) {
      clearTimeout(loadingTimerRef.current);
      loadingTimerRef.current = null;
    }
    
    // Reset stuck state
    setIsStuck(false);
    
    // Set timers based on current loading state
    if (loadingState === 'init') {
      loadingTimerRef.current = setTimeout(() => {
        setIsStuck(true);
        console.log("Loading timed out - offering skip option");
      }, LOADING_TIMEOUT);
    }
    
    // Cleanup timer on unmount
    return () => {
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
      }
    };
  }, [loadingState]);

  // Authentication detection - critical for UI updates
  useEffect(() => {
    // If authentication is ready and user is authenticated, update UI
    if (ready && authenticated) {
      console.log("Authentication detected - updating UI state");
      
      // Clear any existing auth timer
      if (authTimerRef.current) {
        clearTimeout(authTimerRef.current);
      }
      
      // Immediately update loading state
      setLoadingState('ready');
      
      // Reset auth in progress flag
      setAuthInProgress(false);
      
      // Force a component re-render to ensure all state is fresh
      setForceRefresh(prev => prev + 1);
    }
    
    // Always update UI state when ready changes
    if (ready) {
      setLoadingState('ready');
    }
  }, [ready, authenticated]);

  // Update loading state when pre-generated wallet is available
  useEffect(() => {
    if (privyUserAddress) {
      console.log("Pre-generated wallet available:", privyUserAddress);
      setLoadingState('ready');
    }
  }, [privyUserAddress]);

  // Force transaction system to be considered ready when we have a pre-generated wallet
  useEffect(() => {
    if (authenticated && privyUserAddress && !txReady) {
      console.log("Pre-generated wallet available, bypassing transaction system checks");
      // Force set the forceRefresh state to trigger a re-render of the component
      setForceRefresh(prev => prev + 1);
      // Force set the walletTimeout to true to allow battle to start anyway
      setWalletTimeout(true);
    }
  }, [authenticated, privyUserAddress, txReady]);
  
  // Update the battle controls rendering to allow START button regardless of txReady status
  const canStartBattle = ready && authenticated && privyUserAddress && (txReady || isMobile || walletTimeout || canSendTransactionsOnMobile());

  // Auto-select or prompt for selection when inventory loads
  useEffect(() => {
    if (!inventoryLoading && inventory.length > 0) {
      if (inventory.length === 1) {
        setSelectedPerRarity({ [inventory[0].rarity]: inventory[0] });
        setPlayerElemental(inventory[0].image);
        setTimeLeft(rarityTimers[inventory[0].rarity] || 60);
      } else if (!selectedPerRarity[Object.keys(selectedPerRarity)[0]]) {
        setShowSelectModal(true);
      }
    }
  }, [inventoryLoading, inventory]);

  // Start wave-based battle
  const startWaveBattle = () => {
    // No more toasts here - they're distracting
    console.log(`Starting battle with ${privyUserAddress ? `wallet ${privyUserAddress.slice(0, 6)}...${privyUserAddress.slice(-4)}` : 'no wallet'}`);
    
    setCurrentRoundIndex(0);
    setBattleResults([]);
    setShowResults(false);
    setBattleStarted(true); // Mark battle as started
    
    if (selectedRarities.length > 0) {
      startRound(0);
    } else {
      // If no elementals are selected, start a standard battle
      console.log("No elementals selected, starting standard battle");
      setTimeLeft(60);
    }
  };

  // Start a round for a given rarity index
  const startRound = (roundIdx: number) => {
    setCurrentRoundIndex(roundIdx);
    setRoundInProgress(true);
    const rarity = selectedRarities[roundIdx];
    const token = selectedPerRarity[rarity];
    setPlayerElemental(token.image);
    setTimeLeft(rarityTimers[rarity] || 10);
    setPlayerHealth(100);
    setBossHealth(100);
    // Start timer for this round
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current as NodeJS.Timeout);
          endRound(roundIdx);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // End a round and move to next or show results
  const endRound = (roundIdx: number) => {
    setRoundInProgress(false);
    // Store result for this round
    setBattleResults(prev => [
      ...prev,
      {
        rarity: selectedRarities[roundIdx],
        playerHealth,
        bossHealth,
        win: playerHealth > bossHealth,
      }
    ]);
    // Short pause/animation before next round
    setTimeout(() => {
      if (roundIdx + 1 < selectedRarities.length) {
        startRound(roundIdx + 1);
      } else {
        setShowResults(true);
      }
    }, 1500); // 1.5s pause
  };

  // UI: Only show the current round's NFT/boss
  const currentRarity = selectedRarities[currentRoundIndex];
  const currentToken = selectedPerRarity[currentRarity];

  // Attack function
  const attack = () => {
    if (!battleStarted || timeLeft === 0) return;
    
    // Player attack: reduce boss health by random amount (5-15)
    const playerDamage = Math.floor(Math.random() * 11) + 5;
    setBossHealth((prev) => Math.max(0, prev - playerDamage));
    
    // Boss counterattack: reduce player health by random amount (3-10)
    const bossDamage = Math.floor(Math.random() * 8) + 3;
    setPlayerHealth((prev) => Math.max(0, prev - bossDamage));
  };

  // Reset battle
  const resetBattle = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(60);
    setPlayerHealth(100);
    setBossHealth(100);
    setBattleStarted(false);
    
    // Choose a different boss for variety
    if (selectedBoss) {
      const newBossIndex = (BOSSES.indexOf(selectedBoss) + 1) % BOSSES.length;
      setSelectedBoss(BOSSES[newBossIndex]);
    } else {
      // If boss is somehow null, pick a random one
      setSelectedBoss(BOSSES[Math.floor(Math.random() * BOSSES.length)]);
    }
  };

  // Go back to home
  const goToHome = () => {
    router.push("/");
  };

  // Simplified wallet setup - just use pregenerated wallet
  const handleLoginWithEmail = () => {
    setAuthInProgress(true);
    
    if (authTimerRef.current) {
      clearTimeout(authTimerRef.current);
    }
    
    // Set a flag in session storage so we know we're coming back from login
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('justLoggedIn', 'true');
    }
    
    login();
    
    // Set a timer to detect if auth process gets stuck
    authTimerRef.current = setTimeout(() => {
      if (authInProgress) {
        console.log("Auth process appears to be stuck - prompting for retry");
        setAuthInProgress(false);
        // Can show a retry option here
      }
    }, AUTH_COMPLETION_TIMEOUT);
  };

  // Logout handler
  const handleLogout = () => {
    console.log("Logging out");
    logout();
    
    // Clear any session storage flags on logout
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('justLoggedIn');
    }
  };

  // Copy wallet address to clipboard
  const handleCopyAddress = async () => {
    if (privyUserAddress) {
      try {
        await navigator.clipboard.writeText(privyUserAddress);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (err) {
        alert('Failed to copy address');
      }
    }
  };

  // Guide users to connect a Monad wallet
  const handleConnectMonadWallet = () => {
    toast.info("How to use a real Monad wallet", {
      description: "You'll need to connect a real wallet to send transactions on Monad.",
      duration: 8000,
      action: {
        label: "Learn How",
        onClick: () => window.open("https://docs.monad.xyz/quickstart", "_blank")
      }
    });
    
    // After a short delay, show more specific instructions
    setTimeout(() => {
      toast.info("Add Monad to your wallet", {
        description: "Chain ID: 10143, RPC URL: https://testnet-rpc.monad.xyz/",
        duration: 12000
      });
    }, 2000);
  };

  // Force re-render the component
  const handleForceUpdate = () => {
    console.log("Forcing UI update");
    setForceRefresh(prev => prev + 1);
    setLoadingState('ready');
  };

  // Check for authenticated user with wallet but no key downloaded yet
  useEffect(() => {
    // If user just got a wallet, remind them to download their key
    if (authenticated && privyUserAddress && !showKeyReminder) {
      // Show key download reminder
      setShowKeyReminder(true);
      
      // Hide reminder after some time
      const timer = setTimeout(() => {
        setShowKeyReminder(false);
      }, 30000); // Show for 30 seconds
      
      return () => clearTimeout(timer);
    }
  }, [authenticated, privyUserAddress, showKeyReminder]);

  // Wait for wallet creation, show fallback if too slow
  useEffect(() => {
    // If authenticated with a wallet but tx system is not ready, set timeout
    if (authenticated && privyUserAddress && !txReady) {
      const timer = setTimeout(() => setWalletTimeout(true), 10000);
      return () => clearTimeout(timer);
    } else {
      setWalletTimeout(false);
    }
  }, [authenticated, privyUserAddress, txReady]);

  // Remove selectedToken/setSelectedToken logic (use selectedPerRarity instead)
  // Refactor modal 'Continue' button to set playerElemental and timeLeft based on the first selected rarity
  const handleContinue = () => {
    setShowSelectModal(false);
    // Pick the first selected rarity as the active battle NFT for now
    const firstRarity = Object.keys(selectedPerRarity)[0];
    if (firstRarity) {
      const token = selectedPerRarity[firstRarity];
      setPlayerElemental(token.image);
      setTimeLeft(rarityTimers[token.rarity] || 60);
    }
  };

  // Function to select NFT for a rarity
  type Rarity = string;
  const handleSelectForRarity = (rarity: Rarity, token: InventoryItem) => {
    setSelectedPerRarity(prev => ({ ...prev, [rarity]: token }));
    setShowTokenPicker({rarity: '', open: false});
  };
  // Function to open token picker for a rarity
  const openTokenPicker = (rarity: Rarity) => {
    setTokenPickerList(groupedByRarity[rarity]);
    setShowTokenPicker({rarity, open: true});
  };
  // Only allow proceeding if at least one NFT is selected
  const canProceed = Object.keys(selectedPerRarity).length > 0;

  // Debug logging for rarity selection and battle sequence
  useEffect(() => {
    console.log('groupedByRarity:', groupedByRarity);
    console.log('selectedPerRarity:', selectedPerRarity);
    console.log('selectedRarities:', selectedRarities);
  }, [groupedByRarity, selectedPerRarity, selectedRarities]);

  // Log when each round starts
  useEffect(() => {
    if (roundInProgress && currentRarity && currentToken) {
      console.log(`Starting round for rarity: ${currentRarity}`, currentToken);
    }
  }, [roundInProgress, currentRarity, currentToken]);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuRef]);

  // Navigation handler
  const navigateTo = (page: 'home' | 'inventory' | 'marketplace' | 'leaderboard' | 'battle-zone') => {
    if (page === 'battle-zone') {
      window.location.href = '/battle-zone';
      return;
    }
    if (page === 'home') {
      window.dispatchEvent(new CustomEvent('resetGameFlow', { detail: { reset: true } }));
    }
    window.location.href = `/${page === 'home' ? '' : page}`;
    setMenuOpen(false);
  };

  // Add useEffect to monitor txReady state changes
  useEffect(() => {
    console.log(`BattleZone: txReady state changed to: ${txReady}`);
    console.log(`Current wallet state - authenticated: ${authenticated}, hasWallet: ${!!privyUserAddress}, ready: ${ready}`);
  }, [txReady, authenticated, privyUserAddress, ready]);

  // Update the useEffect hook where userWallet is still referenced
  useEffect(() => {
    // Update UI when transaction system is ready
    if (txReady && authenticated && ready) {
      console.log("Transaction system ready!");
      setForceRefresh(prev => prev + 1);
    }
  }, [txReady, authenticated, ready]);

  // Test transaction handler - always use embedded wallet
  const handleTestTransaction = async () => {
    if (!txReady || !privyUserAddress) {
      toast.error("Wallet not ready");
      return;
    }
    try {
      await sendTx("0xdead000000000000000000000000000000000000", "0.00001");
      toast.success("Transaction sent!");
    } catch (err) {
      toast.error("Transaction failed", { description: (err as Error).message });
    }
  };

  // Show spinner and fallback if wallet creation is slow
  const isWalletReady = !!privyUserAddress;
  
  // Skip loading screen if we have a pre-generated wallet
  if ((!ready || loadingState === 'init') && !privyUserAddress) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center">
        <div className="text-center mb-4">
          <h1 className="text-2xl font-pixel text-shadow pb-2 text-[var(--ro-gold)]">
            BATTLE ZONE
          </h1>
        </div>
        {/* Simplified spinner with standard classes */}
        <div className="w-16 h-16 animate-spin rounded-full border-4 border-[#333333] border-t-[#ffc107]"></div>
        <p className="mt-4 text-[var(--ro-text)] font-pixel">Loading Battle Arena...</p>
        
        {/* Show a message if loading takes too long */}
        {isStuck && (
          <div className="mt-4 flex flex-col items-center">
            <p className="text-[var(--ro-health)] font-pixel text-sm">
              Loading is taking longer than expected.
            </p>
            <p className="text-[var(--ro-text)] font-pixel text-xs mt-1">
              Privy authentication system may be slow to respond.
            </p>
          </div>
        )}
        
        {/* Refresh button */}
        <button 
          onClick={() => window.location.reload()}
          className="mt-8 ro-button py-2 px-4"
        >
          Refresh Page
        </button>

        {/* Force UI update button */}
        <button 
          onClick={handleForceUpdate}
          className="mt-4 ro-button py-2 px-4"
        >
          Force UI Update
        </button>

        {/* Skip loading button - only show if stuck */}
        {isStuck && (
          <button 
            onClick={() => {
              console.log("User skipped loading - forcing ready state");
              setLoadingState('ready');
            }}
            className="mt-4 ro-button py-2 px-4"
          >
            Skip Loading
          </button>
        )}
      </div>
    );
  }

  // If we need to refresh, show a simple loading screen
  if (needsRefresh) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center">
        <div className="text-center mb-4">
          <h1 className="text-2xl font-pixel text-shadow pb-2 text-[var(--ro-gold)]">
            BATTLE ZONE
          </h1>
        </div>
        <div className="w-16 h-16 animate-spin rounded-full border-4 border-[#333333] border-t-[#ffc107]"></div>
        <p className="mt-4 text-[var(--ro-text)] font-pixel">Completing login...</p>
      </div>
    );
  }

  // Only show wallet UI when Privy is ready and wallet address is available
  if (!ready || !privyUserAddress) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center">
        <div className="w-16 h-16 animate-spin rounded-full border-4 border-[#333333] border-t-[#ffc107]"></div>
        <p className="mt-4 text-white font-pixel">Loading Privy wallet...</p>
      </div>
    );
  }

  // Only return null after all hooks
  if (!hasMounted || !selectedBoss || !playerElemental) {
    console.log('BattleZone waiting for mount or content to be ready', {
      hasMounted,
      selectedBoss: !!selectedBoss,
      playerElemental: !!playerElemental
    });
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center">
        <div className="w-16 h-16 animate-spin rounded-full border-4 border-[#333333] border-t-[#ffc107]"></div>
        <p className="mt-4 text-white font-pixel">Loading...</p>
      </div>
    );
  }

  console.log('BattleZone main UI rendering');

  // Add random character selection on mount
  useEffect(() => {
    if (hasMounted) {
      // Set random boss and elemental after component has mounted
      const randomBoss = BOSSES[Math.floor(Math.random() * BOSSES.length)];
      const randomElemental = ELEMENTALS[Math.floor(Math.random() * ELEMENTALS.length)];
      setSelectedBoss(randomBoss);
      setPlayerElemental(randomElemental);
    }
  }, [hasMounted]);

  return (
    <div className="min-h-screen w-full flex flex-col relative p-4 pt-20 pb-20 overflow-x-hidden">
      {/* Menu Button - Top Right */}
      <div className="fixed top-4 right-4 z-50" ref={menuRef}>
        <div className="ro-window p-0">
          <div className="ro-menu-button cursor-pointer" onClick={() => setMenuOpen(!menuOpen)}>
            <div className="ro-menu-line"></div>
            <div className="ro-menu-line"></div>
            <div className="ro-menu-line"></div>
          </div>
        </div>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-2 w-48 z-50">
            <div className="ro-menu">
              <div className="ro-window-header">Menu</div>
              <div className="p-2 space-y-1">
                <button onClick={() => navigateTo('home')} className="w-full ro-button">HOME</button>
                <button onClick={() => navigateTo('inventory')} className="w-full ro-button">INVENTORY</button>
                <button onClick={() => navigateTo('marketplace')} className="w-full ro-button">MARKETPLACE</button>
                <button onClick={() => navigateTo('leaderboard')} className="w-full ro-button">RANKINGS</button>
                <button onClick={() => navigateTo('battle-zone')} className="w-full ro-button">BATTLE ZONE</button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Main Content */}
      <div className="flex-grow flex flex-col items-center justify-center mx-auto w-full max-w-4xl">
        {/* Page Title */}
        <div className="text-center mt-6 mb-4">
          <h1 className="text-2xl font-pixel text-shadow pb-2 text-[var(--ro-gold)]">
            BATTLE ZONE
          </h1>
        </div>
        
        {/* Force Render Key - invisible but causes re-renders */}
        <div className="hidden">{forceRefresh}</div>
        
        {/* Debug Info - helps during development */}
        <div className="text-xs mb-2 opacity-70">
          <span>Auth: {authenticated ? 'Yes' : 'No'} | </span>
          <span>Ready: {ready ? 'Yes' : 'No'} | </span>
          <span>Wallet: {privyUserAddress ? 'Yes' : 'No'} | </span>
          <span>TxReady: {txReady ? 'Yes' : (canStartBattle ? 'Bypassed' : 'No')}</span>
        </div>
        
        {/* Additional debug info */}
        <div className="text-xs mb-4 text-yellow-300">
          <button 
            onClick={() => console.log({
              user,
              privyUserAddress,
              txReady,
              authenticated,
              ready
            })}
            className="underline"
          >
            Log wallet details to console
          </button>
        </div>
        
        {/* Battle Arena */}
        <div className="w-full">
          <div className="ro-window overflow-hidden flex flex-col">
            {/* Auth Status Section */}
            <div className="p-2 border-b-2 border-[var(--ro-border-dark)]">
              {authenticated && user ? (
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="text-xs font-pixel text-[var(--ro-text)]">
                      Logged in: <span className="text-[var(--ro-gold)]">{user.email?.address}</span>
                    </span>
                    {privyUserAddress ? (
                      <div>
                        <span className="text-xs font-pixel text-[var(--ro-text)]">
                          Wallet: <span className="text-white">
                            {privyUserAddress ? `${privyUserAddress.slice(0, 6)}...${privyUserAddress.slice(-4)}` : 'Not connected'}
                          </span>
                          <span className="ml-1 text-white">(Monad Testnet)</span>
                          <button
                            onClick={handleCopyAddress}
                            className="ml-2 px-1 py-0.5 rounded bg-[var(--ro-accent)] text-black text-xs font-pixel border border-[var(--ro-gold)]"
                            title="Copy address"
                            style={{ verticalAlign: 'middle' }}
                          >📋</button>
                          {copySuccess && (
                            <span className="ml-2 text-green-400 font-pixel text-xs">Copied!</span>
                          )}
                        </span>
                      </div>
                    ) : authenticated ? (
                      <div>
                        <span className="text-xs font-pixel text-[var(--ro-text)]">
                          <span className="text-[var(--ro-health)]">
                            Creating wallet...
                          </span>
                        </span>
                        <div className="mt-1 text-xs font-pixel text-[var(--ro-text)]">
                          Please wait a moment for wallet setup
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs font-pixel text-[var(--ro-text)]">
                        <span className="text-[var(--ro-health)]">
                          No wallet detected
                        </span>
                      </span>
                    )}
                  </div>
                  <div className="flex flex-row gap-2">
                    <button 
                      onClick={handleLogout}
                      className="ro-button-secondary text-xs py-1 px-3"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-center">
                  <button 
                    onClick={handleLoginWithEmail}
                    className="ro-button py-1 px-4"
                    disabled={authInProgress}
                  >
                    {authInProgress ? 'Logging in...' : 'Login with Email'}
                  </button>
                </div>
              )}
            </div>
            
            {/* Battle Arena Section */}
            <div className="p-4 flex flex-col">
              {/* Battle UI */}
              <div className="flex flex-col items-center justify-center min-h-[300px] gap-2 w-full">
                {/* Timer and VS */}
                <div className="flex flex-col items-center justify-center mb-2">
                  <div className="text-xl font-pixel text-center mb-1">{timeLeft}s</div>
                  <div className="text-3xl font-pixel text-[var(--ro-gold)]">VS</div>
                  {battleStarted && timeLeft === 0 && (
                    <div className="text-lg font-pixel text-center mt-1">
                      {playerHealth > bossHealth ? (
                        <span className="text-[var(--ro-gold)]">WIN!</span>
                      ) : playerHealth < bossHealth ? (
                        <span className="text-[var(--ro-health)]">LOSE</span>
                      ) : (
                        <span className="text-white">DRAW</span>
                      )}
                    </div>
                  )}
                </div>
                {/* GIFs Row */}
                <div className="flex flex-row items-center justify-center w-full gap-4">
                  {/* Player Side */}
                  <div className="flex flex-col items-center w-1/2 max-w-[140px]">
                    <div className="ro-portrait w-28 h-28 sm:w-32 sm:h-32 md:w-40 md:h-40 mb-2 relative pixel-border-animated pixel-dots-animated">
                      <Image 
                        src={playerElemental!}
                        alt="Player Elemental"
                        width={112}
                        height={112}
                        className="pixelated"
                        unoptimized
                      />
                    </div>
                    {/* Player Health Bar */}
                    <div className="w-full max-w-[100px]">
                      <div className="text-xs font-pixel mb-1">HP: {playerHealth}/100</div>
                      <div className="w-full bg-[var(--ro-bg-dark)] h-3 border border-[var(--ro-border-light)]">
                        <div 
                          className="h-full bg-[var(--ro-health)]"
                          style={{ width: `${playerHealth}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                  {/* Boss Side */}
                  <div className="flex flex-col items-center w-1/2 max-w-[140px]">
                    <div className="ro-portrait w-28 h-28 sm:w-32 sm:h-32 md:w-40 md:h-40 mb-2 relative pixel-border-animated pixel-dots-animated">
                      <Image 
                        src={selectedBoss!}
                        alt="Boss Enemy"
                        width={112}
                        height={112}
                        className="pixelated"
                        unoptimized
                      />
                    </div>
                    {/* Boss Health Bar */}
                    <div className="w-full max-w-[100px]">
                      <div className="text-xs font-pixel mb-1">HP: {bossHealth}/100</div>
                      <div className="w-full bg-[var(--ro-bg-dark)] h-3 border border-[var(--ro-border-light)]">
                        <div 
                          className="h-full bg-[var(--ro-health)]"
                          style={{ width: `${bossHealth}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Controls row - always below GIFs, centered */}
              <div className="w-full flex flex-col items-center justify-center mt-6">
                {!authenticated ? null : !roundInProgress ? (
                  <>
                    {/* Only show buttons when wallet is fully ready or on mobile */}
                    {canStartBattle ? (
                      <>
                        <button 
                          onClick={startWaveBattle}
                          className={`ro-button battle-button py-1 px-8 text-lg mx-auto ${isMobile ? 'text-xl py-3' : ''}`}
                        >
                          START
                        </button>
                        
                        {/* Test transaction section */}
                        <div className="flex flex-row gap-2 mt-4 justify-center">
                          <button
                            onClick={handleTestTransaction}
                            className={`ro-button battle-button py-1 px-8 text-lg ${isMobile ? 'text-xl py-3' : ''}`}
                            disabled={testTxLoading || txLoading}
                          >
                            {testTxLoading || txLoading ? "Sending..." : "TEST TX"}
                          </button>
                        </div>
                      </>
                    ) : (
                      /* Show general loading spinner for other initialization states */
                      <div className="flex flex-col items-center justify-center py-4">
                        <div className="w-10 h-10 mb-3 animate-spin rounded-full border-2 border-[#333333] border-t-[#ffc107]"></div>
                        <div className="text-center font-pixel text-sm text-white">
                          {isMobile ? "Setting up battle..." : "Loading wallet... Please wait."}
                        </div>
                        {/* Add skip button for mobile */}
                        {isMobile && (
                          <button 
                            onClick={() => setLoadingState('ready')}
                            className="mt-4 ro-button py-2 px-4 text-sm"
                          >
                            Skip Loading
                          </button>
                        )}
                      </div>
                    )}
                  </>
                ) : timeLeft > 0 ? (
                  <button 
                    onClick={attack}
                    className={`ro-button battle-button py-1 px-8 text-lg bg-[var(--ro-accent)] mx-auto ${isMobile ? 'text-xl py-3' : ''}`}
                  >
                    ATTACK
                  </button>
                ) : (
                  <div className="font-pixel text-yellow-400 text-lg">Round Complete!</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showSelectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center">
          <div className="bg-[var(--ro-bg-dark)] border-4 border-[var(--ro-gold)] rounded-lg sm:p-4 p-2 max-w-2xl w-full flex flex-col items-center max-h-[80vh] overflow-y-auto">
            <h2 className="font-pixel text-lg text-[var(--ro-gold)] mb-4">Choose Your Elementals (1 per Rarity)</h2>
            <div className="flex flex-col gap-2 w-full">
              {rarityOrder.map(rarity => {
                const count = groupedByRarity[rarity]?.length || 0;
                const rarityClass = rarityColors[rarity] || 'text-white';
                return (
                  <div key={rarity} className="flex flex-row items-center justify-between border-2 rounded-lg p-2 sm:p-4 bg-[var(--ro-bg-light)] border-gray-600 shadow-lg select-none cursor-default">
                    <span className={`font-pixel text-md sm:text-lg ${rarityClass}`}>{rarity}</span>
                    <span className="font-pixel text-md sm:text-lg text-white">x{count}</span>
                  </div>
                );
              })}
            </div>
            <button
              className="mt-6 ro-button battle-button py-2 px-8 text-lg font-pixel bg-[var(--ro-accent)] text-black border-2 border-[var(--ro-gold)] shadow-lg hover:bg-yellow-400 transition-all"
              onClick={() => setShowSelectModal(false)}
            >
              ▶️ Start Battle
            </button>
          </div>
        </div>
      )}
      {/* If no NFTs, show a message */}
      {!inventoryLoading && inventory.length === 0 && (
        <div className="text-center text-white font-pixel mt-8">You have no Elementals. Mint or hatch one to battle!</div>
      )}

      {/* Wallet Status UI */}
      {canStartBattle && (
        <div className="my-4 p-4 bg-[var(--ro-panel-bg)] border border-[var(--ro-border)] rounded-lg">
          <h3 className="text-xl font-pixel mb-2 text-[var(--ro-gold)]">Wallet Status</h3>
          <div className={`mb-3 p-2 rounded-md ${
            txReady ? 'bg-green-900/30' : 'bg-yellow-900/30'
          }`}>
            <p className={`text-sm ${
              txReady ? 'text-green-400' : 'text-yellow-400'
            }`}>
              {txReady && privyUserAddress ?
                '✅ Connected to a real wallet. Full transaction support.' :
                '⏳ Waiting for wallet to be ready...'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Provider status: {txReady ? 'Ready' : 'Not ready'}
            </p>
          </div>
          <div className="flex justify-between items-center mb-2">
            <p className="text-[var(--ro-text)]">
              Address: {privyUserAddress ? `${privyUserAddress.slice(0, 6)}...${privyUserAddress.slice(-4)}` : 'Not connected'}
            </p>
            {privyUserAddress && (
              <button 
                onClick={() => window.open(`https://testnet.monadexplorer.com/address/${privyUserAddress}`, "_blank")}
                className="ro-button-secondary py-2 px-4 disabled:opacity-50"
                disabled={!privyUserAddress}
              >
                View Wallet in Explorer
              </button>
            )}
          </div>
          <p className="text-[var(--ro-text)] mb-2">
            Balance: {getBalanceDisplay()}
          </p>
          <div className="flex flex-col gap-2">
            <button 
              onClick={handleTestTransaction}
              disabled={txLoading || !privyUserAddress || !txReady}
              className={`ro-button py-2 px-4 disabled:opacity-50 ${txReady ? 'bg-green-600' : 'bg-yellow-700'}`}
            >
              {txLoading ? 'Processing...' : 'Send Test Transaction'}
            </button>
            {!txReady && privyUserAddress && (
              <button
                onClick={handleConnectMonadWallet}
                className="ro-button-secondary py-2 px-4 bg-blue-700 hover:bg-blue-800"
              >
                Connect Real Monad Wallet
              </button>
            )}
            {!txReady && privyUserAddress && (
              <p className="text-xs text-yellow-500 mt-1">
                Pre-generated wallet is view-only. Connect a Monad wallet for real transactions.
              </p>
            )}
          </div>
        </div>
      )}

      {/* For mobile debugging */}
      {isMobile && (
        <div className="p-4 bg-black/50 rounded-lg my-4 border border-yellow-500">
          <h3 className="text-yellow-500 font-bold">Mobile Debug Info</h3>
          <div className="text-xs text-white">
            <p>Wallet Ready: {isWalletReady ? '✅' : '❌'}</p>
            <p>TX Ready: {txReady ? '✅' : '❌'}</p>
            <p>Privy Auth: {authenticated ? '✅' : '❌'}</p>
            <p>Has Address: {privyUserAddress ? '✅' : '❌'}</p>
          </div>
        </div>
      )}
    </div>
  );
}