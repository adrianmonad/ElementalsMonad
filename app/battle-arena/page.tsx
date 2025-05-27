"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePrivy, useWallets, useLoginWithEmail } from '@privy-io/react-auth';
import { formatEther, parseEther, Hex } from 'viem';
import { Toaster, toast } from 'sonner';
import { usePrivyWallet } from '@/hooks/usePrivyWallet';
import { useInventory } from '@/lib/InventoryContext';
import { useAccount } from 'wagmi';
import BattleSystem from '@/components/Game/BattleSystem';

export default function BattleArena() {
  // Privy authentication state
  const { login, logout, authenticated, ready, user } = usePrivy();
  const { wallets } = useWallets();
  
  // Our custom Privy wallet hook
  const { 
    embeddedWalletAddress, 
    balance, 
    isInitialized: isWalletInitialized,
    isLoading: isWalletLoading,
    walletClient,
    error: walletError,
    walletsReady,
    walletsCount,
    authenticated: walletAuthenticated,
    initializeWallet, 
    createNewEmbeddedWallet,
    sendRawTransaction
  } = usePrivyWallet();

  // Get the main wallet address from wagmi
  const { address } = useAccount();

  // Get user inventory from the shared context
  const { 
    inventory, 
    isLoading: isInventoryLoading, 
    refreshInventory, 
    globalInventory, 
    setMainWalletAddress, 
    setTestInventory 
  } = useInventory();
  
  // Direct NFT fetching for battle area
  const [directInventory, setDirectInventory] = useState<any[]>([]);
  const [isDirectFetching, setIsDirectFetching] = useState<boolean>(false);
  const [inventoryStatus, setInventoryStatus] = useState<string>("");
  
  // Cache reference to avoid duplicate API calls
  const localStorageCacheKey = address ? `battle_arena_inventory_${address}` : null;
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // UI state
  const [txHash, setTxHash] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [authStatusMessage, setAuthStatusMessage] = useState<string>("");
  
  // State to track if address was copied
  const [addressCopied, setAddressCopied] = useState(false);
  
  // Reference to track fetch attempts
  const inventoryFetchAttempt = useRef<number>(0);
  const maxInventoryFetchAttempts = 3;
  
  // Initialize wallet when authenticated
  useEffect(() => {
    if (authenticated && ready && !isWalletInitialized && !isWalletLoading) {
      console.log("User authenticated, initializing wallet");
      // Add a delay to ensure Privy is fully loaded before initializing wallet
      setTimeout(() => {
        initializeWallet();
      }, 1500);
    }
  }, [authenticated, ready, isWalletInitialized, isWalletLoading, initializeWallet]);
  
  // Update the authStatusMessage based on wallet errors - don't show errors to users
  useEffect(() => {
    if (walletError) {
      console.log(`Wallet Error: ${walletError}`);
      // Don't update the status message with errors
    }
  }, [walletError]);

  // Update auth status message when wallet is initialized
  useEffect(() => {
    if (isWalletInitialized) {
      setAuthStatusMessage("Ready to battle!");
    }
  }, [isWalletInitialized]);
  
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
      
      // Save to localStorage for future visits
      if (typeof window !== 'undefined' && localStorageCacheKey) {
        try {
          localStorage.setItem(localStorageCacheKey, JSON.stringify({
            items,
            timestamp: Date.now()
          }));
          console.log(`Saved battle arena inventory to localStorage: ${items.length} items`);
        } catch (err) {
          console.error('Failed to save inventory to localStorage:', err);
        }
      }
    } else {
      console.log("No tokens found, setting empty inventory");
      setDirectInventory([]);
      setInventoryStatus("No elementals found in your inventory.");
    }
  };

  // Helper function to fetch NFTs from the API
  const fetchInventoryData = useCallback(async () => {
    if (inventoryFetchAttempt.current >= maxInventoryFetchAttempts) {
      console.log("Max fetch attempts reached, using whatever data we have");
      setInventoryStatus("Unable to fetch inventory data. Using available NFTs.");
      return;
    }
    
    // Use the connected wallet address instead of hard-coded test wallet
    if (!address) {
      console.log("No wallet address available, cannot fetch inventory");
      setInventoryStatus("Please connect your wallet to view your elementals.");
      setIsDirectFetching(false);
      return;
    }

    // Clear any existing timeout to prevent duplicate fetches
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = null;
    }
    
    // Check localStorage first
    if (typeof window !== 'undefined' && localStorageCacheKey) {
      try {
        const cached = localStorage.getItem(localStorageCacheKey);
        if (cached) {
          const { items, timestamp } = JSON.parse(cached);
          const cacheAge = Date.now() - timestamp;
          const cacheTTL = 5 * 60 * 1000; // 5 minutes cache
          
          if (cacheAge < cacheTTL && items && items.length > 0) {
            console.log(`Using cached inventory (${Math.round(cacheAge/1000)}s old)`);
            setDirectInventory(items);
            setInventoryStatus(`Found ${items.length} elementals in your inventory.`);
            
            // Still trigger a refresh in the background but with a delay
            fetchTimeoutRef.current = setTimeout(() => {
              console.log("Background refresh of inventory data");
              makeAPICall();
            }, 3000);
            
            return;
          }
        }
      } catch (err) {
        console.error("Error reading from localStorage:", err);
      }
    }
    
    // If no cache or expired, fetch directly
    makeAPICall();
    
    // Function to make the actual API call
    async function makeAPICall() {
      setIsDirectFetching(true);
      inventoryFetchAttempt.current++;
      
      try {
        console.log(`Fetching NFTs for wallet ${address}, attempt ${inventoryFetchAttempt.current}`);
        
        const response = await fetch('/api/getMagicEdenTokens', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            walletAddress: address,
            forceRefresh: inventoryFetchAttempt.current > 1
          }),
          // Add a longer timeout for the fetch
          signal: AbortSignal.timeout(30000)
        });
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.tokens && Array.isArray(data.tokens)) {
          processTokenData(data.tokens);
        } else {
          console.error("Invalid response format:", data);
          setInventoryStatus("Error loading NFTs. Invalid data format.");
        }
      } catch (err) {
        console.error("Error fetching NFTs:", err);
        setInventoryStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        
        // Retry with exponential backoff
        if (inventoryFetchAttempt.current < maxInventoryFetchAttempts) {
          const backoffDelay = Math.pow(2, inventoryFetchAttempt.current) * 1000;
          console.log(`Will retry in ${backoffDelay}ms...`);
          
          fetchTimeoutRef.current = setTimeout(() => {
            fetchInventoryData();
          }, backoffDelay);
        }
      } finally {
        setIsDirectFetching(false);
      }
    }
  }, [address, localStorageCacheKey]);

  // Effect to fetch inventory when component mounts
  useEffect(() => {
    console.log("Battle arena mounted, fetching inventory data");
    fetchInventoryData();
    
    // Also refresh the main inventory context once
    refreshInventory();
    
    // Clean up timeouts on unmount
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = null;
      }
    };
  }, [fetchInventoryData, refreshInventory]);
  
  // Get short version of address for display
  const formatAddress = (address: string): string => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };
  
  // Copy address to clipboard
  const copyToClipboard = (address: string) => {
    navigator.clipboard.writeText(address)
      .then(() => {
        setAddressCopied(true);
        toast.success('Address copied to clipboard!');
        
        // Reset copied state after 2 seconds
        setTimeout(() => {
          setAddressCopied(false);
        }, 2000);
      })
      .catch(err => {
        console.error("Failed to copy address:", err);
        toast.error("Failed to copy address");
      });
  };
  
  // List all available wallets
  const renderWalletList = () => {
    if (!wallets || wallets.length === 0) {
      return null;
    }
    
    return (
      <div className="mt-4">
        <h3 className="text-lg font-pixel mb-2">Available Wallets:</h3>
        <ul className="list-disc list-inside text-sm space-y-1 pl-1">
          {wallets.map((wallet) => (
            <li key={wallet.address} className="truncate">
              <span className="text-[var(--ro-gold)]">{wallet.walletClientType}:</span>{' '}
              {formatAddress(wallet.address)}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  // Show toast message using sonner
  const showToastMessage = (message: string, transactionHash?: string) => {
    if (transactionHash) {
      // If we have a transaction hash, show a toast with the message and then separate transaction link
      toast.success(message);
      
      // Then show a separate toast with the transaction link
      toast.success(
        `View transaction: ${transactionHash.substring(0, 6)}...${transactionHash.substring(transactionHash.length - 4)}`,
        {
          action: {
            label: "View",
            onClick: () => window.open(`https://testnet.monadexplorer.com/tx/${transactionHash}`, '_blank')
          }
        }
      );
    } else {
      // Regular toast without a transaction hash
      toast.success(message);
    }
  };

  // Handle transaction completion
  const handleBattleComplete = (hash: string) => {
    setTxHash(hash);
    // Don't show a toast here - the BattleSystem component already shows one for each attack
    // This prevents duplicate notifications
  };

  // Format transaction hash as a link to explorer
  const formatTxLink = (hash: string): JSX.Element => {
    const explorerUrl = `https://testnet.monadexplorer.com/tx/${hash}`;
    return (
      <a 
        href={explorerUrl}
        target="_blank" 
        rel="noopener noreferrer"
        className="text-blue-400 hover:text-blue-300 underline break-all"
      >
        {hash}
      </a>
    );
  };

  // Add a function to refresh the balance
  const refreshBalance = async () => {
    if (embeddedWalletAddress) {
      try {
        toast.info('Refreshing wallet balance...');
        await initializeWallet(); // This should refresh the balance
      } catch (err) {
        console.error('Error refreshing balance:', err);
        toast.error('Failed to refresh balance');
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center pt-8 pb-16 bg-black text-white">
      <h1 className="text-5xl font-bold mb-4 font-pixel">Battle Arena</h1>
      
      {/* Wallet Address Display */}
      {address && (
        <div className="mb-4 flex items-center space-x-2">
          <span className="text-xs text-gray-400">
            {formatAddress(address)}
          </span>
          <button
            onClick={() => copyToClipboard(address)}
            className="px-1.5 py-0.5 text-xs bg-[var(--ro-gold)] text-black rounded hover:bg-yellow-300 transition-colors"
            title="Copy wallet address"
          >
            {addressCopied ? "✓" : "📋"}
          </button>
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
              onClick={() => {
                inventoryFetchAttempt.current = 0;
                fetchInventoryData();
              }} 
              className="ml-2 text-blue-400 hover:text-blue-300 underline text-xs"
              disabled={isDirectFetching}
            >
              Refresh
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <span>{inventoryStatus || "No elementals found in your inventory."}</span>
            <button 
              onClick={() => {
                inventoryFetchAttempt.current = 0;
                fetchInventoryData();
              }} 
              className="ml-2 text-blue-400 hover:text-blue-300 underline text-xs"
              disabled={isDirectFetching}
            >
              Retry
            </button>
          </div>
        )}
      </div>
      
      {/* Ready to Battle Message */}
      <p className="text-xl mb-8 font-pixel text-green-400">{authStatusMessage}</p>
      
      {/* Wallet Information Section */}
      {isWalletInitialized && embeddedWalletAddress && (
        <div className="w-full max-w-md mb-6 p-4 bg-[var(--ro-panel-bg)] rounded-lg shadow-lg border-2 border-[var(--ro-gold)]">
          <h3 className="text-lg font-pixel mb-3 text-center text-[var(--ro-gold)]">BATTLE WALLET</h3>
          
          <div className="flex flex-col gap-2">
            <div className="w-full flex flex-row justify-between items-center">
              <span className="text-sm text-[var(--ro-gold)]">Address:</span>
              <div className="flex items-center">
                <span className="font-mono text-xs text-[var(--ro-gold)]">{formatAddress(embeddedWalletAddress)}</span>
                <button 
                  onClick={() => copyToClipboard(embeddedWalletAddress)}
                  className="ml-2 px-1.5 py-0.5 text-xs bg-[var(--ro-gold)] text-black rounded hover:bg-yellow-300 transition-colors"
                  title="Copy wallet address"
                >
                  {addressCopied ? "✓" : "📋"}
                </button>
              </div>
            </div>
            
            <div className="w-full flex flex-row justify-between items-center">
              <span className="text-sm text-[var(--ro-gold)]">Balance:</span>
              <div className="flex items-center">
                <span className="font-mono text-xs text-[var(--ro-gold)]">
                  {balance ? `${parseFloat(balance).toFixed(4)} MON` : "Loading..."}
                </span>
                <button
                  onClick={refreshBalance}
                  className="ml-2 px-1.5 py-0.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors"
                  title="Refresh balance"
                >
                  🔄
                </button>
              </div>
            </div>
            
            <div className="mt-3 p-3 bg-gray-800 rounded-md">
              <p className="text-xs text-yellow-400 mb-2">
                ⚠️ This wallet needs gas to perform battle transactions.
              </p>
              <p className="text-xs text-white">
                Please send at least <span className="text-[var(--ro-gold)] font-semibold">0.5 MON</span> to this address to play.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Authentication Buttons */}
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
      
      {/* Toast Container */}
      <Toaster position="top-center" />
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
      toast.info('Sending verification code...');
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
      toast.info('Verifying code...');
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