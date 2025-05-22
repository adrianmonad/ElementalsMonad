"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useTransaction } from "@/hooks/useTransaction";
import { toast } from "sonner";

export default function WalletDebugPage() {
  const { user, login, ready, authenticated, logout } = usePrivy();
  const { sendTx, txLoading, ready: txReady, balance, hasApprovedWallet, approveWalletForTransactions } = useTransaction();
  const [isMobile, setIsMobile] = useState(false);
  const [walletState, setWalletState] = useState<any>({});
  const [testTxHash, setTestTxHash] = useState<string | null>(null);

  // Detect mobile browser
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || '';
      setIsMobile(/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase()));
    }
  }, []);

  // Update wallet state for debugging
  useEffect(() => {
    if (user) {
      setWalletState({
        ready,
        authenticated,
        hasWallet: !!user.wallet,
        walletAddress: user.wallet?.address,
        transactionReady: txReady,
        hasBalance: !!balance,
        balanceAmount: balance ? balance.toString() : '0',
        hasApprovedWallet
      });
    }
  }, [user, ready, authenticated, txReady, balance, hasApprovedWallet]);

  // Function to log wallet details
  const logWalletDetails = () => {
    console.log("[MOBILE-DEBUG] Current wallet state:", {
      user: user ? { id: user.id, wallet: user.wallet } : null,
      ready,
      authenticated,
      txReady,
      balance: balance ? balance.toString() : null,
      hasApprovedWallet
    });
    
    toast.info("Wallet details logged to console");
  };

  // Function to reset local storage
  const resetLocalStorage = () => {
    if (user?.wallet?.address) {
      localStorage.removeItem(`${user.wallet.address}_tx_approval`);
      toast.success("Local storage reset");
      setTimeout(() => window.location.reload(), 1000);
    } else {
      toast.error("No wallet address found");
    }
  };

  // Function to send a test transaction
  const sendTestTransaction = async () => {
    if (!txReady) {
      toast.error("Transaction system not ready");
      return;
    }
    
    try {
      toast.loading("Sending test transaction...");
      const hash = await sendTx("0xdead000000000000000000000000000000000000", "0.00001");
      setTestTxHash(hash);
      toast.success("Transaction sent");
    } catch (error) {
      console.error("[MOBILE-DEBUG] Transaction error:", error);
      toast.error(`Transaction failed: ${(error as Error).message}`);
    }
  };

  // Function to force wallet approval
  const forceApproval = async () => {
    try {
      toast.loading("Requesting wallet approval...");
      const success = await approveWalletForTransactions();
      if (success) {
        toast.success("Wallet approved for transactions");
      } else {
        toast.error("Wallet approval failed");
      }
    } catch (error) {
      console.error("[MOBILE-DEBUG] Approval error:", error);
      toast.error(`Approval failed: ${(error as Error).message}`);
    }
  };

  // Function to force reload page after clearing localStorage
  const forceRecovery = () => {
    try {
      // For mobile recovery, we clear all approval data and refresh
      if (user?.wallet?.address) {
        localStorage.removeItem(`${user.wallet.address}_tx_approval`);
        localStorage.setItem('force_wallet_recovery', 'true');
        toast.success("Recovery initiated");
        // Force page reload to reinitialize wallet
        setTimeout(() => window.location.reload(), 1000);
      } else {
        toast.error("No wallet address found");
      }
    } catch (error) {
      console.error("[MOBILE-DEBUG] Recovery error:", error);
      toast.error(`Recovery failed: ${(error as Error).message}`);
    }
  };

  // Check for recovery flag on load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const recoveryFlag = localStorage.getItem('force_wallet_recovery');
      if (recoveryFlag === 'true') {
        // Clear the flag
        localStorage.removeItem('force_wallet_recovery');
        // Show toast about recovery
        toast.info("Recovery mode active", {
          description: "Reinitializing wallet for mobile...",
          duration: 5000
        });
        // Log details for debugging
        console.log("[MOBILE-DEBUG] Recovery mode - force reinitializing wallet");
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-center mb-8">Wallet Debug Tool</h1>
        
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <h2 className="text-xl font-semibold mb-4">User State</h2>
          
          {!authenticated ? (
            <button
              onClick={() => login()}
              className="w-full bg-blue-600 rounded-lg py-2 font-medium hover:bg-blue-700"
            >
              Login with Email
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>User Email:</span>
                <span className="font-mono">{user?.email?.address || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span>Wallet Address:</span>
                <span className="font-mono truncate max-w-[200px]">
                  {user?.wallet?.address || "No wallet"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Transaction Ready:</span>
                <span className={txReady ? "text-green-400" : "text-red-400"}>
                  {txReady ? "✅" : "❌"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Wallet Approved:</span>
                <span className={hasApprovedWallet ? "text-green-400" : "text-red-400"}>
                  {hasApprovedWallet ? "✅" : "❌"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Balance:</span>
                <span>
                  {balance ? Number(balance) / 10**18 : "Loading..."} MONAD
                </span>
              </div>
              <div className="flex justify-between">
                <span>Platform:</span>
                <span>{isMobile ? "Mobile 📱" : "Desktop 💻"}</span>
              </div>
            </div>
          )}
        </div>
        
        {authenticated && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={logWalletDetails}
                className="bg-purple-600 rounded-lg py-3 font-medium hover:bg-purple-700"
              >
                Log Details
              </button>
              
              <button
                onClick={resetLocalStorage}
                className="bg-red-600 rounded-lg py-3 font-medium hover:bg-red-700"
              >
                Reset Storage
              </button>
            </div>
            
            <button
              onClick={forceApproval}
              disabled={txLoading || !txReady}
              className="w-full bg-green-600 rounded-lg py-3 font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Force Wallet Approval
            </button>
            
            <button
              onClick={forceRecovery}
              className="w-full bg-orange-600 rounded-lg py-3 font-medium hover:bg-orange-700"
            >
              Force Mobile Recovery
            </button>
            
            <button
              onClick={sendTestTransaction}
              disabled={txLoading || !txReady || !hasApprovedWallet}
              className="w-full bg-yellow-600 rounded-lg py-3 font-medium hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send Test Transaction
            </button>
            
            {testTxHash && (
              <div className="mt-4 p-3 bg-gray-800 rounded-lg">
                <p className="text-sm">Transaction Hash:</p>
                <a
                  href={`https://testnet.monadexplorer.com/tx/${testTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline break-all text-sm font-mono"
                >
                  {testTxHash}
                </a>
              </div>
            )}
            
            <button
              onClick={() => logout()}
              className="w-full bg-gray-600 rounded-lg py-3 font-medium hover:bg-gray-700 mt-6"
            >
              Logout
            </button>
          </div>
        )}
        
        <div className="mt-8 border-t border-gray-700 pt-4">
          <h3 className="text-lg font-semibold mb-2">Debug Information</h3>
          <pre className="bg-gray-800 p-3 rounded-lg overflow-x-auto text-xs">
            {JSON.stringify(walletState, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
} 