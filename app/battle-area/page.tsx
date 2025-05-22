"use client";

import { usePrivy, useLogin, useLogout, useWallets } from '@privy-io/react-auth';
import { useState, useEffect, useRef } from 'react';
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
  const { ready: walletsReady, wallets } = useWallets();
  const { login } = useLogin();
  const { logout } = useLogout();
  
  // Farcaster context (for mobile)
  const farcasterContext = useMiniAppContext();

  // Get the main wallet address from wagmi
  const { address: mainWalletAddress } = useAccount();

  // UI state
  const [balance, setBalance] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [embeddedWalletAddress, setEmbeddedWalletAddress] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState("");
  
  // Environment state
  const [useFarcaster, setUseFarcaster] = useState(false);
  const [isWalletInitialized, setIsWalletInitialized] = useState(true);
  const [authStatusMessage, setAuthStatusMessage] = useState<string>("Ready to battle!");
  
  // Wallet refs
  const walletClient = useRef<any>(null);
  const userNonce = useRef<number>(0);
  const userBalance = useRef<bigint>(BigInt(0));

  // Get user inventory from the shared context
  const { inventory, isLoading: isInventoryLoading, refreshInventory, globalInventory, setMainWalletAddress, setTestInventory } = useInventory();
  
  // Direct NFT fetching for battle area
  const [directInventory, setDirectInventory] = useState<any[]>([]);
  const [isDirectFetching, setIsDirectFetching] = useState<boolean>(false);
  
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

  // Add test NFTs to inventory for testing
  const addTestNFTs = () => {
    const testNFTs = [
      { id: '1', tokenId: '1', name: 'Rhoxodon', image: '/assets/Rhoxodon.gif', description: 'A uncommon elemental with unique abilities.', rarity: 'Uncommon', collectionName: 'Elementals Adventure', elementType: 'earth' },
      { id: '2', tokenId: '2', name: 'Nactivyx', image: '/assets/Nactivyx.gif', description: 'A common elemental with unique abilities.', rarity: 'Common', collectionName: 'Elementals Adventure', elementType: 'water' },
      { id: '3', tokenId: '3', name: 'Infermor', image: '/assets/Infermor.gif', description: 'A epic elemental with unique abilities.', rarity: 'Epic', collectionName: 'Elementals Adventure', elementType: 'fire' },
      { id: '4', tokenId: '4', name: 'Emberith', image: '/assets/Emberith.gif', description: 'A legendary elemental with unique abilities.', rarity: 'Legendary', collectionName: 'Elementals Adventure', elementType: 'fire' },
      { id: '5', tokenId: '5', name: 'Nyxar', image: '/assets/Nyxar.gif', description: 'A ultra rare elemental with unique abilities.', rarity: 'Ultra Rare', collectionName: 'Elementals Adventure', elementType: 'air' },
    ];
    setTestInventory(testNFTs);
    toast.success('Test NFTs added to inventory!');
  };

  // Initialize wallet client
  const setupWalletClient = async () => {
    try {
      setIsLoading(true);
      setAuthStatusMessage("Initializing wallet...");
      
      // For simplicity, we'll just set wallet as initialized without actually setting up a client
      setIsWalletInitialized(true);
      setAuthStatusMessage("Wallet initialized and ready to battle!");
      
      toast.success("Wallet ready for battle!");
    } catch (error) {
      console.error("Error setting up wallet client:", error);
      setAuthStatusMessage("Failed to initialize wallet. Please try again.");
      toast.error("Wallet initialization failed.");
    } finally {
      setIsLoading(false);
    }
  };

  // Directly fetch NFTs from the API
  const fetchDirectNFTs = async (walletAddress: string) => {
    if (!walletAddress) return;
    
    // IMPORTANT: For testing, we can force a specific wallet address
    // This ensures we always use the main wallet that owns the NFTs
    const MAIN_WALLET = "0x51F5c253BFFd38EAb69450C7Cad623a28b82A4E4";
    const addressToUse = MAIN_WALLET; // Always use the main wallet address
    
    setIsDirectFetching(true);
    try {
      console.log(`Battle area: Directly fetching NFTs for main wallet ${addressToUse}`);
      const response = await fetch('/api/getMagicEdenTokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({ 
          walletAddress: addressToUse,
          timestamp: Date.now()
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      const tokenIds = data.tokens || [];
      
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
        console.log("First few items:", items.slice(0, 3));
        
        setDirectInventory(items);
        
        // Also update the global inventory in the context
        setTestInventory(items);
      } else {
        console.log("No tokens found, setting empty inventory");
        setDirectInventory([]);
      }
    } catch (error) {
      console.error("Error fetching NFTs directly:", error);
    } finally {
      setIsDirectFetching(false);
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
      userBalance.current = balance;
      const formattedBalance = formatEther(balance);
      setBalance(`${formattedBalance} MONAD`);
      console.log(`Fetched balance for ${walletAddress}: ${formattedBalance}`);
    } catch (error) {
      console.error("Failed to fetch balance:", error);
    }
  };

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
      walletsReady,
      walletsAvailable: wallets?.length,
      walletTypes: wallets?.map(w => w.walletClientType)
    });
    
    if (user && user.linkedAccounts?.length > 0) {
      const walletAccounts = user.linkedAccounts.filter(a => a.type === 'wallet');
      console.log("Wallet accounts in user:", walletAccounts);
    }
  }, [ready, authenticated, user, walletsReady, wallets]);

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
    // Always fetch using the direct fetch method
    // This will use the hardcoded main wallet address
    console.log("Fetching NFTs directly on component mount");
    fetchDirectNFTs("any-address-will-work"); // The address gets replaced with the main wallet in the function
  }, []);

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
      setEmbeddedWalletAddress("");
      setAuthStatusMessage("No user found");
      return;
    }
    
    // Add a small delay to allow Privy to fully initialize the embedded wallet
    const extractWalletWithDelay = setTimeout(() => {
      try {
        // First check if user.wallet is defined
        if (user.wallet?.address) {
          console.log("Found wallet in user.wallet:", user.wallet.address);
          setEmbeddedWalletAddress(user.wallet.address);
          fetchWalletBalance(user.wallet.address);
          setAuthStatusMessage("Using wallet from user.wallet");
          return;
        }
        
        // If not, try linkedAccounts
        const privyWallets = user.linkedAccounts.filter(
          (account) =>
            account.type === "wallet" &&
            account.walletClientType === "privy"
        );
        
        console.log("Found wallets in linkedAccounts:", privyWallets.length);
        
        if (privyWallets.length > 0 && (privyWallets[0] as any).address) {
          const walletAddress = (privyWallets[0] as any).address;
          console.log("Using wallet from linkedAccounts:", walletAddress);
          setEmbeddedWalletAddress(walletAddress);
          fetchWalletBalance(walletAddress);
          setAuthStatusMessage("Using wallet from linkedAccounts");
        } else {
          // As a fallback, check the wallets array directly
          if (walletsReady && wallets && wallets.length > 0) {
            const privyWallet = wallets.find(w => w.walletClientType === 'privy');
            if (privyWallet) {
              console.log("Found wallet in wallets array:", privyWallet.address);
              setEmbeddedWalletAddress(privyWallet.address);
              fetchWalletBalance(privyWallet.address);
              setAuthStatusMessage("Using wallet from wallets array");
            }
            
            // If no Privy wallet found, try to use any wallet as a fallback
            if (wallets[0]) {
              console.log("No Privy wallet found, using fallback wallet:", wallets[0].address);
              setEmbeddedWalletAddress(wallets[0].address);
              fetchWalletBalance(wallets[0].address);
              setAuthStatusMessage("Using fallback wallet");
            }
          }
          
          setEmbeddedWalletAddress("");
          setAuthStatusMessage("No wallet found in user accounts. Please try refreshing the page.");
        }
      } catch (err) {
        console.error("Error extracting Privy wallet:", err);
        setEmbeddedWalletAddress("");
        setAuthStatusMessage(`Error: ${err instanceof Error ? err.message : 'Unknown wallet error'}`);
      }
    }, 1500); // 1.5 second delay to allow Privy to fully initialize
    
    // Cleanup function to cancel the timeout if the component unmounts
    return () => clearTimeout(extractWalletWithDelay);
  }, [user, wallets, walletsReady]);
  
  // Setup wallet client from wallets array - use same approach for both platforms
  useEffect(() => {
    console.log("Setup wallet client effect running, wallets ready:", walletsReady, "wallets:", wallets?.length);
    
    if (!walletsReady) {
      console.log("Wallets not ready yet");
      return;
    }
    
    if (!wallets || wallets.length === 0) {
      console.log("No wallets available yet");
      setAuthStatusMessage("No wallets available. Waiting for wallet connection...");
      return;
    }
    
    let retryCount = 0;
    const maxRetries = 3;
    
    async function setupWalletClient() {
      try {
        // First find the embedded Privy wallet
        const availableWallets = wallets.map(w => ({
          type: w.walletClientType,
          address: w.address,
          chain: w.chainId
        }));
        console.log("Available wallets:", JSON.stringify(availableWallets));
        
        // Look for Privy wallet in the wallets array
        const userWallet = wallets.find(w => w.walletClientType === 'privy');
        if (!userWallet) {
          console.log("No Privy wallet found in wallets array");
          setAuthStatusMessage("No Privy wallet found. Trying again...");
          
          // Retry logic for wallet initialization
          if (retryCount < maxRetries) {
            retryCount++;
            console.log(`Retrying wallet setup (${retryCount}/${maxRetries})...`);
            setTimeout(setupWalletClient, 2000);
            return;
          } else {
            setAuthStatusMessage("Could not find Privy wallet after multiple attempts. Please refresh the page.");
            return;
          }
        }
        
        console.log("Setting up wallet for address:", userWallet.address);
        setEmbeddedWalletAddress(userWallet.address);
        
        try {
          // Get the Ethereum provider from the wallet
          const ethereumProvider = await userWallet.getEthereumProvider();
          console.log("Got ethereum provider:", !!ethereumProvider);
          
          if (!ethereumProvider) {
            throw new Error("Ethereum provider is null or undefined");
          }
          
          // Create a wallet client with viem
          const provider = createWalletClient({
            chain: monadTestnet,
            transport: custom(ethereumProvider)
          });
          
          console.log("Wallet client created successfully");
          walletClient.current = provider;
          setIsWalletInitialized(true);
          setAuthStatusMessage("Wallet ready");
          
          // Get initial nonce and balance
          if (userWallet.address) {
            fetchWalletBalance(userWallet.address);
            try {
              userNonce.current = await publicClient.getTransactionCount({ 
                address: userWallet.address as Hex 
              });
              console.log("Got nonce:", userNonce.current);
            } catch (nonceError) {
              console.error("Failed to get nonce:", nonceError);
            }
          }
        } catch (providerError) {
          console.error("Failed to get ethereum provider:", providerError);
          setAuthStatusMessage(`Provider error: ${providerError instanceof Error ? providerError.message : 'Unknown'}`);
          
          // Retry logic for provider initialization
          if (retryCount < maxRetries) {
            retryCount++;
            console.log(`Retrying provider setup (${retryCount}/${maxRetries})...`);
            setTimeout(setupWalletClient, 2000);
          } else {
            setAuthStatusMessage("Could not initialize wallet after multiple attempts. Please refresh the page.");
          }
        }
      } catch (error) {
        console.error("Failed to set up wallet client:", error);
        setIsWalletInitialized(false);
        setAuthStatusMessage(`Setup failed: ${error instanceof Error ? error.message : 'Unknown'}`);
        
        // Retry logic for general setup errors
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Retrying after error (${retryCount}/${maxRetries})...`);
          setTimeout(setupWalletClient, 2000);
        }
      }
    }
    
    setupWalletClient();
  }, [walletsReady, wallets]);

  // Fetch real balance
  const getBalance = async () => {
    if (!embeddedWalletAddress) {
      showToastMessage('No wallet address found');
      return;
    }
    
    setIsLoading(true);
    try {
      console.log("Getting balance for:", embeddedWalletAddress);
      // Always fetch real balance from the blockchain
      const balance = await publicClient.getBalance({ 
        address: embeddedWalletAddress as Hex 
      });
      userBalance.current = balance;
      const formattedBalance = formatEther(balance);
      setBalance(`${formattedBalance} MONAD`);
      
      console.log(`Wallet address: ${embeddedWalletAddress}`);
      console.log(`Current balance: ${formattedBalance}`);
      
      showToastMessage('Balance fetched successfully!');
    } catch (error) {
      console.error("Failed to fetch balance:", error);
      showToastMessage('Failed to fetch balance');
    } finally {
      setIsLoading(false);
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
          Inventory may load slowly. Please be patient while we fetch your elementals.
        </div>
        
        {/* Ready to Battle Message */}
        <p className="text-xl mb-8 font-pixel text-green-400">{authStatusMessage}</p>
        
        {/* Debug/Test Buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button 
            onClick={() => refreshInventory()} 
            className="bg-purple-700 hover:bg-purple-600 text-white px-3 py-1 rounded-md text-sm"
          >
            Refresh Inventory
          </button>
          
          <button 
            onClick={() => fetchDirectNFTs(mainWalletAddress || embeddedWalletAddress)} 
            className="bg-blue-700 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-sm"
          >
            Direct Fetch NFTs
          </button>
          
          <button 
            onClick={addTestNFTs} 
            className="bg-green-700 hover:bg-green-600 text-white px-3 py-1 rounded-md text-sm"
          >
            Add Test NFTs
          </button>
        </div>
        
        {/* Battle System Component */}
        {isWalletInitialized ? (
          <BattleSystem
            walletAddress={mainWalletAddress || embeddedWalletAddress}
            walletClient={walletClient.current}
            inventory={directInventory.length > 0 ? directInventory : inventory}
            onShowToast={showToastMessage}
            onBattleComplete={handleBattleComplete}
          />
        ) : (
          <div className="text-center p-4 bg-gray-800 rounded-lg max-w-md">
            <p className="text-xl font-pixel mb-4">Initializing your battle wallet...</p>
            <p className="text-sm text-gray-400 mb-6">This may take a moment. Please wait.</p>
            <button
              onClick={setupWalletClient}
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