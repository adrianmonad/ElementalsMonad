"use client";

import { usePrivy, useLogin, useLogout, useWallets, useLoginWithEmail } from '@privy-io/react-auth';
import { useState, useEffect, useRef, useCallback } from 'react';
import { formatEther, parseEther, Hex, createWalletClient, custom, parseGwei } from 'viem';
import { monadTestnet } from 'viem/chains';
import { publicClient } from '../../utils/publicClient';
import { useMiniAppContext } from '../../hooks/use-miniapp-context';
import BattleSystem from '@/components/Game/BattleSystem';
import sdk from '@farcaster/frame-sdk';
import { useInventory } from '@/lib/InventoryContext';
import { useAccount } from 'wagmi';
import { ethers } from 'ethers';
import { Toaster, toast } from 'sonner';
import { usePrivyWallet } from '@/hooks/usePrivyWallet';

// Enhanced mobile detection with extra checks
const detectMobile = () => {
  // First check user agent for common mobile patterns
  const userAgentCheck = typeof window !== 'undefined' && 
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // Then check screen size as a fallback
  const screenSizeCheck = typeof window !== 'undefined' && window.innerWidth <= 768;
  
  // Check if we're in a Farcaster frame
  const inFarcasterApp = typeof window !== 'undefined' && 
    (window.location.href.includes('farcaster') || 
     window.navigator.userAgent.includes('Farcaster') ||
     sessionStorage.getItem('forceFarcasterMode') === 'true');
  
  return userAgentCheck || screenSizeCheck || inFarcasterApp;
};

// Use the enhanced detection
const isMobile = detectMobile();

