import { useCallback } from 'react';
import { useTransactionQueue } from './useTransactionQueue';
import { 
  Hex,
  parseGwei 
} from 'viem';

/**
 * A hook that provides transaction functionality using a queuing system
 * but maintains compatibility with the existing transaction API
 */
export function useOptimisticTransaction() {
  const {
    sendTx: queueSendTx,
    queueTransaction,
    cancelTransaction,
    clearCompletedTransactions,
    txLoading,
    txError,
    ready,
    balance,
    address,
    resetNonceAndBalance,
    encodeFunctionData,
    hasApprovedQueue,
    approveTransactionQueue,
    transactionQueue,
    isProcessingQueue,
  } = useTransactionQueue();

  // Wrapper for queueTransaction that matches the existing sendRawTransactionAndConfirm API
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
    // Queue the transaction instead of sending it immediately
    // This will return a transaction ID, but we'll return a promise that resolves
    // when the transaction is completed or fails
    
    return new Promise<string>((resolve, reject) => {
      // Create success and error handlers
      const onSuccess = (txHash: string) => {
        resolve(txHash);
      };
      
      const onError = (error: Error) => {
        reject(error);
      };
      
      // Queue the transaction
      queueTransaction({
        to,
        value,
        data,
        gas,
        maxFeePerGas,
        maxPriorityFeePerGas,
        successText,
        onSuccess,
        onError
      }).catch(reject); // Handle queueing errors
    });
  }, [queueTransaction]);
  
  // Override sendTx to use the queue but maintain the same API
  const sendTx = useCallback(async (to: string, value: string) => {
    // Use the queue under the hood
    return new Promise<string>((resolve, reject) => {
      queueSendTx(to, value, {
        successText: `Sent ${value} MONAD to ${to.substring(0, 6)}...${to.substring(to.length - 4)}`
      })
        .then(txId => {
          // Find the transaction in the queue and wait for it to complete
          const checkInterval = setInterval(() => {
            const tx = transactionQueue.find(t => t.id === txId);
            if (!tx) {
              clearInterval(checkInterval);
              reject(new Error("Transaction not found in queue"));
            } else if (tx.status === 'completed' && tx.txHash) {
              clearInterval(checkInterval);
              resolve(tx.txHash);
            } else if (tx.status === 'failed') {
              clearInterval(checkInterval);
              reject(new Error(tx.error || "Transaction failed"));
            }
          }, 1000);
        })
        .catch(reject);
    });
  }, [queueSendTx, transactionQueue]);
  
  // Return the same API as useTransaction but with queue functionality
  return {
    sendTx,
    sendRawTransactionAndConfirm,
    txLoading,
    txError,
    ready,
    balance,
    address,
    resetNonceAndBalance,
    encodeFunctionData,
    hasApprovedWallet: hasApprovedQueue,
    approveWalletForTransactions: approveTransactionQueue,
    // Additional queue-specific properties
    transactionQueue,
    isProcessingQueue,
    cancelTransaction,
    clearCompletedTransactions,
    queueTransaction,
  };
} 