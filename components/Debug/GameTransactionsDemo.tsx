"use client";

import { useState, useEffect } from "react";
import { useTransactionQueue } from "@/hooks/useTransactionQueue";
import { usePrivy } from "@privy-io/react-auth";
import { formatEther } from "viem";
import { Button } from "../ui/button";
import { toast } from "sonner";

export default function GameTransactionsDemo() {
  const { authenticated, ready: privyReady, user } = usePrivy();
  const { 
    sendTx, 
    txLoading, 
    ready: txReady, 
    balance, 
    address: txAddress, 
    resetNonceAndBalance,
    hasApprovedQueue: hasApprovedWallet,
    approveTransactionQueue: approveWalletForTransactions,
    transactionQueue,
    isProcessingQueue
  } = useTransactionQueue();
  
  const [gamePoints, setGamePoints] = useState(0);
  const [gameInitialized, setGameInitialized] = useState(false);
  const [transactionCount, setTransactionCount] = useState(0);
  
  // Recipient for game actions - in a real game this would be a smart contract
  const gameContractAddress = "0x20ce27B140A0EEECceF880e01D2082558400FDd6";
  
  // Initialize the game
  const handleInitializeGame = async () => {
    try {
      if (!txReady) {
        toast.error("Wallet not ready", {
          description: "Please wait for wallet to initialize",
        });
        return;
      }

      // This will trigger the wallet approval popup just once
      if (!hasApprovedWallet) {
        toast.info("Wallet approval required", {
          description: "Please approve your wallet to authorize transactions for this game - this is a one-time approval",
        });

        console.log("Requesting transaction queue approval...");
        const approved = await approveWalletForTransactions();
        console.log("Approval result:", approved);
        
        if (!approved) {
          toast.error("Game initialization failed", {
            description: "Wallet approval was rejected",
          });
          return;
        }
        
        // Double-check localStorage after approval
        try {
          const walletAddress = user?.wallet?.address;
          if (walletAddress) {
            const storedData = localStorage.getItem(`${walletAddress}_tx_queue`);
            console.log("Stored queue data after approval:", storedData ? JSON.parse(storedData) : null);
          }
        } catch (e) {
          console.error("Error checking stored approval:", e);
        }
        
        // Important: wait a moment for the localStorage to be properly set
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        console.log("Queue already approved, not requesting approval again");
      }

      // Send a small tx to initialize the game
      console.log("Sending initialization transaction...");
      
      // Don't await the transaction result, just queue it
      const txId = await sendTx(gameContractAddress, "0.000001", {
        successText: "Game initialized with 0.000001 MONAD"
      });
      
      console.log("Transaction queued with ID:", txId);
      
      // Immediately update the UI
      setGameInitialized(true);
      setGamePoints(10);
      toast.success("Game initialized!", {
        description: "You've got 10 points to start. Tap to earn more!",
      });
    } catch (error) {
      console.error("Game initialization failed:", error);
      toast.error("Game initialization failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  // Handle player tap action - sends a micro-transaction
  const handleTapAction = async () => {
    if (!gameInitialized || txLoading) return;
    
    // Track previous state in case we need to revert
    const previousPoints = gamePoints;
    const previousTxCount = transactionCount;
    
    // Optimistically update UI immediately
    const pointsEarned = Math.floor(Math.random() * 5) + 1;
    setGamePoints(prev => prev + pointsEarned);
    setTransactionCount(prev => prev + 1);
    
    // Show immediate feedback
    toast.success(`+${pointsEarned} points!`, {
      description: "Processing in background...",
    });
    
    try {
      // Check queue status before sending
      console.log("Current queue status - hasApprovedQueue:", hasApprovedWallet);
      console.log("Transaction queue length:", transactionQueue.length);
      console.log("Is processing queue:", isProcessingQueue);
      
      // Queue the transaction in background - no popup should appear
      // We will NOT await this promise, just fire and forget
      console.log("Queueing transaction...");
      
      sendTx(gameContractAddress, "0.0000001", {
        successText: `Earned ${pointsEarned} points`
      })
        .then(txId => {
          // Transaction was successfully queued
          console.log("Transaction successfully queued with ID:", txId);
        })
        .catch(error => {
          // Only revert UI if queueing fails
          console.error("Failed to queue transaction:", error);
          setGamePoints(previousPoints);
          setTransactionCount(previousTxCount);
          
          toast.error("Action failed", {
            description: error instanceof Error ? error.message : "Transaction failed",
          });
        });
      
      // Don't await - continue UI flow immediately regardless of transaction outcome
      
    } catch (error) {
      // This should only catch errors in the initial setup, not transaction errors
      console.error("Setup error in tap action:", error);
      setGamePoints(previousPoints);
      setTransactionCount(previousTxCount);
    }
  };

  // Handle manual wallet refresh
  const handleRefreshWallet = async () => {
    try {
      await resetNonceAndBalance();
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
        <h2 className="text-xl font-pixel mb-4 text-[var(--ro-gold)]">Tap To Earn Game Demo</h2>
        <p className="mb-4 text-[var(--ro-text)]">Please login to use this feature</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-md mx-auto bg-[var(--ro-panel-bg)] rounded-lg">
      <h2 className="text-xl font-pixel mb-4 text-[var(--ro-gold)]">Tap To Earn Game Demo</h2>
      
      <div className="mb-6 p-4 border border-[var(--ro-border)] rounded-lg">
        <h3 className="text-lg font-pixel mb-2 text-[var(--ro-gold)]">Wallet Status</h3>
        <p className="text-[var(--ro-text)] mb-2">
          <span className="font-bold">Ready:</span> {txReady ? "✅" : "❌"}
        </p>
        <p className="text-[var(--ro-text)] mb-2">
          <span className="font-bold">Address:</span> {txAddress ? `${txAddress.slice(0, 6)}...${txAddress.slice(-4)}` : "Not connected"}
        </p>
        <p className="text-[var(--ro-text)] mb-2">
          <span className="font-bold">Balance:</span> {balance ? `${formatEther(balance)} MONAD` : "Loading..."}
        </p>
        <p className="text-[var(--ro-text)] mb-2">
          <span className="font-bold">Approved:</span> {hasApprovedWallet ? "✅" : "❌"}
        </p>
        <p className="text-[var(--ro-text)] mb-4">
          <span className="font-bold">Queue:</span> {transactionQueue.length} transactions ({
            transactionQueue.filter(tx => tx.status === 'queued').length
          } queued, {
            transactionQueue.filter(tx => tx.status === 'processing').length
          } processing, {
            transactionQueue.filter(tx => tx.status === 'completed').length
          } completed, {
            transactionQueue.filter(tx => tx.status === 'failed').length
          } failed)
        </p>
        <Button 
          onClick={handleRefreshWallet} 
          className="w-full"
        >
          Refresh Wallet
        </Button>
      </div>
      
      {!gameInitialized ? (
        <div className="mb-6 p-4 border border-[var(--ro-border)] rounded-lg text-center">
          <h3 className="text-lg font-pixel mb-4 text-[var(--ro-gold)]">Start Game</h3>
          <p className="text-[var(--ro-text)] mb-6">
            Initialize the game to start earning points. This will require a one-time wallet approval.
          </p>
          <Button 
            onClick={handleInitializeGame} 
            disabled={txLoading || !txReady} 
            className="w-full bg-[var(--ro-gold)] hover:bg-[#d4af37] text-black"
          >
            {txLoading ? "Initializing..." : "Initialize Game"}
          </Button>
        </div>
      ) : (
        <div className="mb-6 p-4 border border-[var(--ro-border)] rounded-lg text-center">
          <h3 className="text-lg font-pixel mb-2 text-[var(--ro-gold)]">Game Progress</h3>
          <div className="text-3xl font-pixel text-white my-6">
            {gamePoints} Points
          </div>
          <p className="text-[var(--ro-text)] mb-2">
            Transactions sent: {transactionCount}
          </p>
          <p className="text-[var(--ro-text)] mb-4">
            Queue processing: {isProcessingQueue ? "✅" : "❌"}
          </p>
          <div 
            onClick={handleTapAction}
            className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center cursor-pointer transition-transform ${txLoading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'} bg-gradient-to-br from-purple-600 to-blue-500`}
          >
            <span className="text-white font-pixel text-xl">TAP</span>
          </div>
          <p className="text-[var(--ro-text)] mt-4 text-sm">
            Tap to earn points and send silent transactions
          </p>
        </div>
      )}
      
      {gameInitialized && (
        <div className="mb-6 p-4 border border-[var(--ro-border)] rounded-lg">
          <h3 className="text-lg font-pixel mb-2 text-[var(--ro-gold)]">Transaction Queue</h3>
          <div className="max-h-60 overflow-y-auto">
            {transactionQueue.length === 0 ? (
              <p className="text-[var(--ro-text)] text-center my-4">No transactions in queue</p>
            ) : (
              <div className="space-y-2">
                {transactionQueue.map(tx => (
                  <div key={tx.id} className="p-2 border border-gray-700 rounded text-sm">
                    <div className="flex justify-between mb-1">
                      <span className="font-bold">Status:</span>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        tx.status === 'queued' ? 'bg-yellow-700 text-yellow-200' :
                        tx.status === 'processing' ? 'bg-blue-700 text-blue-200' :
                        tx.status === 'completed' ? 'bg-green-700 text-green-200' :
                        'bg-red-700 text-red-200'
                      }`}>{tx.status.toUpperCase()}</span>
                    </div>
                    {tx.txHash && (
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-bold">Hash:</span>
                        <a 
                          href={`https://testnet.monadexplorer.com/tx/${tx.txHash}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline"
                        >
                          {tx.txHash.substring(0, 6)}...{tx.txHash.substring(tx.txHash.length - 4)}
                        </a>
                      </div>
                    )}
                    <div className="flex justify-between text-xs">
                      <span className="font-bold">Time:</span>
                      <span>{new Date(tx.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 