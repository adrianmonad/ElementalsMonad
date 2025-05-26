import { usePrivy, useWallets, useCreateWallet } from '@privy-io/react-auth';
import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  formatEther, 
  parseEther, 
  Hex, 
  createWalletClient, 
  custom, 
  encodeFunctionData,
  parseGwei 
} from 'viem';
import { monadTestnet } from 'viem/chains';
import { publicClient } from '../utils/publicClient';
import { toast } from 'sonner';

/**
 * Custom hook for Privy embedded wallet integration
 * Creates a new embedded wallet for gameplay without popups
 */
export function usePrivyWallet() {
  // Privy hooks
  const { user, authenticated } = usePrivy();
  const { ready, wallets } = useWallets();
  const { createWallet } = useCreateWallet({
    onSuccess: ({ wallet }) => {
      console.log("Created new embedded wallet:", wallet.address);
      setNewWalletAddress(wallet.address);
      setEmbeddedWalletAddress(wallet.address);
      setIsCreatingWallet(false);
      toast.success("New embedded wallet created successfully!");
    },
    onError: (error) => {
      console.error("Failed to create wallet:", error);
      toast.error("Failed to create embedded wallet");
      setIsCreatingWallet(false);
      setIsLoading(false);
    }
  });
  
  // State
  const [isInitialized, setIsInitialized] = useState(false);
  const [embeddedWalletAddress, setEmbeddedWalletAddress] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [balance, setBalance] = useState<string>("0");
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);
  const [newWalletAddress, setNewWalletAddress] = useState<string>("");
  const [error, setError] = useState<string>("");
  
  // Refs for transaction management
  const walletClient = useRef<any>(null);
  const userNonce = useRef<number>(0);
  const userBalance = useRef<bigint>(BigInt(0));
  const hasFetchedWallet = useRef<boolean>(false);
  
  // Initialize wallet on component mount
  useEffect(() => {
    console.log("Privy wallet hook initializing, authenticated:", authenticated, "ready:", ready);
    
    if (!authenticated || !ready) {
      return;
    }
    
    if (hasFetchedWallet.current) {
      console.log("Wallet already fetched, skipping initialization");
      return;
    }
    
    // We'll check if we have a newly created wallet first, 
    // otherwise we'll create one
    if (newWalletAddress) {
      console.log("Found newly created wallet:", newWalletAddress);
      setEmbeddedWalletAddress(newWalletAddress);
      initializeNewWallet();
    } else {
      console.log("No newly created wallet found yet");
      // We'll wait for the user to create one or for initializeWallet to be called
    }
  }, [authenticated, ready, newWalletAddress]);
  
  // Initialize the newly created wallet
  const initializeNewWallet = useCallback(async () => {
    if (!newWalletAddress || !wallets) return;
    
    try {
      setError("");
      // Find the newly created wallet in the wallets array
      const createdWallet = wallets.find(w => 
        w.address.toLowerCase() === newWalletAddress.toLowerCase() && 
        w.walletClientType === 'privy'
      );
      
      if (!createdWallet) {
        console.log("Newly created wallet not found in wallets array yet, waiting...");
        // The wallet might not be immediately available in the wallets array
        // We'll handle this in the wallets effect below
        return;
      }
      
      console.log("Found newly created wallet in wallets array:", createdWallet.address);
      await setupWalletClient(createdWallet);
    } catch (error) {
      console.error("Error initializing new wallet:", error);
      setError(error instanceof Error ? error.message : "Unknown error initializing wallet");
    }
  }, [newWalletAddress, wallets]);
  
  // Watch for the new wallet to appear in the wallets array
  useEffect(() => {
    if (!newWalletAddress || !wallets || isInitialized) return;
    
    const createdWallet = wallets.find(w => 
      w.address.toLowerCase() === newWalletAddress.toLowerCase() && 
      w.walletClientType === 'privy'
    );
    
    if (createdWallet) {
      console.log("Found newly created wallet in wallets array on update:", createdWallet.address);
      setupWalletClient(createdWallet).catch(error => {
        console.error("Error setting up wallet client:", error);
        setError(error instanceof Error ? error.message : "Unknown error setting up wallet client");
      });
    }
  }, [wallets, newWalletAddress, isInitialized]);
  
  // Function to create a new embedded wallet
  const createNewEmbeddedWallet = useCallback(async () => {
    if (!authenticated) {
      const msg = "Cannot create wallet: User not authenticated";
      console.error(msg);
      toast.error("Please login first");
      setError(msg);
      return false;
    }
    
    if (isCreatingWallet) {
      console.log("Already creating a wallet, please wait");
      return false;
    }
    
    setIsLoading(true);
    setIsCreatingWallet(true);
    setError("");
    
    try {
      console.log("Creating new embedded wallet...");
      
      // Check if we already have an embedded wallet
      if (wallets && wallets.length > 0) {
        console.log("Available wallets:", wallets.map(w => ({ 
          type: w.walletClientType, 
          address: w.address 
        })));
        
        const existingEmbeddedWallet = wallets.find(w => w.walletClientType === 'privy');
        
        if (existingEmbeddedWallet) {
          console.log("Using existing embedded wallet:", existingEmbeddedWallet.address);
          setNewWalletAddress(existingEmbeddedWallet.address);
          setEmbeddedWalletAddress(existingEmbeddedWallet.address);
          setIsCreatingWallet(false);
          
          // Setup the wallet client with the existing wallet
          await setupWalletClient(existingEmbeddedWallet);
          return true;
        } else {
          console.log("No existing embedded wallet found, creating new one");
        }
      } else {
        console.log("No wallets available yet, creating new embedded wallet");
      }
      
      // Create a new wallet
      console.log("Calling Privy createWallet function...");
      await createWallet();
      console.log("createWallet function called successfully");
      // The rest will happen in the onSuccess callback
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error creating wallet";
      console.error("Error creating new embedded wallet:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      setError(errorMsg);
      toast.error("Failed to create embedded wallet: " + errorMsg);
      setIsCreatingWallet(false);
      setIsLoading(false);
      return false;
    }
  }, [authenticated, createWallet, isCreatingWallet, wallets]);
  
  // Initialize wallet (public method)
  const initializeWallet = useCallback(async () => {
    console.log("initializeWallet called, current state:", {
      isInitialized,
      authenticated,
      ready,
      walletCount: wallets?.length || 0,
      embeddedWalletAddress: embeddedWalletAddress || "none"
    });
    
    setError("");
    
    if (isInitialized) {
      console.log("Wallet already initialized");
      return true;
    }
    
    if (!authenticated) {
      const msg = "Cannot initialize wallet: User not authenticated";
      console.error(msg);
      toast.error("Please login first");
      setError(msg);
      return false;
    }
    
    if (!ready) {
      const msg = "Cannot initialize wallet: Privy not ready";
      console.error(msg);
      toast.error("Privy is not ready yet, please wait");
      setError(msg);
      return false;
    }
    
    try {
      // If we already have an embedded wallet address and wallets are available
      if (embeddedWalletAddress && wallets) {
        console.log("Have embedded wallet address, checking wallets...");
        // Check if we already have the wallet
        const existingWallet = wallets.find(w => 
          w.address.toLowerCase() === embeddedWalletAddress.toLowerCase() &&
          w.walletClientType === 'privy'
        );
        
        if (existingWallet) {
          console.log("Found matching wallet in wallets array, setting up client");
          await setupWalletClient(existingWallet);
          return true;
        }
      }
      
      // Check if we have any privy embedded wallet
      if (wallets && wallets.length > 0) {
        console.log("Checking for any privy embedded wallet in wallets array");
        
        // Log all available wallets for debugging
        console.log("Available wallets:", wallets.map(w => ({
          type: w.walletClientType,
          address: w.address
        })));
        
        const existingEmbeddedWallet = wallets.find(w => w.walletClientType === 'privy');
        
        if (existingEmbeddedWallet) {
          console.log("Found existing embedded wallet:", existingEmbeddedWallet.address);
          setEmbeddedWalletAddress(existingEmbeddedWallet.address);
          await setupWalletClient(existingEmbeddedWallet);
          return true;
        }
      }
      
      // Create a new wallet if we don't have one
      console.log("No existing wallet found, creating new embedded wallet");
      return createNewEmbeddedWallet();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error initializing wallet";
      console.error("Error in initializeWallet:", error);
      setError(errorMsg);
      toast.error("Failed to initialize wallet: " + errorMsg);
      return false;
    }
  }, [isInitialized, authenticated, ready, embeddedWalletAddress, wallets, createNewEmbeddedWallet]);
  
  // Set up wallet client from wallet object
  const setupWalletClient = async (wallet: any) => {
    console.log("Setting up wallet client for:", wallet.address);
    
    if (!wallet) {
      const error = new Error("Cannot setup wallet client: wallet object is null or undefined");
      console.error(error);
      setError(error.message);
      toast.error("Wallet object not found");
      setIsLoading(false);
      setIsCreatingWallet(false);
      throw error;
    }
    
    try {
      // Get the Ethereum provider from the wallet
      console.log("Getting Ethereum provider from wallet...");
      const ethereumProvider = await wallet.getEthereumProvider();
      console.log("Got ethereum provider:", !!ethereumProvider);
      
      if (!ethereumProvider) {
        const error = new Error("Ethereum provider is null or undefined");
        console.error(error);
        setError(error.message);
        toast.error("Failed to get wallet provider");
        setIsLoading(false);
        setIsCreatingWallet(false);
        throw error;
      }
      
      // Create a wallet client with viem
      console.log("Creating viem wallet client...");
      const provider = createWalletClient({
        chain: monadTestnet,
        transport: custom(ethereumProvider)
      });
      
      console.log("Wallet client created successfully");
      walletClient.current = provider;
      setIsInitialized(true);
      
      // Get initial nonce and balance
      console.log("Fetching initial wallet data...");
      if (wallet.address) {
        try {
          await fetchWalletBalance(wallet.address);
        } catch (balanceError) {
          console.error("Failed to fetch balance, continuing anyway:", balanceError);
        }
        
        try {
          userNonce.current = await publicClient.getTransactionCount({ 
            address: wallet.address as Hex 
          });
          console.log("Got nonce:", userNonce.current);
        } catch (nonceError) {
          console.error("Failed to get nonce, continuing anyway:", nonceError);
        }
      }
      
      hasFetchedWallet.current = true;
      toast.success("Embedded wallet initialized successfully");
    } catch (error) {
      console.error("Failed to set up wallet client:", error);
      const errorMsg = error instanceof Error ? error.message : "Unknown error setting up wallet";
      setError(errorMsg);
      toast.error("Failed to initialize wallet provider: " + errorMsg);
      throw error;
    } finally {
      setIsLoading(false);
      setIsCreatingWallet(false);
    }
  };
  
  // Fetch wallet balance
  const fetchWalletBalance = async (walletAddress: string) => {
    if (!walletAddress) {
      console.log("No wallet address provided");
      return;
    }
    
    try {
      console.log("Fetching balance for:", walletAddress);
      const balance = await publicClient.getBalance({ 
        address: walletAddress as Hex 
      });
      
      userBalance.current = balance;
      const formattedBalance = formatEther(balance);
      setBalance(formattedBalance);
      
      console.log(`Wallet address: ${walletAddress}`);
      console.log(`Current balance: ${formattedBalance}`);
      
      return balance;
    } catch (error) {
      console.error("Failed to fetch balance:", error);
      return BigInt(0);
    }
  };
  
  // Reset nonce and balance (useful after transactions)
  const resetNonceAndBalance = async () => {
    if (!embeddedWalletAddress) return;
    
    try {
      const [nonce, balance] = await Promise.all([
        publicClient.getTransactionCount({ address: embeddedWalletAddress as Hex }),
        publicClient.getBalance({ address: embeddedWalletAddress as Hex })
      ]);
      
      userNonce.current = nonce;
      userBalance.current = balance;
      setBalance(formatEther(balance));
      
      console.log(`Reset nonce: ${nonce}, balance: ${formatEther(balance)}`);
      return true;
    } catch (error) {
      console.error("Failed to reset nonce and balance:", error);
      return false;
    }
  };
  
  // Send a raw transaction (compatible with your existing structure)
  const sendRawTransaction = async ({
    to,
    value = BigInt(0),
    data,
    gasLimit,
    maxFeePerGas = parseGwei("50"),
    maxPriorityFeePerGas = parseGwei("5"),
    onSuccess,
    onError
  }: {
    to: string,
    value?: bigint,
    data: Hex,
    gasLimit: bigint,
    maxFeePerGas?: bigint,
    maxPriorityFeePerGas?: bigint,
    onSuccess?: (txHash: string) => void,
    onError?: (error: Error) => void
  }) => {
    if (!isInitialized || !embeddedWalletAddress || !walletClient.current) {
      const error = new Error("Wallet not initialized");
      onError?.(error);
      throw error;
    }
    
    // Check balance
    const balance = userBalance.current;
    if (balance < value) {
      const error = new Error("Insufficient balance for transaction");
      onError?.(error);
      throw error;
    }
    
    // Get current nonce and increment
    const nonce = userNonce.current;
    userNonce.current = nonce + 1;
    
    // Update balance optimistically
    userBalance.current = balance - value;
    
    try {
      console.log("Sending transaction:", {
        to,
        value: formatEther(value),
        nonce,
        gasLimit: gasLimit.toString()
      });
      
      // Send transaction using the wallet client
      const txHash = await walletClient.current.sendTransaction({
        to: to as Hex,
        value,
        data,
        account: embeddedWalletAddress as Hex,
        gas: gasLimit,
        nonce,
        maxFeePerGas,
        maxPriorityFeePerGas
      });
      
      console.log(`Transaction hash: ${txHash}`);
      toast.success("Transaction sent successfully!");
      
      // Call success callback
      onSuccess?.(txHash);
      
      return txHash;
    } catch (error) {
      console.error("Transaction failed:", error);
      
      // Revert nonce on failure
      userNonce.current = nonce;
      
      // Refresh balance
      resetNonceAndBalance();
      
      // Call error callback
      onError?.(error as Error);
      toast.error("Transaction failed");
      
      throw error;
    }
  };
  
  // Simple test transaction (send MONAD to self)
  const sendTestTransaction = async () => {
    if (!embeddedWalletAddress || !walletClient.current) {
      throw new Error("Wallet not initialized");
    }
    
    const balance = userBalance.current;
    if (balance < parseEther("0.00002")) {
      throw new Error("Insufficient balance for test transaction");
    }
    
    return sendRawTransaction({
      to: embeddedWalletAddress,
      value: parseEther("0.00001"),
      data: "0x", // Empty data for simple transfer
      gasLimit: BigInt(21000), // Standard gas limit for simple transfers
      onSuccess: (txHash) => {
        console.log("Test transaction successful:", txHash);
        toast.success("Test transaction sent!");
      },
      onError: (error) => {
        console.error("Test transaction failed:", error);
        toast.error("Test transaction failed");
      }
    });
  };
  
  return {
    // State
    isInitialized,
    isLoading: isLoading || isCreatingWallet,
    isCreatingWallet,
    embeddedWalletAddress,
    balance,
    walletClient: walletClient.current,
    error,
    walletsReady: ready && !!wallets,
    walletsCount: wallets?.length || 0,
    authenticated,
    
    // Methods
    initializeWallet,
    createNewEmbeddedWallet,
    fetchWalletBalance,
    resetNonceAndBalance,
    sendRawTransaction,
    sendTestTransaction,
    
    // Raw access to refs (for advanced usage)
    nonce: userNonce.current,
    rawBalance: userBalance.current
  };
} 