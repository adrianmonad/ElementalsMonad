import { useEffect, useRef, useState, useCallback } from 'react';
import { 
  createPublicClient, 
  http, 
  parseEther, 
  createWalletClient,
  custom,
  formatEther,
  encodeFunctionData,
  Hex,
  parseGwei
} from 'viem';
import { waitForTransactionReceipt } from 'viem/actions';
import { monadTestnet } from 'viem/chains';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { toast } from 'sonner';

// Define RPC URL based on environment
const rpcUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz/';

// Mobile browser detection helper
const isMobileBrowser = () => {
  if (typeof window === 'undefined') return false;
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
};

// Create a public client for reading from the blockchain
const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(rpcUrl),
});

// Helper function to get explorer URL
const getExplorerUrl = (txHash: string) => `https://testnet.monadexplorer.com/tx/${txHash}`;

export function useTransaction() {
  // User and Wallet objects from Privy
  const { user, authenticated } = usePrivy();
  const { ready, wallets } = useWallets();
  
  // State for transaction status
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [hasApprovedWallet, setHasApprovedWallet] = useState(false);
  const [isMobile] = useState(isMobileBrowser());
  
  // Ref values for wallet info
  const userNonce = useRef<number>(0);
  const userBalance = useRef<bigint>(BigInt(0));
  const userAddress = useRef<string>("");
  const walletClient = useRef<any>(null);
  const lastApprovalTimestamp = useRef<number>(0);
  
  // Debug logging
  useEffect(() => {
    console.log('[DEBUG/useTransaction] user:', user);
    console.log('[DEBUG/useTransaction] authenticated:', authenticated);
    console.log('[DEBUG/useTransaction] ready:', ready);
    console.log('[DEBUG/useTransaction] wallets:', wallets);
  }, [user, authenticated, ready, wallets]);
  
  // Reset nonce and balance
  const resetNonceAndBalance = useCallback(async () => {
    if (!user) {
      return;
    }
    
    const [privyUser] = user.linkedAccounts.filter(
      (account) => account.type === "wallet" && account.walletClientType === "privy"
    );
    
    if (!privyUser || !(privyUser as any).address) {
      return;
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
        console.log('[DEBUG/useTransaction] Privy not ready or no wallets');
        return;
      }
      console.log('[DEBUG/useTransaction] Wallets array:', wallets);
      const userWallet = wallets.find(
        (w) => w.walletClientType === "privy"
      );
      if (!userWallet) {
        console.log('[DEBUG/useTransaction] No Privy embedded wallet found in wallets array');
        return;
      }
      try {
        console.log('[DEBUG/useTransaction] Getting ethereum provider for wallet:', userWallet.address);
        const startTime = Date.now();
        const ethereumProvider = await userWallet.getEthereumProvider();
        console.log(`[DEBUG/useTransaction] Got ethereum provider in ${Date.now() - startTime}ms:`, !!ethereumProvider);
        // Test provider capabilities
        try {
          const accounts = await ethereumProvider.request({ method: 'eth_accounts' });
          console.log('[DEBUG/useTransaction] eth_accounts:', accounts);
        } catch (err) {
          console.error('[DEBUG/useTransaction] eth_accounts error:', err);
        }
        // Create wallet client
        console.log('[DEBUG/useTransaction] Creating wallet client with provider');
        const provider = createWalletClient({
          chain: monadTestnet,
          transport: custom(ethereumProvider),
        });
        console.log('[DEBUG/useTransaction] Wallet client created:', !!provider);
        walletClient.current = provider;
        // Reset nonce and balance after getting wallet
        await resetNonceAndBalance();
        console.log('[DEBUG/useTransaction] walletClient.current is now set:', !!walletClient.current);
      } catch (error) {
        console.error('[DEBUG/useTransaction] Failed to get ethereum provider:', error);
      }
    }
    getWalletClient();
    // Log walletClient.current after attempting to set it
    setTimeout(() => {
      console.log('[DEBUG/useTransaction] walletClient.current after effect:', !!walletClient.current);
    }, 1000);
  }, [user, ready, wallets, resetNonceAndBalance]);
  
  // Special mobile handling - check for stored provider and force initialization if needed
  useEffect(() => {
    if (isMobile && user?.wallet?.address && !walletClient.current) {
      console.log("[MOBILE-DEBUG] Mobile device detected, forcing wallet initialization");
      // Delay the initialization slightly to ensure Privy has fully loaded
      setTimeout(() => {
        const userWallet = wallets?.find(
          (w) => w.walletClientType === "privy"
        );
        
        if (userWallet) {
          console.log("[MOBILE-DEBUG] Found Privy wallet for force initialization:", userWallet.address);
          userWallet.getEthereumProvider().then(provider => {
            console.log("[MOBILE-DEBUG] Force initialized provider:", !!provider);
            
            if (provider) {
              const viemClient = createWalletClient({
                chain: monadTestnet,
                transport: custom(provider),
              });
              walletClient.current = viemClient;
              console.log("[MOBILE-DEBUG] Force created wallet client:", !!viemClient);
              resetNonceAndBalance();
            }
          }).catch(err => {
            console.error("[MOBILE-DEBUG] Force initialization failed:", err);
          });
        }
      }, 2000); // 2 second delay
    }
  }, [isMobile, user?.wallet?.address, wallets, resetNonceAndBalance]);
  
  // Helper function to reset wallet and force reinitialization
  const resetAndForceWallet = useCallback(async () => {
    if (isMobile && user?.wallet?.address) {
      // Clear any stored approval to force a fresh wallet connection
      localStorage.removeItem(`${user.wallet.address}_tx_approval`);
      console.log("[MOBILE-DEBUG] Running mobile wallet recovery process");
      
      // Force wallet initialization
      const userWallet = wallets?.find(w => w.walletClientType === "privy");
      if (userWallet) {
        try {
          console.log("[MOBILE-DEBUG] Recovery: Getting provider for wallet:", userWallet.address);
          const provider = await userWallet.getEthereumProvider();
          console.log("[MOBILE-DEBUG] Recovery: Got provider:", !!provider);
          
          // Test basic provider functionality
          try {
            const accounts = await provider.request({ method: 'eth_accounts' });
            console.log("[MOBILE-DEBUG] Recovery: eth_accounts:", accounts);
          } catch (err) {
            console.error("[MOBILE-DEBUG] Recovery: eth_accounts error:", err);
          }
          
          console.log("[MOBILE-DEBUG] Recovery: Creating wallet client");
          const viemClient = createWalletClient({
            chain: monadTestnet,
            transport: custom(provider)
          });
          console.log("[MOBILE-DEBUG] Recovery: Client created:", !!viemClient);
          
          walletClient.current = viemClient;
          await resetNonceAndBalance();
          return true;
        } catch (err) {
          console.error("[MOBILE-DEBUG] Failed to force wallet initialization:", err);
        }
      }
    }
    return false;
  }, [isMobile, user?.wallet?.address, wallets, resetNonceAndBalance]);
  
  // Refresh nonce and balance periodically
  useEffect(() => {
    if (!userAddress.current) return;
    
    resetNonceAndBalance();
    
    const interval = setInterval(() => {
      resetNonceAndBalance();
    }, 15000); // Every 15 seconds
    
    return () => clearInterval(interval);
  }, [resetNonceAndBalance]);
  
  // Check localStorage for pre-approval info - updated to match new data structure
  useEffect(() => {
    if (authenticated && user?.wallet?.address) {
      try {
        const storedData = localStorage.getItem(`${user.wallet.address}_tx_approval`);
        if (storedData) {
          const approvalData = JSON.parse(storedData);
          
          // Check if approval is valid and not expired
          const now = Date.now();
          if (
            approvalData.approved && 
            approvalData.wallet === user.wallet.address &&
            approvalData.expires > now
          ) {
            console.log("Found valid wallet approval until", new Date(approvalData.expires).toLocaleString());
            setHasApprovedWallet(true);
            lastApprovalTimestamp.current = approvalData.timestamp;
          } else {
            // Clear expired or invalid approval
            console.log("Clearing expired or invalid wallet approval");
            localStorage.removeItem(`${user.wallet.address}_tx_approval`);
            setHasApprovedWallet(false);
          }
        } else {
          // No approval found
          setHasApprovedWallet(false);
        }
      } catch (error) {
        console.error("Error checking stored approval:", error);
        setHasApprovedWallet(false);
      }
    } else {
      // Not authenticated or no wallet
      setHasApprovedWallet(false);
    }
  }, [authenticated, user]);
  
  // Function to pre-approve the wallet for transactions - updated to match Monad 2048 approach
  const approveWalletForTransactions = useCallback(async () => {
    try {
      if (!user?.wallet?.address) {
        throw new Error("No wallet connected");
      }
      
      console.log(`[MOBILE-DEBUG] Requesting wallet approval for ${user.wallet.address}, isMobile: ${isMobile}`);
      
      // Have the user sign a message to indicate approval for background transactions
      // This is a more descriptive message that explains why we need this
      const timestamp = Date.now();
      const message = `I authorize background transactions from my wallet for Elementals game.\n\nThis approval will last for 24 hours and will let you play without transaction popups.\nNo transactions will occur without your interaction with the game.\n\nWallet: ${user.wallet.address}\nTimestamp: ${timestamp}\nExpires: ${new Date(timestamp + 24 * 60 * 60 * 1000).toLocaleString()}`;
      
      const provider = walletClient.current;
      if (!provider) {
        throw new Error("Wallet not initialized");
      }
      
      // Use a longer timeout on mobile
      console.log(`[MOBILE-DEBUG] Provider ready, attempting to sign approval message`);
      
      // Have the user sign the message (this will trigger approval UI just once)
      try {
        console.log(`[MOBILE-DEBUG] Signing message, length: ${message.length}`);
        const startTime = Date.now();
        
        const signature = await provider.signMessage({
          account: user.wallet.address as Hex,
          message,
        });
        
        console.log(`[MOBILE-DEBUG] Message signed in ${Date.now() - startTime}ms: ${signature.slice(0, 10)}...`);
        
        // Store approval in localStorage with more information
        const approvalData = {
          approved: true,
          timestamp: timestamp,
          expires: timestamp + 24 * 60 * 60 * 1000,
          wallet: user.wallet.address,
          signature: signature.slice(0, 10) // Store just a part of the signature for validation
        };
        
        localStorage.setItem(`${user.wallet.address}_tx_approval`, JSON.stringify(approvalData));
        
        // Update state
        setHasApprovedWallet(true);
        lastApprovalTimestamp.current = timestamp;
        
        console.log("Wallet approved for background transactions until", new Date(approvalData.expires).toLocaleString());
        return true;
      } catch (signError) {
        console.error(`[MOBILE-DEBUG] Error signing approval message:`, signError);
        
        // Handle specific mobile error conditions
        if (isMobile) {
          console.log(`[MOBILE-DEBUG] Mobile-specific error, attempting recovery...`);
          
          // On mobile, let's log provider state for debugging
          console.log(`[MOBILE-DEBUG] Provider state:`, {
            provider: !!provider,
            hasWallet: !!user?.wallet,
            walletAddress: user?.wallet?.address
          });
          
          // For mobile, we might need to try an alternate approach
          toast.error("Mobile wallet error", {
            description: "Please try refreshing the page",
            duration: 5000
          });
        }
        
        throw signError;
      }
    } catch (error) {
      console.error("Failed to approve wallet for transactions:", error);
      return false;
    }
  }, [user, isMobile]);
  
  // Send transaction with optimal handling for Privy embedded wallet
  const sendRawTransactionAndConfirm = useCallback(async ({
    successText,
    gas,
    data,
    to,
    value = BigInt(0),
    nonce,
    maxFeePerGas = parseGwei("50"),
    maxPriorityFeePerGas = parseGwei("5"),
  }: {
    successText?: string;
    gas: bigint;
    data: Hex;
    to: Hex;
    value?: bigint;
    nonce: number;
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
  }) => {
    setTxLoading(true);
    setTxError(null);
    
    try {
      // Get the wallet provider
      const provider = walletClient.current;
      if (!provider) {
        throw Error("Wallet not found or not initialized");
      }
      
      const privyUserAddress = userAddress.current;
      if (!privyUserAddress) {
        throw Error("User address not found");
      }
      
      // Check if we need to request approval first
      // For first transaction or if approval has expired (after 24h)
      if (!hasApprovedWallet) {
        // This will show the popup for the first transaction only
        const approved = await approveWalletForTransactions();
        if (!approved) {
          throw Error("User rejected wallet approval");
        }
      }
      
      // Sign transaction - after approveWalletForTransactions(), this shouldn't show another popup
      console.log("Signing transaction...");
      const startTime = Date.now();
      
      let signedTransaction;
      try {
        // Get nonce for tracking
        const nonce = userNonce.current;
        userNonce.current = nonce + 1; // Immediately increment nonce to prevent reuse

        console.log(`[MOBILE-DEBUG] About to sign transaction with params:`, {
          address: privyUserAddress,
          to,
          nonce,
          gas: gas.toString(),
          maxFeePerGas: maxFeePerGas.toString(),
          maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
          value: value.toString(),
          dataLen: data.length
        });

        // Sign the transaction
        signedTransaction = await provider.signTransaction({
          to,
          account: privyUserAddress as Hex,
          data,
          nonce,
          gas,
          maxFeePerGas,
          maxPriorityFeePerGas,
          value,
        });
        
        console.log(`[MOBILE-DEBUG] Transaction signed in ${Date.now() - startTime}ms:`, 
          signedTransaction ? signedTransaction.substring(0, 20) + '...' : 'null');

        // Direct RPC call to broadcast transaction - similar to 2048 Monad implementation
        console.log("Sending raw transaction via eth_sendRawTransaction...");
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
        
        const data2 = await response.json();
        const time = Date.now() - startTime;
        
        if (data2.error) {
          console.log(`Failed sent in ${time} ms`);
          
          // Reset nonce if transaction failed due to nonce issues
          if (data2.error.message && data2.error.message.includes("nonce")) {
            console.log("Nonce error detected, resetting nonce");
            
            // Reset nonce by getting the current nonce from the blockchain
            const currentNonce = await publicClient.getTransactionCount({
              address: privyUserAddress as Hex,
            });
            userNonce.current = currentNonce;
          }
          
          throw Error(data2.error.message || "Transaction failed");
        }
        
        const transactionHash: Hex = data2.result;
        const explorerUrl = getExplorerUrl(transactionHash);
        
        // Dismiss any existing toasts before showing new ones
        toast.dismiss();
        
        // Show toast notification - no confirmation needed
        toast.info(`Transaction sent`, {
          description: `${successText || ""} Waiting for confirmation...`,
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
          console.log(`Failed confirmation in ${Date.now() - startTime} ms`);
          throw Error(`Failed to confirm transaction: ${transactionHash}`);
        }
        
        // Dismiss any existing toasts before showing success
        toast.dismiss();
        
        // Success toast - no confirmation needed
        console.log(`Transaction confirmed in ${Date.now() - startTime} ms: ${transactionHash}`);
        toast.success(`Transaction confirmed`, {
          description: `${successText || ""} Completed in ${Math.floor((Date.now() - startTime)/1000)}s`,
          action: {
            label: "View",
            onClick: () => window.open(explorerUrl, "_blank", "noopener,noreferrer")
          }
        });
        
        // Update balance after successful transaction
        const newBalance = await publicClient.getBalance({
          address: privyUserAddress as Hex,
        });
        userBalance.current = newBalance;
        setBalance(newBalance);
        
        return transactionHash;
        
      } catch (err: any) {
        console.error("Transaction error:", err);
        setTxError(err.message || "Transaction failed");
        
        // Reset nonce in case of error to prevent future transaction failures
        try {
          const currentNonce = await publicClient.getTransactionCount({
            address: privyUserAddress as Hex,
          });
          userNonce.current = currentNonce;
          console.log("Nonce reset to:", currentNonce);
        } catch (nonceError) {
          console.error("Failed to reset nonce:", nonceError);
        }
        
        // Dismiss any existing toasts before showing error
        toast.dismiss();
        
        toast.error(`Transaction failed`, {
          description: `Error: ${err.message || "Unknown error"}`
        });
        
        throw err;
      }
    } catch (err: any) {
      console.error("Transaction failed:", err);
      setTxError(err.message || "Transaction failed");
      
      // Dismiss any existing toasts before showing error
      toast.dismiss();
      
      toast.error(`Transaction failed`, {
        description: `Error: ${err.message || "Unknown error"}`
      });
      
      throw err;
    } finally {
      setTxLoading(false);
    }
  }, [hasApprovedWallet, approveWalletForTransactions]);
  
  // Simple transaction sender for basic transfers
  const sendTx = useCallback(async (to: string, value: string) => {
    console.log("sendTx called with:", { to, value });
    
    // Mobile-specific recovery path
    if (isMobile && (!walletClient.current || !userAddress.current)) {
      console.log("[MOBILE-DEBUG] Transaction system not ready on mobile, attempting recovery");
      const recovered = await resetAndForceWallet();
      if (recovered) {
        console.log("[MOBILE-DEBUG] Mobile wallet recovery successful");
      } else {
        console.log("[MOBILE-DEBUG] Mobile wallet recovery failed");
      }
    }
    
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
      throw new Error(`Insufficient balance. You have ${formatEther(balance)} MONAD but need ${value} MONAD`);
    }
    
    return sendRawTransactionAndConfirm({
      to: to as Hex,
      value: valueWei,
      nonce: userNonce.current,
      gas: BigInt(21000),
      data: '0x' as Hex,
      successText: `Sent ${value} MONAD to ${to.substring(0, 6)}...${to.substring(to.length - 4)}`,
    });
  }, [resetNonceAndBalance, sendRawTransactionAndConfirm, isMobile, resetAndForceWallet]);
  
  // At the end, log txReady
  useEffect(() => {
    console.log('[DEBUG/useTransaction] txReady:', !!walletClient.current);
  }, [walletClient.current]);
  
  return {
    sendTx,
    sendRawTransactionAndConfirm,
    txLoading,
    txError,
    ready: !!walletClient.current,
    balance,
    address: userAddress.current,
    resetNonceAndBalance,
    encodeFunctionData,
    hasApprovedWallet,
    approveWalletForTransactions,
  };
}