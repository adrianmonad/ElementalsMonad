import { useEffect, useRef, useState, useCallback } from 'react';
import { 
  createPublicClient, 
  createWalletClient,
  http, 
  custom,
  parseEther, 
  formatEther,
  encodeFunctionData,
  Hex,
  parseGwei,
  PublicClient
} from 'viem';
import { waitForTransactionReceipt } from 'viem/actions';
import { monadTestnet } from 'viem/chains';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { toast } from 'sonner';

// Define RPC URL based on environment
const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz/';

// Create a public client for reading from the blockchain
const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(rpcUrl),
});

// Helper function to get explorer URL
const getExplorerUrl = (txHash: string) => `https://testnet.monadexplorer.com/tx/${txHash}`;

// Transaction types
interface TransactionRequest {
  id: string;
  to: Hex;
  value: bigint;
  data: Hex;
  gas: bigint;
  nonce: number;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  successText?: string;
  onSuccess?: (txHash: string) => void;
  onError?: (error: Error) => void;
}

interface QueuedTransaction extends TransactionRequest {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  timestamp: number;
  error?: string;
  txHash?: string;
}

interface TransactionQueueState {
  approved: boolean;
  timestamp: number;
  expires: number;
  wallet: string;
  signature?: string;
  queue: QueuedTransaction[];
  processing: boolean;
  lastProcessed: number;
}

