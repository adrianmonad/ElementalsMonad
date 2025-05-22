"use client";

import { useState } from "react";
import { useTransaction } from "@/hooks/useTransaction";
import { useOptimisticTransaction } from "@/hooks/useOptimisticTransaction";
import { usePrivy } from "@privy-io/react-auth";
import { formatEther } from "viem";
import { Button } from "../ui/button";
import { toast } from "sonner";

interface TransactionDemoProps {
  optimistic?: boolean;
}

export default function TransactionDemo({ optimistic = false }: TransactionDemoProps) {
  const { authenticated, ready: privyReady, user } = usePrivy();
  
  // Use either the standard or optimistic transaction hook based on props
  const standardHook = useTransaction();
  const optimisticHook = useOptimisticTransaction();
  
  // Choose which hook to use based on the optimistic prop
  const { 
    sendTx, 
    sendRawTransactionAndConfirm, 
    txLoading, 
    ready: txReady, 
    balance, 
    address: txAddress, 
    resetNonceAndBalance,
    hasApprovedWallet
  } = optimistic ? optimisticHook : standardHook;
  
  const [recipient, setRecipient] = useState("0x20ce27B140A0EEECceF880e01D2082558400FDd6");
  const [amount, setAmount] = useState("0.001");
  const [showingOptimisticUpdate, setShowingOptimisticUpdate] = useState(false);
  const [optimisticBalance, setOptimisticBalance] = useState<bigint | null>(null);

  // Handle transaction submission
  const handleSendTransaction = async () => {
    try {
      if (!txReady) {
        toast.error("Wallet not ready", {
          description: "Please wait for wallet to initialize",
        });
        return;
      }

      // For optimistic mode, update UI immediately
      if (optimistic && balance) {
        // Calculate new balance optimistically
        const valueInWei = BigInt(parseFloat(amount) * 10**18);
        const newBalance = balance - valueInWei;
        
        // Show optimistic update
        setOptimisticBalance(newBalance);
        setShowingOptimisticUpdate(true);
        
        toast.info("Transaction submitted", {
          description: `Showing optimistic balance update. Awaiting confirmation...`,
        });
      }

      await sendTx(recipient, amount);
      
      // Reset optimistic state after confirmed
      if (optimistic) {
        setShowingOptimisticUpdate(false);
      }
      
      // We don't need to show success toast here as the hook will handle it
    } catch (error) {
      console.error("Transaction error:", error);
      
      // Reset optimistic state if there was an error
      if (optimistic) {
        setShowingOptimisticUpdate(false);
      }
      
      // The hook will already show an error toast
    }
  };

  // Handle manual wallet refresh
  const handleRefreshWallet = async () => {
    try {
      await resetNonceAndBalance();
      
      // Reset optimistic state
      setShowingOptimisticUpdate(false);
      
      toast.success("Wallet refreshed", {
        description: "Wallet balance and nonce updated",
      });
    } catch (error) {
      console.error("Refresh error:", error);
      toast.error("Refresh failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  if (!privyReady) {
    return (
      <div className="p-4 text-center">
        <div className="w-16 h-16 mx-auto animate-spin rounded-full border-4 border-[#333333] border-t-[#ffc107]"></div>
        <p className="mt-4 text-white">Loading Privy...</p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="p-8 max-w-md mx-auto bg-[var(--ro-panel-bg)] rounded-lg">
        <h2 className="text-xl font-pixel mb-4 text-[var(--ro-gold)]">Transaction Demo</h2>
        <p className="mb-4 text-[var(--ro-text)]">Please login to use this feature</p>
      </div>
    );
  }

  // Calculate display balance
  const displayBalance = showingOptimisticUpdate && optimisticBalance !== null ? 
    optimisticBalance : 
    balance;

  return (
    <div className="p-8 max-w-md mx-auto bg-[var(--ro-panel-bg)] rounded-lg">
      <h2 className="text-xl font-pixel mb-4 text-[var(--ro-gold)]">
        {optimistic ? "Optimistic Transaction Demo" : "Standard Transaction Demo"}
      </h2>
      
      <div className="mb-6 p-4 border border-[var(--ro-border)] rounded-lg">
        <h3 className="text-lg font-pixel mb-2 text-[var(--ro-gold)]">Wallet Status</h3>
        <p className="text-[var(--ro-text)] mb-2">
          <span className="font-bold">Ready:</span> {txReady ? "✅" : "❌"}
        </p>
        <p className="text-[var(--ro-text)] mb-2">
          <span className="font-bold">Address:</span> {txAddress ? `${txAddress.slice(0, 6)}...${txAddress.slice(-4)}` : "Not connected"}
        </p>
        <p className="text-[var(--ro-text)] mb-2">
          <span className="font-bold">Balance:</span> {displayBalance ? (
            <span className={showingOptimisticUpdate ? "text-yellow-400" : ""}>
              {formatEther(displayBalance)} MONAD 
              {showingOptimisticUpdate && <small className="ml-2">(optimistic)</small>}
            </span>
          ) : "Loading..."}
        </p>
        {optimistic && (
          <p className="text-[var(--ro-text)] mb-2">
            <span className="font-bold">Approved:</span> {hasApprovedWallet ? "✅" : "❌"}
          </p>
        )}
        <Button 
          onClick={handleRefreshWallet} 
          className="w-full mt-4"
        >
          Refresh Wallet
        </Button>
      </div>
      
      <div className="mb-6 p-4 border border-[var(--ro-border)] rounded-lg">
        <h3 className="text-lg font-pixel mb-2 text-[var(--ro-gold)]">Send Transaction</h3>
        
        <div className="mb-4">
          <label className="block text-sm text-[var(--ro-text)] mb-1">Recipient Address</label>
          <input 
            type="text" 
            value={recipient} 
            onChange={(e) => setRecipient(e.target.value)} 
            className="w-full p-2 bg-[#333] border border-[var(--ro-border)] rounded focus:outline-none focus:border-[var(--ro-gold)]"
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-sm text-[var(--ro-text)] mb-1">Amount (MONAD)</label>
          <input 
            type="text" 
            value={amount} 
            onChange={(e) => setAmount(e.target.value)} 
            className="w-full p-2 bg-[#333] border border-[var(--ro-border)] rounded focus:outline-none focus:border-[var(--ro-gold)]"
          />
        </div>
        
        <Button 
          onClick={handleSendTransaction} 
          disabled={txLoading || !txReady} 
          className="w-full bg-[var(--ro-gold)] hover:bg-[#d4af37] text-black"
        >
          {txLoading ? "Sending..." : "Send Transaction"}
        </Button>
      </div>
      
      {optimistic && (
        <div className="p-4 border border-[var(--ro-border)] rounded-lg text-xs text-[var(--ro-text)]">
          <h4 className="font-bold mb-2">Optimistic UI</h4>
          <p>This demo shows optimistic UI updates - balance appears to change immediately before the transaction is confirmed.</p>
          <p className="mt-2">You will still see approval popups for each transaction.</p>
        </div>
      )}
    </div>
  );
} 