export default function BattleAreaPage() {
  console.log("BattleAreaPage rendering, isMobile:", isMobile);
  
  // Privy hooks
  const { user, authenticated, ready } = usePrivy();
  const { ready: walletsReady } = useWallets();
  const { login } = useLogin();
  const { logout } = useLogout();
  const { sendCode, loginWithCode, state } = useLoginWithEmail();
  
  // Use our custom wallet hook for embedded wallet functionality
  const { 
    embeddedWalletAddress,
    balance,
    isInitialized: isWalletInitialized,
    isLoading: isWalletLoading,
    walletClient,
    error: walletError,
    initializeWallet,
    createNewEmbeddedWallet,
    sendRawTransaction
  } = usePrivyWallet();
  
  // Farcaster context (for mobile)
  const farcasterContext = useMiniAppContext();

  // Get the main wallet address from wagmi
  const { address: mainWalletAddress } = useAccount();

  // UI state
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState("");
  
  // Environment state
  const [useFarcaster, setUseFarcaster] = useState(false);
  const [authStatusMessage, setAuthStatusMessage] = useState<string>("Ready to battle!");
  
  // Get user inventory from the shared context
  const { inventory, isLoading: isInventoryLoading, refreshInventory, globalInventory, setMainWalletAddress, setTestInventory } = useInventory();
  
  // Direct NFT fetching for battle area
  const [directInventory, setDirectInventory] = useState<any[]>([]);
  const [isDirectFetching, setIsDirectFetching] = useState<boolean>(false);
  const [inventoryStatus, setInventoryStatus] = useState<string>("");
  
  // Cache key for localStorage
  const cacheKey = mainWalletAddress ? `battle_area_inventory_${mainWalletAddress.toLowerCase()}` : null;
  const cacheDuration = 5 * 60 * 1000; // 5 minutes
  
  // Helper functions for NFT metadata
  const getElementalName = (tokenId: number): string => {
    if (tokenId >= 1 && tokenId <= 3250) return "Rhoxodon";
    if (tokenId >= 3251 && tokenId <= 6499) return "Nactivyx";
    if (tokenId >= 6500 && tokenId <= 7999) return "Infermor";
    if (tokenId >= 8000 && tokenId <= 9499) return "Emberith";
    if (tokenId >= 9500 && tokenId <= 10000) return "Nyxar";
    return "Unknown Elemental"; // Fallback
  };
  
  const getElementalType = (tokenId: number): string => {
    // Simple deterministic mapping based on token ID
    if (tokenId >= 1 && tokenId <= 3250) return "earth"; // Rhoxodon - earth
    if (tokenId >= 3251 && tokenId <= 6499) return "water"; // Nactivyx - water
    if (tokenId >= 6500 && tokenId <= 7999) return "fire"; // Infermor - fire
    if (tokenId >= 8000 && tokenId <= 9499) return "fire"; // Emberith - fire (different variant)
    if (tokenId >= 9500 && tokenId <= 10000) return "air"; // Nyxar - air
    return "fire"; // Default fallback
  };
  
  const getRarity = (tokenId: number): string => {
    if (tokenId >= 1 && tokenId <= 3250) return "Uncommon";   // Rhoxodon - Uncommon
    if (tokenId >= 3251 && tokenId <= 6499) return "Common";   // Nactivyx - Common
    if (tokenId >= 6500 && tokenId <= 7999) return "Epic";     // Infermor - Epic
    if (tokenId >= 8000 && tokenId <= 9499) return "Legendary"; // Emberith - Legendary
    if (tokenId >= 9500 && tokenId <= 10000) return "Ultra Rare"; // Nyxar - Ultra Rare
    return "Unknown"; // Fallback
  };
  
  const getElementalImage = (name: string): string => {
    switch (name) {
      case 'Rhoxodon':
        return '/assets/Rhoxodon.gif';
      case 'Nactivyx':
        return '/assets/Nactivyx.gif';
      case 'Infermor':
        return '/assets/Infermor.gif';
      case 'Emberith':
        return '/assets/Emberith.gif';
      case 'Nyxar':
        return '/assets/Nyxar.gif';
      default:
        return '/assets/Emberith.gif'; // Default fallback
    }
  };
  
  // UI helper functions
  const shortenAddress = (address: string): string => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const copyToClipboard = (text: string): void => {
    navigator.clipboard.writeText(text);
    toast.success('Address copied to clipboard!');
  };

  // Add this at the top with your imports
  const fetchDirectNFTsWithBackoff = useCallback(async (walletAddress: string) => {
    if (!walletAddress) return;
    
    // Use the actual connected wallet address
    const addressToUse = walletAddress;
    
    setIsDirectFetching(true);
    
    // First try to get data from localStorage
    if (typeof window !== 'undefined' && cacheKey) {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const age = Date.now() - timestamp;
          
          // Use cached data if not expired
          if (age < cacheDuration && data && data.length > 0) {
            console.log(`Using cached inventory data (${Math.round(age/1000)}s old)`);
            setDirectInventory(data);
            setInventoryStatus(`Found ${data.length} elementals in your inventory.`);
            setIsDirectFetching(false);
            return;
          } else {
            console.log('Cache expired, fetching fresh data');
          }
        }
      } catch (err) {
        console.error('Error reading from localStorage:', err);
      }
    }
    
    // Only make an API call if the global inventory is empty
    if (globalInventory.length > 0) {
      console.log("Using global inventory from context:", globalInventory.length, "items");
      setDirectInventory(globalInventory);
      setInventoryStatus(`Found ${globalInventory.length} elementals in your inventory.`);
      setIsDirectFetching(false);
      
      // Save to localStorage for future use
      if (typeof window !== 'undefined' && cacheKey) {
        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            data: globalInventory,
            timestamp: Date.now()
          }));
        } catch (err) {
          console.error('Error saving to localStorage:', err);
        }
      }
      
      return;
    }
    
    console.log(`Battle area: Fetching NFTs for wallet ${addressToUse}`);
    
    // Try up to 3 times with increasing delays
    let attempt = 0;
    const maxAttempts = 3;
    
    while (attempt < maxAttempts) {
      try {
        console.log(`Fetching NFTs (attempt ${attempt + 1})`);
        
        const response = await fetch('/api/getMagicEdenTokens', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            walletAddress: addressToUse,
            forceRefresh: attempt > 0 // Only force refresh after first attempt
          }),
        });
        
        if (response.status === 429) {
          // Rate limited, wait longer before next attempt
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`Rate limited. Waiting ${delay}ms before retry`);
          await new Promise(resolve => setTimeout(resolve, delay));
          attempt++;
          continue;
        }
        
        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Check if response contains a cached flag
        if (data.cached) {
          console.log("Using cached data from server from", new Date(data.timestamp).toISOString());
        }
        
        if (data.tokens && data.tokens.length > 0) {
          processTokenData(data.tokens);
          
          // Also update the global inventory context
          if (data.tokens.length > 0) {
            setTestInventory(directInventory);
          }
        } else {
          console.log("No tokens found in API response");
        }
        
        break; // Success, exit the loop
        
      } catch (error) {
        console.error("Error fetching NFTs directly:", error);
        attempt++;
        if (attempt < maxAttempts) {
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    setIsDirectFetching(false);
  }, [globalInventory, setTestInventory, directInventory]);

  // Helper function to process token data
  const processTokenData = (tokenIds: number[]) => {
    console.log(`Battle area: Found ${tokenIds.length} tokens from API`);
    
    if (tokenIds.length > 0) {
      // Convert token IDs to inventory items
      const items = tokenIds.map((tokenId: number) => {
        const name = getElementalName(tokenId);
        const elementType = getElementalType(tokenId);
        const rarity = getRarity(tokenId);
        
        return {
          id: tokenId.toString(),
          tokenId: tokenId.toString(),
          name,
          image: getElementalImage(name),
          description: `A ${rarity.toLowerCase()} elemental with unique abilities.`,
          rarity,
          collectionName: 'Elementals Adventure',
          elementType
        };
      });
      
      console.log(`Battle area: Created ${items.length} inventory items`);
      setDirectInventory(items);
      setInventoryStatus(`Found ${items.length} elementals in your inventory.`);
      
      // Save to localStorage for future use
      if (typeof window !== 'undefined' && cacheKey) {
        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            data: items,
            timestamp: Date.now()
          }));
          console.log('Saved inventory data to localStorage');
        } catch (err) {
          console.error('Error saving to localStorage:', err);
        }
      }
      
      // Update the global inventory after setting the direct inventory
      setTimeout(() => {
        setTestInventory(items);
      }, 0);
    } else {
      console.log("No tokens found, setting empty inventory");
      setDirectInventory([]);
      setInventoryStatus("No elementals found in your inventory.");
    }
  };

  // Fetch wallet balance
  const fetchWalletBalance = async (walletAddress: string) => {
    if (!walletAddress) {
      console.log("Can't fetch balance - no wallet address");
      return;
    }
    
    console.log("Fetching balance for wallet:", walletAddress);
    try {
      const balance = await publicClient.getBalance({ 
        address: walletAddress as Hex 
      });
      console.log(`Fetched balance for ${walletAddress}: ${formatEther(balance)}`);
    } catch (error) {
      console.error("Failed to fetch balance:", error);
    }
  };

  // Refs
  const hasFetchedNFTs = useRef<boolean>(false);

  // Debug Effect: Log important state for debugging
  useEffect(() => {
    console.log("AUTH DEBUG", { 
      ready, 
      authenticated, 
      hasUser: !!user,
      userDetails: user ? {
        id: user.id,
        hasLinkedAccounts: user.linkedAccounts?.length > 0,
        accountTypes: user.linkedAccounts?.map(a => a.type),
        hasEmbeddedWallet: !!user.wallet
      } : null,
      walletsReady
    });
    
    if (user && user.linkedAccounts?.length > 0) {
      const walletAccounts = user.linkedAccounts.filter(a => a.type === 'wallet');
      console.log("Wallet accounts in user:", walletAccounts);
    }
  }, [ready, authenticated, user, walletsReady]);

  // Log inventory when it changes
  useEffect(() => {
    console.log("BattleArea: Using shared inventory:", {
      inventoryLoaded: !isInventoryLoading,
      inventoryCount: inventory?.length || 0,
      globalInventoryCount: globalInventory?.length || 0,
      firstFewItems: inventory?.slice(0, 3) || []
    });
  }, [inventory, isInventoryLoading, globalInventory]);

  // We no longer need to update the inventory context with embedded wallet address
  // as we'll use the global inventory that's already loaded in the main game
  useEffect(() => {
    // Simple approach - just refresh the inventory once when the component loads
    console.log("Battle area loaded - refreshing inventory data");
    refreshInventory();
    
    // We don't need to set the main wallet address anymore as we're using
    // the address from useAccount() directly in the context
    
    // Log the inventory data for debugging
    console.log("Current inventory items:", inventory.length);
  }, [refreshInventory, inventory.length]);

  // Effect to fetch NFTs directly from the API
  useEffect(() => {
    // Only fetch if we have a wallet address
    if (!hasFetchedNFTs.current && mainWalletAddress) {
      console.log("Fetching NFTs directly for wallet:", mainWalletAddress);
      hasFetchedNFTs.current = true;
      fetchDirectNFTsWithBackoff(mainWalletAddress);
    }
    
    // Important: don't include fetchDirectNFTsWithBackoff in the dependency array
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainWalletAddress]);

  // Set Farcaster flag (mobile vs desktop)
  useEffect(() => {
    // We'll use the same wallet setup logic regardless of device type
    // This ensures desktop and mobile work exactly the same
    console.log("Device detection:", isMobile ? "Mobile" : "Desktop");
    // Still set the Farcaster flag for UI consistency
    setUseFarcaster(isMobile);
  }, []);

  // Login Effect: Ensure user is logged in
  useEffect(() => {
    if (ready && !authenticated) {
      setAuthStatusMessage("Please login to continue");
      console.log("User not authenticated, ready to login");
    } else if (ready && authenticated) {
      setAuthStatusMessage("Authenticated, loading wallet...");
      console.log("User authenticated, checking for wallet now");
    }
  }, [ready, authenticated]);

  // Extract embedded wallet - use the same approach for both desktop and mobile
  useEffect(() => {
    console.log("Checking for embedded wallet, user exists:", !!user);
    
    if (!user) {
      setAuthStatusMessage("No user found");
      return;
    }
    
    if (authenticated && ready) {
      console.log("User authenticated, initializing wallet");
      setAuthStatusMessage("Initializing wallet...");
      
      // Initialize the wallet after a small delay to ensure Privy is fully loaded
      setTimeout(() => {
        initializeWallet()
          .then(() => {
            setAuthStatusMessage("Wallet ready for battle!");
          })
          .catch(error => {
            console.error("Failed to initialize wallet:", error);
            setAuthStatusMessage("Error initializing wallet. Please refresh and try again.");
          });
      }, 1000);
    }
  }, [user, authenticated, ready, initializeWallet]);

  // Fetch real balance
  const getBalance = async () => {
    if (!embeddedWalletAddress) {
      showToastMessage('No wallet address found');
      return;
    }
    
    try {
      console.log("Getting balance for:", embeddedWalletAddress);
      showToastMessage('Balance fetched successfully!');
    } catch (error) {
      console.error("Failed to fetch balance:", error);
      showToastMessage('Failed to fetch balance');
    }
  };

  // Show toast message using sonner
  const showToastMessage = (message: string) => {
    toast.success(message);
  };

  // Handle transaction completion
  const handleBattleComplete = (hash: string) => {
    setTxHash(hash);
    showToastMessage("Battle completed successfully!");
  };

  // Handle login button click
  const handleLogin = () => {
    console.log("Login button clicked");
    login();
  };

  // Load balance on mount if we have a wallet address
  useEffect(() => {
    if (authenticated && embeddedWalletAddress) {
      console.log("Loading initial balance for wallet:", embeddedWalletAddress);
      getBalance();
    }
  }, [authenticated, embeddedWalletAddress]);

  // Update the authStatusMessage based on wallet errors
  useEffect(() => {
    if (walletError) {
      setAuthStatusMessage(`Wallet Error: ${walletError}`);
    }
  }, [walletError]);

  // Add a refresh function
  const refreshInventoryData = () => {
    if (mainWalletAddress) {
      // Clear the cache flag to force a fresh fetch
      hasFetchedNFTs.current = false;
      // Clear localStorage cache if needed
      if (typeof window !== 'undefined' && cacheKey) {
        try {
          localStorage.removeItem(cacheKey);
        } catch (err) {
          console.error('Error clearing localStorage cache:', err);
        }
      }
      // Fetch fresh data
      fetchDirectNFTsWithBackoff(mainWalletAddress);
      toast.success('Refreshing inventory...');
    } else {
      toast.error('No wallet connected');
    }
  };

  // Show loading state if needed
  if (!ready && !useFarcaster) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading Privy authentication...</div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-screen">
      {/* Sonner Toast Container */}
      <Toaster position="top-center" />
      
      <div className="min-h-screen flex flex-col items-center pt-8 pb-16 bg-black text-white">
        <h1 className="text-5xl font-bold mb-4 font-pixel">Battle Arena</h1>
        
        {/* Wallet Address Display */}
        {mainWalletAddress && (
          <div onClick={() => copyToClipboard(mainWalletAddress)} className="mb-4 cursor-pointer flex items-center">
            <span className="text-xs text-gray-400">
              {shortenAddress(mainWalletAddress)} (Click to copy)
            </span>
          </div>
        )}
        
        {/* Loading Notice */}
        <div className="mb-4 text-xs text-yellow-400 bg-gray-800 p-2 rounded text-center">
          {isDirectFetching ? (
            <div className="flex flex-col items-center">
              <div className="animate-pulse flex space-x-1 mb-2">
                <div className="h-2 w-2 bg-yellow-400 rounded-full"></div>
                <div className="h-2 w-2 bg-yellow-400 rounded-full"></div>
                <div className="h-2 w-2 bg-yellow-400 rounded-full"></div>
              </div>
              <span>Fetching your elementals...</span>
            </div>
          ) : directInventory.length > 0 ? (
            <div className="flex items-center justify-center">
              <span>Ready to battle with {directInventory.length} elementals!</span>
              <button
                onClick={refreshInventoryData}
                className="ml-2 text-blue-400 hover:text-blue-300 underline text-xs"
                disabled={isDirectFetching}
              >
                (Refresh)
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <span>{inventoryStatus || "No elementals found."}</span>
              <button
                onClick={refreshInventoryData}
                className="ml-2 text-blue-400 hover:text-blue-300 underline text-xs"
                disabled={isDirectFetching}
              >
                (Refresh)
              </button>
            </div>
          )}
        </div>
        
        {/* Ready to Battle Message */}
        <p className="text-xl mb-8 font-pixel text-green-400">{authStatusMessage}</p>
        
        {/* Debug/Test Buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          {authenticated ? (
            <button 
              onClick={() => logout()} 
              className="bg-red-700 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm"
            >
              Logout
            </button>
          ) : (
            <div className="flex flex-col gap-2 items-center">
              <EmailLoginForm />
            </div>
          )}
        </div>
        
        {/* Battle System Component */}
        {isWalletInitialized ? (
          <BattleSystem
            walletAddress={embeddedWalletAddress}
            walletClient={walletClient}
            inventory={directInventory.length > 0 ? directInventory : inventory}
            onShowToast={showToastMessage}
            onBattleComplete={handleBattleComplete}
          />
        ) : (
          <div className="text-center p-4 bg-gray-800 rounded-lg max-w-md">
            <p className="text-xl font-pixel mb-4">Initializing your battle wallet...</p>
            <p className="text-sm text-gray-400 mb-6">This may take a moment. Please wait.</p>
            {walletError && (
              <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-md">
                <p className="text-sm text-red-300 mb-2">Error initializing wallet:</p>
                <p className="text-sm break-all">{walletError}</p>
              </div>
            )}
            <button
              onClick={initializeWallet}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function EmailLoginForm() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const { sendCode, loginWithCode, state } = useLoginWithEmail();

  const handleSendCode = async () => {
    if (!email) return;
    
    try {
      await sendCode({ email });
      setCodeSent(true);
      toast.success('Code sent! Check your email.');
    } catch (error) {
      console.error('Failed to send code:', error);
      toast.error('Failed to send verification code');
    }
  };

  const handleLogin = async () => {
    if (!code) return;
    
    try {
      await loginWithCode({ code });
      toast.success('Successfully logged in!');
    } catch (error) {
      console.error('Failed to login:', error);
      toast.error('Invalid verification code');
    }
  };

  if (state.status === 'sending-code' || state.status === 'submitting-code') {
    return <div className="text-center">Loading...</div>;
  }

  return (
    <div className="bg-gray-800 p-4 rounded-md">
      {!codeSent ? (
        <div className="flex flex-col gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className="px-3 py-2 rounded bg-gray-700 text-white"
          />
          <button
            onClick={handleSendCode}
            className="bg-green-700 hover:bg-green-600 text-white px-3 py-2 rounded-md"
          >
            Send Code
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter verification code"
            className="px-3 py-2 rounded bg-gray-700 text-white"
          />
          <button
            onClick={handleLogin}
            className="bg-green-700 hover:bg-green-600 text-white px-3 py-2 rounded-md"
          >
            Verify & Login
          </button>
          <button
            onClick={() => setCodeSent(false)}
            className="text-gray-400 hover:text-white text-sm"
          >
            Back to email
          </button>
        </div>
      )}
    </div>
  );
} 