export function useTransactionQueue() {
  // User and Wallet objects from Privy
  const { user, authenticated } = usePrivy();
  const { ready, wallets } = useWallets();
  
  // State for transaction status
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [hasApprovedQueue, setHasApprovedQueue] = useState(false);
  const [transactionQueue, setTransactionQueue] = useState<QueuedTransaction[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  
  // Ref values for wallet info
  const userNonce = useRef<number>(0);
  const userBalance = useRef<bigint>(BigInt(0));
  const userAddress = useRef<string>("");
  const walletClient = useRef<any>(null);
  const queueProcessorActive = useRef<boolean>(false);
  const processingTransaction = useRef<string | null>(null);
  
  // Reset nonce and balance
  const resetNonceAndBalance = useCallback(async () => {
    if (!user) {
      return false;
    }
    
    const [privyUser] = user.linkedAccounts.filter(
      (account) => account.type === "wallet" && account.walletClientType === "privy"
    );
    
    if (!privyUser || !(privyUser as any).address) {
      return false;
    }
    
    const privyUserAddress = (privyUser as any).address as Hex;
    
    try {
      const nonce = await publicClient.getTransactionCount({
        address: privyUserAddress,
      });
      
      const balance = await publicClient.getBalance({
        address: privyUserAddress,
      });
      
      console.log("Setting nonce:", nonce);
      console.log("Setting balance:", balance.toString());
      
      userNonce.current = nonce;
      userBalance.current = balance;
      userAddress.current = privyUserAddress;
      setBalance(balance);
      
      return true;
    } catch (err) {
      console.error("Error refreshing wallet data:", err);
      return false;
    }
  }, [user]);
  
  // Initialize wallet provider with viem
  useEffect(() => {
    async function getWalletClient() {
      if (!ready || !wallets) {
        console.log("Privy not ready or no wallets available");
        return;
      }
      
      console.log("Available wallets:", wallets.map(w => w.walletClientType));
      
      // Important: We specifically want the embedded Privy wallet
      const userWallet = wallets.find(
        (w) => w.walletClientType === "privy"
      );
      
      if (!userWallet) {
        console.error("No Privy wallet found in wallet list");
        return;
      }
      
      try {
        console.log("Getting ethereum provider from Privy wallet...");
        const ethereumProvider = await userWallet.getEthereumProvider();
        console.log("Ethereum provider obtained:", !!ethereumProvider);
        
        // IMPORTANT: This is the key part - we create our own wallet client with viem
        // instead of using Privy's user.wallet methods, which would trigger popups
        console.log("Creating viem wallet client with provider...");
        const provider = createWalletClient({
          chain: monadTestnet,
          transport: custom(ethereumProvider),
        });
        
        console.log("Viem wallet client created successfully");
        walletClient.current = provider;
        
        // Reset nonce and balance after getting wallet
        await resetNonceAndBalance();
      } catch (error) {
        console.error("Failed to get ethereum provider:", error);
      }
    }
    
    console.log("Initializing viem wallet client...");
    getWalletClient();
  }, [user, ready, wallets, resetNonceAndBalance]);
  
  // Refresh nonce and balance periodically
  useEffect(() => {
    if (!userAddress.current) return;
    
    resetNonceAndBalance();
    
    const interval = setInterval(() => {
      resetNonceAndBalance();
    }, 15000); // Every 15 seconds
    
    return () => clearInterval(interval);
  }, [resetNonceAndBalance]);
  
  // Load transaction queue from localStorage on initialization
  useEffect(() => {
    if (authenticated && user?.wallet?.address) {
      const walletAddress = user.wallet.address;
      try {
        // Load queue state from localStorage
        const storedQueueData = localStorage.getItem(`${walletAddress}_tx_queue`);
        if (storedQueueData) {
          const queueState: TransactionQueueState = JSON.parse(storedQueueData);
          
          // Check if approval is valid and not expired
          const now = Date.now();
          if (queueState.approved && queueState.wallet === walletAddress && queueState.expires > now) {
            console.log("Found valid transaction queue approval until", new Date(queueState.expires).toLocaleString());
            setHasApprovedQueue(true);
            
            // Clean up completed transactions and filter out expired ones (older than 24 hours)
            const filteredQueue = queueState.queue.filter(tx => 
              (tx.status === 'queued' || tx.status === 'processing') && 
              (now - tx.timestamp < 24 * 60 * 60 * 1000)
            );
            
            setTransactionQueue(filteredQueue);
            setIsProcessingQueue(queueState.processing);
          } else {
            // Clear expired or invalid queue
            console.log("Clearing expired or invalid transaction queue");
            localStorage.removeItem(`${walletAddress}_tx_queue`);
            setHasApprovedQueue(false);
            setTransactionQueue([]);
          }
        } else {
          // No queue found
          setHasApprovedQueue(false);
          setTransactionQueue([]);
        }
      } catch (error) {
        console.error("Error loading transaction queue:", error);
        setHasApprovedQueue(false);
        setTransactionQueue([]);
      }
    } else {
      // Not authenticated or no wallet
      setHasApprovedQueue(false);
      setTransactionQueue([]);
    }
  }, [authenticated, user]);
  
  // Process the transaction queue in the background
  useEffect(() => {
    if (!hasApprovedQueue || !userAddress.current || !walletClient.current || queueProcessorActive.current) {
      return;
    }
    
    const processQueue = async () => {
      if (queueProcessorActive.current || !hasApprovedQueue || !userAddress.current || !walletClient.current) {
        return;
      }
      
      // If no transactions in queue, nothing to process
      if (transactionQueue.length === 0) {
        setIsProcessingQueue(false);
        return;
      }
      
      // Set flag to prevent multiple processing instances
      queueProcessorActive.current = true;
      setIsProcessingQueue(true);
      
      try {
        // Get next transaction to process (first queued one)
        const nextTx = transactionQueue.find(tx => tx.status === 'queued');
        if (!nextTx) {
          queueProcessorActive.current = false;
          setIsProcessingQueue(false);
          return;
        }
        
        // Update transaction status to processing
        processingTransaction.current = nextTx.id;
        setTransactionQueue(prev => prev.map(tx => 
          tx.id === nextTx.id ? { ...tx, status: 'processing' as const } : tx
        ));
        
        // Persist queue state update
        saveQueueState();
        
        // Process the transaction
        try {
          // Make sure we have the latest nonce
          await resetNonceAndBalance();
          
          // Set appropriate nonce for this transaction
          const nonce = userNonce.current;
          userNonce.current = nonce + 1; // Increment for next transaction
          
          // Sign the transaction directly with our viem wallet client
          const provider = walletClient.current;
          console.log("Using viem wallet client for direct transaction signing");
          
          const signedTransaction = await provider.signTransaction({
            to: nextTx.to,
            account: userAddress.current as Hex,
            data: nextTx.data,
            nonce,
            gas: nextTx.gas,
            maxFeePerGas: nextTx.maxFeePerGas || parseGwei("50"),
            maxPriorityFeePerGas: nextTx.maxPriorityFeePerGas || parseGwei("5"),
            value: nextTx.value,
          });
          
          console.log("Transaction successfully signed with viem wallet client");
          
          // Send transaction via direct RPC call (not through Privy)
          console.log("Sending raw transaction via direct RPC call");
          const response = await fetch(rpcUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: 0,
              jsonrpc: "2.0",
              method: "eth_sendRawTransaction",
              params: [signedTransaction],
            }),
          });
          
          const data = await response.json();
          console.log("RPC response:", data);
          
          if (data.error) {
            // Handle transaction errors
            if (data.error.message && data.error.message.includes("nonce")) {
              console.log("Nonce error detected, resetting nonce");
              const currentNonce = await publicClient.getTransactionCount({
                address: userAddress.current as Hex,
              });
              userNonce.current = currentNonce;
            }
            
            throw Error(data.error.message || "Transaction failed");
          }
          
          // Get transaction hash
          const transactionHash: Hex = data.result;
          const explorerUrl = getExplorerUrl(transactionHash);
          
          // Update transaction in queue with hash
          setTransactionQueue(prev => prev.map(tx => 
            tx.id === nextTx.id ? { ...tx, txHash: transactionHash } : tx
          ));
          
          // Dismiss any existing toasts before showing new one
          toast.dismiss();
          
          // Show background notification
          toast.info(`Transaction processing`, {
            description: `${nextTx.successText || ""} Processing in background...`,
            action: {
              label: "View",
              onClick: () => window.open(explorerUrl, "_blank", "noopener,noreferrer")
            }
          });
          
          // Wait for transaction receipt
          const receipt = await waitForTransactionReceipt(publicClient, {
            hash: transactionHash,
          });
          
          if (receipt.status === "reverted") {
            throw Error(`Transaction reverted: ${transactionHash}`);
          }
          
          // Update transaction status to completed
          setTransactionQueue(prev => prev.map(tx => 
            tx.id === nextTx.id ? { ...tx, status: 'completed' as const } : tx
          ));
          
          // Call success callback if provided
          if (nextTx.onSuccess) {
            nextTx.onSuccess(transactionHash);
          }
          
          // Dismiss any existing toasts before showing success
          toast.dismiss();
          
          // Show success toast
          toast.success(`Transaction confirmed`, {
            description: `${nextTx.successText || ""} Completed successfully`,
            action: {
              label: "View",
              onClick: () => window.open(explorerUrl, "_blank", "noopener,noreferrer")
            }
          });
          
          // Update balance after successful transaction
          const newBalance = await publicClient.getBalance({
            address: userAddress.current as Hex,
          });
          userBalance.current = newBalance;
          setBalance(newBalance);
          
        } catch (err: any) {
          console.error("Transaction processing error:", err);
          console.log("Error details:", err.message || "Unknown error");
          
          // Update transaction status to failed
          setTransactionQueue(prev => prev.map(tx => 
            tx.id === nextTx.id ? { ...tx, status: 'failed' as const, error: err.message || "Unknown error" } : tx
          ));
          
          // Call error callback if provided
          if (nextTx.onError) {
            nextTx.onError(err instanceof Error ? err : new Error(err.message || "Unknown error"));
          }
          
          // Dismiss any existing toasts before showing error
          toast.dismiss();
          
          // Show error toast
          toast.error(`Transaction failed`, {
            description: `Error: ${err.message || "Unknown error"}`
          });
          
          // Reset nonce in case of error
          try {
            const currentNonce = await publicClient.getTransactionCount({
              address: userAddress.current as Hex,
            });
            userNonce.current = currentNonce;
          } catch (nonceError) {
            console.error("Failed to reset nonce:", nonceError);
          }
        }
        
        // Save updated queue state
        saveQueueState();
        
        // Reset processing flag
        processingTransaction.current = null;
        
      } finally {
        // Reset flag to allow next processing cycle
        queueProcessorActive.current = false;
        
        // Check if there are more transactions to process
        const hasMoreQueued = transactionQueue.some(tx => tx.status === 'queued');
        if (hasMoreQueued) {
          // Short timeout before processing next transaction
          setTimeout(() => {
            processQueue();
          }, 1000);
        } else {
          setIsProcessingQueue(false);
        }
      }
    };
    
    // Start processing if there are queued transactions
    if (transactionQueue.some(tx => tx.status === 'queued') && !queueProcessorActive.current) {
      processQueue();
    }
  }, [hasApprovedQueue, transactionQueue, resetNonceAndBalance]);
  
  // Save queue state to localStorage
  const saveQueueState = useCallback(() => {
    if (!user?.wallet?.address) return;
    
    const walletAddress = user.wallet.address;
    const now = Date.now();
    
    // Create queue state object
    const queueState: TransactionQueueState = {
      approved: hasApprovedQueue,
      timestamp: now,
      expires: now + 24 * 60 * 60 * 1000, // 24 hours from now
      wallet: walletAddress,
      queue: transactionQueue,
      processing: isProcessingQueue,
      lastProcessed: now
    };
    
    // Save to localStorage
    localStorage.setItem(`${walletAddress}_tx_queue`, JSON.stringify(queueState));
  }, [user, hasApprovedQueue, transactionQueue, isProcessingQueue]);
  
  // Function to approve the transaction queue
  const approveTransactionQueue = useCallback(async () => {
    try {
      if (!user?.wallet?.address) {
        throw new Error("No wallet connected");
      }
      
      if (!walletClient.current) {
        console.error("Viem wallet client not initialized");
        throw new Error("Wallet not initialized");
      }
      
      const userAccount = userAddress.current || user.wallet.address as Hex;
      
      // Have the user sign a message to indicate approval for background transactions
      const timestamp = Date.now();
      const message = `I authorize background transactions from my wallet for Elementals game.\n\nThis approval will last for 24 hours and will let you play without transaction popups.\nNo transactions will occur without your interaction with the game.\n\nWallet: ${userAccount}\nTimestamp: ${timestamp}\nExpires: ${new Date(timestamp + 24 * 60 * 60 * 1000).toLocaleString()}`;
      
      console.log("Using viem wallet client to sign message directly");
      
      // IMPORTANT: Use our viem wallet client to sign the message, not Privy's user.wallet
      const provider = walletClient.current;
      const signature = await provider.signMessage({
        account: userAccount,
        message,
      });
      
      console.log("Message signed successfully with viem wallet client");
      
      // Create initial queue state
      const queueState: TransactionQueueState = {
        approved: true,
        timestamp: timestamp,
        expires: timestamp + 24 * 60 * 60 * 1000, // 24 hours
        wallet: userAccount,
        signature: signature.slice(0, 10), // Store just a part of the signature for validation
        queue: [],
        processing: false,
        lastProcessed: timestamp
      };
      
      // Store queue state in localStorage
      console.log("Saving queue state to localStorage");
      localStorage.setItem(`${userAccount}_tx_queue`, JSON.stringify(queueState));
      
      // Update state
      setHasApprovedQueue(true);
      setTransactionQueue([]);
      
      console.log("Transaction queue approved until", new Date(queueState.expires).toLocaleString());
      return true;
    } catch (error) {
      console.error("Failed to approve transaction queue:", error);
      return false;
    }
  }, [user, userAddress]);
  
  // Function to queue a transaction
  const queueTransaction = useCallback(async ({
    to,
    value = BigInt(0),
    data,
    gas,
    maxFeePerGas,
    maxPriorityFeePerGas,
    successText,
    onSuccess,
    onError
  }: {
    to: Hex;
    value?: bigint | string;
    data: Hex;
    gas: bigint;
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
    successText?: string;
    onSuccess?: (txHash: string) => void;
    onError?: (error: Error) => void;
  }) => {
    console.log("queueTransaction called with:", {
      to: to,
      value: typeof value === 'string' ? value : formatEther(value),
      data: data.length > 10 ? data.slice(0, 10) + '...' : data,
      gas: gas.toString(),
      hasApprovedQueue,
    });

    // Make sure we have an approved queue
    if (!hasApprovedQueue) {
      console.log("No approved queue yet, requesting approval...");
      const approved = await approveTransactionQueue();
      console.log("Approval result:", approved);
      if (!approved) {
        console.error("Queue approval was rejected by user");
        throw new Error("Transaction queue approval rejected");
      }
    } else {
      console.log("Queue already approved, proceeding with transaction");
    }
    
    // Convert string value to bigint if needed
    const valueBigInt = typeof value === 'string' ? parseEther(value) : value;
    
    // Generate unique ID for this transaction
    const txId = `tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    console.log("Generated transaction ID:", txId);
    
    // Create transaction object
    const newTransaction: QueuedTransaction = {
      id: txId,
      to,
      value: valueBigInt,
      data,
      gas,
      nonce: userNonce.current, // This will be updated when actually processing
      maxFeePerGas,
      maxPriorityFeePerGas,
      status: 'queued' as const,
      timestamp: Date.now(),
      successText,
      onSuccess,
      onError
    };
    
    // Check if wallet client is ready
    if (!walletClient.current) {
      console.error("Wallet client not initialized when queueing transaction");
      throw new Error("Wallet not initialized");
    }
    
    // Add to queue
    console.log("Adding transaction to queue:", txId);
    setTransactionQueue(prev => [...prev, newTransaction]);
    
    // Save updated queue
    console.log("Saving updated queue state");
    setTimeout(saveQueueState, 0);
    
    return txId;
  }, [hasApprovedQueue, approveTransactionQueue, saveQueueState]);
  
  // Simple transaction sender for basic transfers that uses the queue
  const sendTx = useCallback(async (to: string, value: string, options?: { successText?: string }) => {
    console.log("sendTx called with:", { to, value, options });
    
    // Check prerequisites
    if (!walletClient.current || userNonce.current === null || !userAddress.current) {
      console.log("Wallet not ready, attempting to initialize...");
      const success = await resetNonceAndBalance();
      if (!success) {
        console.error("❌ Cannot send transaction - wallet initialization failed");
        throw new Error('Wallet not ready');
      }
    }
    
    const valueWei = parseEther(value);
    const balance = userBalance.current;
    
    if (balance < valueWei) {
      console.error(`Insufficient balance. Have ${formatEther(balance)}, need ${value}`);
      throw new Error(`Insufficient balance. You have ${formatEther(balance)} MONAD but need ${value} MONAD`);
    }

    console.log("All checks passed, proceeding to queue transaction");
    
    // IMPORTANT: Direct queue without waiting for confirmation
    // This avoids showing popups by only worrying about adding to queue
    const txId = await queueTransaction({
      to: to as Hex,
      value: valueWei,
      data: '0x' as Hex,
      gas: BigInt(21000),
      successText: options?.successText || `Sent ${value} MONAD to ${to.substring(0, 6)}...${to.substring(to.length - 4)}`,
    });
    
    console.log("Transaction added to queue with ID:", txId);
    
    // Return the transaction ID immediately 
    // This way we don't await the actual signing or confirmation process
    return txId;
  }, [resetNonceAndBalance, queueTransaction]);
  
  // Cancel a queued transaction
  const cancelTransaction = useCallback((txId: string) => {
    setTransactionQueue(prev => {
      // Only allow cancellation if the transaction is still in queued state
      const updatedQueue = prev.map(tx => 
        tx.id === txId && tx.status === 'queued' 
          ? { ...tx, status: 'failed' as const, error: 'Cancelled by user' } 
          : tx
      );
      
      // If nothing changed, return the original array
      if (JSON.stringify(prev) === JSON.stringify(updatedQueue)) {
        return prev;
      }
      
      // Save updated queue state
      setTimeout(saveQueueState, 0);
      return updatedQueue;
    });
  }, [saveQueueState]);
  
  // Clear completed and failed transactions from the queue
  const clearCompletedTransactions = useCallback(() => {
    setTransactionQueue(prev => {
      const filteredQueue = prev.filter(tx => 
        tx.status !== 'completed' && tx.status !== 'failed'
      );
      
      // If nothing changed, return the original array
      if (filteredQueue.length === prev.length) {
        return prev;
      }
      
      // Save updated queue state
      setTimeout(saveQueueState, 0);
      return filteredQueue;
    });
  }, [saveQueueState]);
  
  return {
    sendTx,
    queueTransaction,
    cancelTransaction,
    clearCompletedTransactions,
    txLoading,
    txError,
    ready: !!walletClient.current,
    balance,
    address: userAddress.current,
    resetNonceAndBalance,
    encodeFunctionData,
    hasApprovedQueue,
    approveTransactionQueue,
    transactionQueue,
    isProcessingQueue,
  };
} 