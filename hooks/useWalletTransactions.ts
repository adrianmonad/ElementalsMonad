import { useState, useEffect, useCallback } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import type { ConnectedWallet } from '@privy-io/react-auth';

interface WalletInfo {
  availableWallets?: Array<{
    type: string;
    address: string;
    chainId?: number | string;
    isConnected?: boolean | (() => Promise<boolean>);
  }>;
  providerAvailable?: boolean;
  walletAddress?: string;
  walletType?: string;
  providerError?: string;
  userId?: string;
  userWallet?: any;
  error?: string;
}

interface WalletTransactionsResult {
  walletAddress: string | null;
  userId: string | null;
  isLoading: boolean;
  error: string | null;
  signMessage: (message: string) => Promise<string | null>;
  sendTransaction: (to: string, valueInEth: string) => Promise<string | null>;
  walletReady: boolean;
  walletInfo: WalletInfo; // For debug purposes
}

export default function useWalletTransactions(): WalletTransactionsResult {
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [walletReady, setWalletReady] = useState<boolean>(false);
  const [wallet, setWallet] = useState<ConnectedWallet | null>(null);
  const [walletInfo, setWalletInfo] = useState<WalletInfo>({});

  // Find the best wallet to use for transactions
  const findWallet = useCallback(() => {
    if (!wallets || wallets.length === 0) {
      console.log('[MOBILE-DEBUG] No wallets available yet');
      return null;
    }

    try {
      // Log more detailed wallet info for debugging
      const walletsInfo = wallets.map(w => ({
        type: w.walletClientType,
        address: w.address,
        chainId: w.chainId,
        isConnected: w.isConnected
      }));
      
      console.log('[MOBILE-DEBUG] Available wallets:', JSON.stringify(walletsInfo));
      setWalletInfo({ availableWallets: walletsInfo });
      
      // Prioritize embedded wallets that can sign (privy)
      const embeddedWallet = wallets.find(w => w.walletClientType === 'privy');
      if (embeddedWallet) {
        console.log('[MOBILE-DEBUG] Using Privy embedded wallet:', embeddedWallet.address);
        return embeddedWallet;
      }
      
      // Fall back to any connected wallet
      if (wallets.length > 0) {
        console.log('[MOBILE-DEBUG] Using first available wallet:', wallets[0].address);
        return wallets[0];
      }
      
      return null;
    } catch (err) {
      console.error('[MOBILE-DEBUG] Error finding wallet:', err);
      setWalletInfo({ error: (err as Error).message });
      return null;
    }
  }, [wallets]);

  // Update wallet address whenever wallets change
  useEffect(() => {
    const currentWallet = findWallet();
    if (currentWallet) {
      setWallet(currentWallet);
      setWalletAddress(currentWallet.address);
      setIsLoading(false);
      
      // Test if the wallet can sign
      currentWallet.getEthereumProvider()
        .then(provider => {
          if (provider) {
            console.log('[MOBILE-DEBUG] Wallet provider is available');
            setWalletReady(true);
            setWalletInfo(prev => ({ 
              ...prev, 
              providerAvailable: true,
              walletAddress: currentWallet.address,
              walletType: currentWallet.walletClientType
            }));
          } else {
            console.log('[MOBILE-DEBUG] Wallet provider not available');
            setWalletReady(false);
            setWalletInfo(prev => ({ 
              ...prev, 
              providerAvailable: false,
              walletAddress: currentWallet.address,
              walletType: currentWallet.walletClientType
            }));
          }
        })
        .catch(err => {
          console.error('[MOBILE-DEBUG] Error getting wallet provider:', err);
          setWalletReady(false);
          setWalletInfo(prev => ({ 
            ...prev, 
            providerError: (err as Error).message
          }));
        });
    } else {
      setWalletReady(false);
      console.log('[MOBILE-DEBUG] No current wallet found');
    }
  }, [wallets, findWallet]);

  // Set user ID from Privy
  useEffect(() => {
    if (user) {
      console.log('[MOBILE-DEBUG] User data:', JSON.stringify({
        userId: user.id,
        hasEmbeddedWallets: !!user.wallet,
        walletCount: user.wallet ? 1 : 0
      }));
      
      setUserId(user.id);
      setWalletInfo(prev => ({ 
        ...prev, 
        userId: user.id,
        userWallet: user.wallet
      }));
    }
  }, [user]);

  // Method to sign a message using the wallet
  const signMessage = useCallback(async (message: string): Promise<string | null> => {
    if (!wallet) {
      console.error('[MOBILE-DEBUG] No wallet available for signing');
      setError('No wallet available for signing');
      return null;
    }
    
    try {
      console.log('[MOBILE-DEBUG] Attempting to get provider for message signing');
      const provider = await wallet.getEthereumProvider();
      
      console.log('[MOBILE-DEBUG] Attempting to sign message with wallet:', wallet.address);
      // Use personal_sign RPC method
      const signature = await provider.request({
        method: 'personal_sign',
        params: [message, wallet.address]
      });
      
      console.log('[MOBILE-DEBUG] Message signed successfully:', signature);
      return signature;
    } catch (err) {
      console.error('[MOBILE-DEBUG] Error signing message:', err);
      setError((err as Error).message);
      return null;
    }
  }, [wallet]);

  // Method to send a transaction
  const sendTransaction = useCallback(async (to: string, valueInEth: string): Promise<string | null> => {
    if (!wallet) {
      console.error('[MOBILE-DEBUG] No wallet available for transaction');
      setError('No wallet available for transaction');
      return null;
    }
    
    try {
      console.log('[MOBILE-DEBUG] Send transaction called with:', { to, valueInEth });
      
      console.log('[MOBILE-DEBUG] Getting Ethereum provider');
      const provider = await wallet.getEthereumProvider();
      console.log('[MOBILE-DEBUG] Using wallet:', wallet.address);
      
      // Convert ETH value to Wei (hex string)
      const valueInWei = (Number(valueInEth) * 1e18).toString(16);
      const valueHex = '0x' + valueInWei;
      console.log('[MOBILE-DEBUG] Value in hex:', valueHex);
      
      // Prepare transaction
      const txParams = {
        from: wallet.address,
        to,
        value: valueHex,
        chainId: '0x2797', // 10143 in hex for Monad Testnet
      };
      console.log('[MOBILE-DEBUG] Transaction params:', JSON.stringify(txParams));
      
      // First make sure accounts are accessible
      console.log('[MOBILE-DEBUG] Requesting accounts access');
      try {
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
        console.log('[MOBILE-DEBUG] Accounts available:', accounts);
      } catch (accountErr) {
        console.error('[MOBILE-DEBUG] Error requesting accounts:', accountErr);
      }
      
      // Send transaction using eth_sendTransaction
      console.log('[MOBILE-DEBUG] Sending transaction with eth_sendTransaction...');
      const txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [txParams]
      });
      
      console.log('[MOBILE-DEBUG] Transaction sent successfully:', txHash);
      return txHash;
    } catch (err) {
      console.error('[MOBILE-DEBUG] Error sending transaction:', JSON.stringify(err));
      setError((err as Error).message);
      return null;
    }
  }, [wallet]);

  return {
    walletAddress,
    userId,
    isLoading,
    error,
    signMessage,
    sendTransaction,
    walletReady,
    walletInfo
  };
} 