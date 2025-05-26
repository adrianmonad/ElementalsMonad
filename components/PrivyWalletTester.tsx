"use client";

import { useState } from 'react';
import { usePrivyWallet } from '@/hooks/usePrivyWallet';
import { parseEther, Hex } from 'viem';
import { Toaster } from 'sonner';

export function PrivyWalletTester() {
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isTransacting, setIsTransacting] = useState(false);

  // Use our custom hook
  const {
    isInitialized,
    isLoading,
    embeddedWalletAddress,
    balance,
    initializeWallet,
    sendTestTransaction,
    sendRawTransaction
  } = usePrivyWallet();

  // Handle test transaction
  const handleTestTransaction = async () => {
    setIsTransacting(true);
    try {
      const hash = await sendTestTransaction();
      setTxHash(hash);
    } catch (error) {
      console.error("Test transaction failed:", error);
    } finally {
      setIsTransacting(false);
    }
  };

  // Example of a custom transaction that works with your existing structure
  const handleCustomTransaction = async () => {
    if (!embeddedWalletAddress) return;
    
    setIsTransacting(true);
    try {
      // This demonstrates how you can send MONAD to itself while maintaining
      // your existing transaction structure
      const hash = await sendRawTransaction({
        to: embeddedWalletAddress, // Send to self
        value: parseEther("0.00001"), // Very small amount
        data: "0x", // No data for simple transfer
        gasLimit: BigInt(21000), // Standard gas for transfers
        onSuccess: (txHash) => {
          console.log("Custom transaction successful:", txHash);
          setTxHash(txHash);
        }
      });
      
      setTxHash(hash);
    } catch (error) {
      console.error("Custom transaction failed:", error);
    } finally {
      setIsTransacting(false);
    }
  };

  return (
    <div className="p-6 max-w-lg mx-auto bg-gray-800 rounded-lg shadow-md mt-10">
      <Toaster position="top-center" />
      
      <h2 className="text-2xl font-bold mb-4 text-white">Privy Embedded Wallet Tester</h2>
      
      {/* Wallet Status */}
      <div className="mb-6 p-4 bg-gray-700 rounded-md">
        <h3 className="text-lg font-semibold mb-2 text-white">Wallet Status</h3>
        <p className="text-gray-300">
          <span className="font-medium">Initialized:</span>{' '}
          <span className={isInitialized ? 'text-green-400' : 'text-red-400'}>
            {isInitialized ? 'Yes' : 'No'}
          </span>
        </p>
        <p className="text-gray-300">
          <span className="font-medium">Loading:</span>{' '}
          {isLoading ? 'Yes' : 'No'}
        </p>
        <p className="text-gray-300">
          <span className="font-medium">Address:</span>{' '}
          {embeddedWalletAddress || 'Not available'}
        </p>
        <p className="text-gray-300">
          <span className="font-medium">Balance:</span>{' '}
          {balance ? `${balance} MONAD` : '0 MONAD'}
        </p>
      </div>
      
      {/* Actions */}
      <div className="space-y-4">
        {!isInitialized && (
          <button
            onClick={initializeWallet}
            disabled={isLoading}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50"
          >
            {isLoading ? 'Initializing...' : 'Initialize Wallet'}
          </button>
        )}
        
        {isInitialized && (
          <>
            <button
              onClick={handleTestTransaction}
              disabled={isTransacting || !embeddedWalletAddress}
              className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-md disabled:opacity-50"
            >
              {isTransacting ? 'Sending...' : 'Send Test Transaction (to self)'}
            </button>
            
            <button
              onClick={handleCustomTransaction}
              disabled={isTransacting || !embeddedWalletAddress}
              className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-md disabled:opacity-50"
            >
              {isTransacting ? 'Sending...' : 'Custom Transaction (same structure)'}
            </button>
          </>
        )}
      </div>
      
      {/* Transaction Result */}
      {txHash && (
        <div className="mt-6 p-4 bg-gray-700 rounded-md">
          <h3 className="text-lg font-semibold mb-2 text-white">Transaction Sent</h3>
          <p className="text-gray-300 break-all">
            <span className="font-medium">Hash:</span> {txHash}
          </p>
          <a
            href={`https://testnet.monadexplorer.com/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-2 text-blue-400 hover:text-blue-300"
          >
            View on Block Explorer
          </a>
        </div>
      )}
    </div>
  );
} 