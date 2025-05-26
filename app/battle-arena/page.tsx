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
    isInitialized, 
    isLoading,
    isCreatingWallet,
    error: walletError,
    walletsReady,
    walletsCount,
    authenticated: walletAuthenticated,
    initializeWallet, 
    createNewEmbeddedWallet,
    fetchWalletBalance,
    sendTestTransaction,
    walletClient
  } = usePrivyWallet();

  // Get the main wallet address from wagmi
  const { address: mainWalletAddress } = useAccount();

  // Get user inventory from the shared context
  const { 
    inventory, 
    isLoading: isInventoryLoading, 
    refreshInventory, 
    globalInventory, 
    setMainWalletAddress, 
    setTestInventory 
  } = useInventory();
  
  // Loading state for the NFT inventory
  const [isDirectFetching, setIsDirectFetching] = useState<boolean>(false);
  const [inventoryStatus, setInventoryStatus] = useState<string>('');
  
  // UI state
  const [txHash, setTxHash] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [authStatusMessage, setAuthStatusMessage] = useState<string>("");
  
  // Tracking for inventory fetch attempts
  const inventoryFetchAttempt = useRef<number>(0);
  const maxInventoryFetchAttempts = 3;
  
  // Initialize wallet when authenticated
  useEffect(() => {
    if (authenticated && ready && !isInitialized && !isLoading) {
      console.log("User authenticated, initializing wallet");
      // Add a delay to ensure Privy is fully loaded before initializing wallet
      setTimeout(() => {
        initializeWallet();
      }, 1500);
    }
  }, [authenticated, ready, isInitialized, isLoading, initializeWallet]);
  
  // Update the authStatusMessage based on wallet errors - don't show errors to users
  useEffect(() => {
    if (walletError) {
      console.log(`Wallet Error: ${walletError}`);
      // Don't update the status message with errors
    }
  }, [walletError]);

  // Update auth status message when wallet is initialized
  useEffect(() => {
    if (isInitialized) {
      setAuthStatusMessage("Ready to battle!");
    }
  }, [isInitialized]);
  
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

  // Helper function to fetch NFTs from the API
  const fetchInventoryData = useCallback(async () => {
    if (inventoryFetchAttempt.current >= maxInventoryFetchAttempts) {
      console.log("Max fetch attempts reached, using whatever data we have");
      setInventoryStatus("Unable to fetch inventory data. Using available NFTs.");
      return;
    }
    
    // IMPORTANT: We're using the main wallet address for the test app
    const MAIN_WALLET = "0x51F5c253BFFd38EAb69450C7Cad623a28b82A4E4";
    
    try {
      setIsDirectFetching(true);
      setInventoryStatus("Fetching your elementals...");
      inventoryFetchAttempt.current += 1;
      
      console.log(`Fetching inventory data (attempt ${inventoryFetchAttempt.current})`);
      
      // If we already have global inventory data, don't make another API call
      if (globalInventory.length > 0) {
        console.log("Using existing global inventory data:", globalInventory.length, "items");
        setInventoryStatus(`Found ${globalInventory.length} elementals in your inventory.`);
        setIsDirectFetching(false);
        return;
      }
      
      // Otherwise proceed with API call
      const response = await fetch('/api/getMagicEdenTokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          walletAddress: MAIN_WALLET,
          // Only force refresh if we've tried more than once
          forceRefresh: inventoryFetchAttempt.current > 1 
        }),
      });
      
      if (response.status === 429) {
        setInventoryStatus("Rate limit exceeded. Trying again in a moment...");
        
        // Wait longer between retries based on attempt number
        const delay = Math.pow(2, inventoryFetchAttempt.current) * 1000;
        console.log(`Rate limited. Waiting ${delay}ms before retry`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Try again recursively
        setIsDirectFetching(false);
        fetchInventoryData();
        return;
      }
      
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.cached) {
        console.log("Using cached data from server from", new Date(data.timestamp).toISOString());
      }
      
      if (data.rateLimited) {
        setInventoryStatus("Rate limited by API. Using cached data.");
      }
      
      if (data.tokens && data.tokens.length > 0) {
        // Process the token data into inventory items
        const items = data.tokens.map((tokenId: number) => {
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
        
        console.log(`Created ${items.length} inventory items from token IDs`);
        
        // Update the global inventory
        setTestInventory(items);
        setInventoryStatus(`Found ${items.length} elementals in your inventory.`);
      } else {
        console.log("No tokens found in API response");
        setInventoryStatus("No elementals found in your inventory.");
      }
      
    } catch (error) {
      console.error("Error fetching inventory:", error);
      setInventoryStatus("Error fetching inventory. Please try again later.");
      
      // Try again with exponential backoff if we haven't reached max attempts
      if (inventoryFetchAttempt.current < maxInventoryFetchAttempts) {
        const delay = Math.pow(2, inventoryFetchAttempt.current) * 1000;
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        setIsDirectFetching(false);
        fetchInventoryData();
        return;
      }
    } finally {
      setIsDirectFetching(false);
    }
  }, [globalInventory, setTestInventory]);

  // Effect to fetch inventory when component mounts
  useEffect(() => {
    if (authenticated && ready) {
      console.log("Authenticated and ready - fetching inventory data");
      fetchInventoryData();
    }
  }, [authenticated, ready, fetchInventoryData]);

  // Log inventory when it changes
  useEffect(() => {
    console.log("Inventory data updated:", {
      globalInventoryItems: globalInventory.length,
      contextInventoryItems: inventory.length,
      isLoading: isInventoryLoading
    });
    
    if (inventory.length > 0 && inventoryStatus === '') {
      setInventoryStatus(`Found ${inventory.length} elementals in your inventory.`);
    }
  }, [inventory, globalInventory, isInventoryLoading, inventoryStatus]);
  
  // Handle login click
  const handleLogin = () => {
    login();
  };
  
  // Handle logout click
  const handleLogout = () => {
    logout();
  };
  
  // Create a new embedded wallet
  const handleCreateWallet = async () => {
    try {
      setError('');
      const success = await createNewEmbeddedWallet();
      if (!success) {
        setError('Wallet creation failed or was cancelled');
      }
    } catch (err) {
      setError(`Failed to create wallet: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  
  // Refresh wallet balance
  const handleRefreshBalance = async () => {
    if (!embeddedWalletAddress) {
      toast.error('No wallet address available');
      return;
    }
    
    try {
      setError('');
      await fetchWalletBalance(embeddedWalletAddress);
      toast.success('Balance refreshed');
    } catch (err) {
      setError(`Failed to refresh balance: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  
  // Send a test transaction
  const handleSendTestTransaction = async () => {
    try {
      setError('');
      setTxHash('');
      const hash = await sendTestTransaction();
      setTxHash(hash);
    } catch (err) {
      setError(`Transaction failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };
  
  // Get short version of address for display
  const formatAddress = (address: string): string => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };
  
  // Copy address to clipboard
  const copyToClipboard = (address: string) => {
    navigator.clipboard.writeText(address);
    toast.success('Address copied to clipboard!');
  };
  
  // List all available wallets
  const renderWalletList = () => {
    if (!wallets || wallets.length === 0) {
      return <p className="text-gray-500 text-sm">No wallets available</p>;
    }
    
    // Filter to only show main wallets (phantom, metamask) and privy wallets
    const filteredWallets = wallets.filter(wallet => 
      wallet.walletClientType === 'privy' || 
      wallet.walletClientType === 'phantom' || 
      wallet.walletClientType === 'metamask'
    );
    
    return (
      <div className="mt-6 bg-gray-900 rounded-lg border border-gray-800">
        <h3 className="text-2xl font-pixel text-white mb-2 p-3">Your Wallets</h3>
        <ul className="space-y-1">
          {filteredWallets.map((wallet, index) => {
            // Determine wallet type for better display
            const isMainWallet = wallet.walletClientType !== 'privy';
            const isActive = wallet.address === embeddedWalletAddress;
            const walletType = isMainWallet ? 'Main Wallet' : 'Embedded Wallet';
            
            // Different icons based on wallet type
            let walletIcon = '🔑';
            if (wallet.walletClientType === 'phantom') walletIcon = '🦊';
            if (wallet.walletClientType === 'metamask') walletIcon = '🦊';
            
            return (
              <li key={index} className={`p-4 border-t border-gray-800 ${isActive ? 'border-l-4 border-l-green-500' : ''}`}>
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <span className="text-xl">{walletIcon}</span>
                    <span className="font-pixel text-white capitalize">
                      {wallet.walletClientType}
                      {isActive && <span className="ml-2 text-xs bg-green-600 px-2 py-0.5 rounded-full">Active</span>}
                    </span>
                  </div>
                  <span className="text-gray-400 text-sm">{walletType}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <div className="text-gray-400">{formatAddress(wallet.address)}</div>
                  <button 
                    onClick={() => copyToClipboard(wallet.address)}
                    className="bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded text-sm"
                  >
                    Copy
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  // Add test NFTs to inventory
  const addTestNFTs = () => {
    const testNFTs = [
      { id: '1', tokenId: '1', name: 'Rhoxodon', image: '/assets/Rhoxodon.gif', description: 'A uncommon elemental with unique abilities.', rarity: 'Uncommon', collectionName: 'Elementals Adventure', elementType: 'earth' },
      { id: '2', tokenId: '2', name: 'Nactivyx', image: '/assets/Nactivyx.gif', description: 'A common elemental with unique abilities.', rarity: 'Common', collectionName: 'Elementals Adventure', elementType: 'water' },
      { id: '3', tokenId: '3', name: 'Infermor', image: '/assets/Infermor.gif', description: 'A epic elemental with unique abilities.', rarity: 'Epic', collectionName: 'Elementals Adventure', elementType: 'fire' },
      { id: '4', tokenId: '4', name: 'Emberith', image: '/assets/Emberith.gif', description: 'A legendary elemental with unique abilities.', rarity: 'Legendary', collectionName: 'Elementals Adventure', elementType: 'fire' },
      { id: '5', tokenId: '5', name: 'Nyxar', image: '/assets/Nyxar.gif', description: 'A ultra rare elemental with unique abilities.', rarity: 'Ultra Rare', collectionName: 'Elementals Adventure', elementType: 'air' },
    ];
    setTestInventory(testNFTs);
    setInventoryStatus(`Found ${testNFTs.length} elementals in your inventory (demo NFTs).`);
    toast.success('Test NFTs added to inventory!');
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

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <Toaster position="top-center" />
      
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-pixel text-center mb-8 text-white">Battle Arena</h1>
        
        <div className="grid grid-cols-1 gap-6">
          {/* Embedded Wallet - Now First */}
          <div>
            <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
              <h2 className="text-xl font-pixel mb-3">Embedded Wallet</h2>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-1">
                  <p className="text-gray-400 text-sm">Status:</p>
                  <p className={isInitialized ? "text-green-400" : "text-yellow-400"}>
                    {isInitialized ? "Initialized" : isLoading ? "Initializing..." : "Not Initialized"}
                  </p>
                </div>
                <div className="col-span-1">
                  <p className="text-gray-400 text-sm">Balance:</p>
                  <p className="text-sm">{balance} MONAD</p>
                </div>
                <div className="col-span-2 mt-2">
                  <p className="text-gray-400 text-sm">Active Wallet:</p>
                  {embeddedWalletAddress ? (
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm break-all">{formatAddress(embeddedWalletAddress)}</span>
                      <button 
                        onClick={() => copyToClipboard(embeddedWalletAddress)}
                        className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-gray-300 ml-2"
                      >
                        Copy
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-red-400">No wallet address</p>
                  )}
                </div>
              </div>
              
              {/* Gas Fee Message */}
              <div className="mt-4 p-3 bg-yellow-800/30 border border-yellow-700/50 rounded-md">
                <p className="text-yellow-400 text-sm flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Please send at least 0.5 MONAD to your embedded wallet for battle game gas fees
                </p>
              </div>
            </div>
          </div>
          
          {/* Battle System - Now Second */}
          <div>
            <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
              <h2 className="text-xl font-pixel mb-4">Battle System</h2>
              
              {/* Ready to Battle Message */}
              <p className="text-lg mb-4 text-green-400">{authStatusMessage}</p>
              
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
                ) : inventoryStatus ? (
                  <span>{inventoryStatus}</span>
                ) : (
                  <span>Inventory may load slowly. Please be patient while we fetch your elementals.</span>
                )}
              </div>
              
              {/* Battle System Component */}
              {isInitialized ? (
                <BattleSystem
                  walletAddress={embeddedWalletAddress}
                  walletClient={walletClient}
                  inventory={inventory}
                  onShowToast={showToastMessage}
                  onBattleComplete={handleBattleComplete}
                />
              ) : (
                <div className="text-center p-4 bg-gray-800 rounded-lg">
                  <p className="text-xl mb-4">Initializing your battle wallet...</p>
                  <p className="text-sm text-gray-400 mb-6">This may take a moment. Please wait.</p>
                  <button
                    onClick={initializeWallet}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
                  >
                    Retry
                  </button>
                </div>
              )}
              
              {/* Transaction Result */}
              {txHash && (
                <div className="mt-4 p-3 bg-gray-700 rounded-md">
                  <p className="text-sm text-gray-300 mb-1">Transaction:</p>
                  <div className="text-sm">{formatTxLink(txHash)}</div>
                </div>
              )}
            </div>
          </div>
          
          {/* Authentication */}
          <div>
            <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
              <h2 className="text-xl font-pixel mb-3">Authentication</h2>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-1">
                  <p className="text-gray-400 text-sm">Authenticated:</p>
                  <p className={authenticated ? "text-green-400" : "text-red-400"}>
                    {authenticated ? "Yes" : "No"}
                  </p>
                </div>
                <div className="col-span-1">
                  <p className="text-gray-400 text-sm">Privy Ready:</p>
                  <p className={ready ? "text-green-400" : "text-yellow-400"}>
                    {ready ? "Yes" : "Loading..."}
                  </p>
                </div>
                <div className="col-span-2 mt-2">
                  <p className="text-gray-400 text-sm">User ID:</p>
                  <p className="text-sm truncate">{user?.id || "Not logged in"}</p>
                </div>
              </div>
              
              <div className="mt-4 flex space-x-4">
                {authenticated ? (
                  <button 
                    onClick={handleLogout} 
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
            </div>
          </div>
          
          {/* Your Wallets */}
          {authenticated && renderWalletList()}
        </div>
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
    return (
      <div className="bg-gray-800 p-4 rounded-md">
        <div className="flex justify-center items-center py-2">
          <div className="animate-pulse flex space-x-1">
            <div className="h-2 w-2 bg-blue-400 rounded-full"></div>
            <div className="h-2 w-2 bg-blue-400 rounded-full"></div>
            <div className="h-2 w-2 bg-blue-400 rounded-full"></div>
          </div>
        </div>
        <p className="text-center text-sm">Processing...</p>
      </div>
    );
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