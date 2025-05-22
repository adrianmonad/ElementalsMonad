import { useState, useEffect, useCallback } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';

interface PregenWalletResult {
  walletAddress: string | null;
  userId: string | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  signMessage?: (message: string) => Promise<string | null>;
  sendTransaction?: (to: string, valueInEth: string) => Promise<string | null>;
  providerReady: boolean;
}

export default function usePregenWallet(): PregenWalletResult {
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [providerReady, setProviderReady] = useState<boolean>(false);

  const fetchWallet = async (email: string) => {
    if (!email) {
      setError('No email provided');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // First try to get an existing wallet from the pregen-wallet endpoint
      const response = await fetch(`/api/pregen-wallet?email=${encodeURIComponent(email)}`);
      
      // If the pregen endpoint fails, try to generate a new wallet
      if (!response.ok) {
        console.log('No pre-generated wallet found, generating new wallet...');
        
        // Use the new API route to generate a wallet
        const generateResponse = await fetch('/api/generateWallet', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
        });
        
        if (!generateResponse.ok) {
          const errorData = await generateResponse.json();
          throw new Error(errorData.error || 'Failed to generate wallet');
        }
        
        const data = await generateResponse.json();
        console.log('New wallet generated:', data);
        setWalletAddress(data.walletAddress);
        setUserId(data.userId);
        return;
      }
      
      // If we successfully got a pre-generated wallet
      const data = await response.json();
      console.log('Pre-generated wallet fetched:', data);
      setWalletAddress(data.walletAddress);
      setUserId(data.userId);
    } catch (err) {
      console.error('Error fetching/generating wallet:', err);
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  // Automatically fetch wallet when user email is available
  useEffect(() => {
    if (user?.email?.address) {
      fetchWallet(user.email.address);
    }
  }, [user?.email?.address]);

  // Get the provider from the Privy wallet once it's available
  const getProvider = useCallback(async () => {
    if (!wallets || wallets.length === 0) {
      console.log('No wallets available yet');
      return null;
    }

    try {
      // Look for the user's embedded Privy wallet
      console.log('Available wallets:', wallets.map(w => ({
        type: w.walletClientType,
        address: w.address
      })));
      const wallet = wallets.find(w => w.walletClientType === 'privy');
      if (!wallet) {
        console.log('No Privy wallet found');
        return null;
      }

      // Get the EIP-1193 provider
      console.log('Found Privy wallet:', wallet.address);
      const provider = await wallet.getEthereumProvider();
      console.log('Got Ethereum provider:', !!provider);
      setProviderReady(true);
      return { provider, wallet };
    } catch (err) {
      console.error('Error getting wallet provider:', err);
      return null;
    }
  }, [wallets]);

  // Method to sign a message using the wallet
  const signMessage = useCallback(async (message: string): Promise<string | null> => {
    try {
      const result = await getProvider();
      if (!result) {
        throw new Error('No wallet provider available');
      }
      
      const { provider, wallet } = result;
      
      // Use personal_sign RPC method
      const signature = await provider.request({
        method: 'personal_sign',
        params: [message, wallet.address]
      });
      
      console.log('Message signed successfully:', signature);
      return signature;
    } catch (err) {
      console.error('Error signing message:', err);
      setError((err as Error).message);
      return null;
    }
  }, [getProvider]);

  // Method to send a transaction
  const sendTransaction = useCallback(async (to: string, valueInEth: string): Promise<string | null> => {
    try {
      console.log('Send transaction called with:', { to, valueInEth });
      const result = await getProvider();
      console.log('Provider result:', !!result);
      
      if (!result) {
        throw new Error('No wallet provider available');
      }
      
      const { provider, wallet } = result;
      console.log('Using wallet:', wallet.address);
      
      // Convert ETH value to Wei (hex string)
      const valueInWei = (Number(valueInEth) * 1e18).toString(16);
      const valueHex = '0x' + valueInWei;
      console.log('Value in hex:', valueHex);
      
      // Prepare transaction
      const txParams = {
        from: wallet.address,
        to,
        value: valueHex,
        chainId: '0x2797', // 10143 in hex for Monad Testnet
      };
      console.log('Transaction params:', txParams);
      
      // Send transaction using eth_sendTransaction
      console.log('Sending transaction with eth_sendTransaction...');
      const txHash = await provider.request({
        method: 'eth_sendTransaction',
        params: [txParams]
      });
      
      console.log('Transaction sent successfully:', txHash);
      return txHash;
    } catch (err) {
      console.error('Error sending transaction:', err);
      setError((err as Error).message);
      return null;
    }
  }, [getProvider]);

  // Check if the provider is available whenever wallets change
  useEffect(() => {
    if (wallets && wallets.length > 0) {
      console.log('Checking wallet provider availability...');
      
      // List available wallets for debugging
      console.log('Available wallets:', wallets.map(w => ({
        type: w.walletClientType,
        address: w.address
      })));
      
      getProvider().then(result => {
        const isReady = !!result;
        console.log('Provider readiness set to:', isReady);
        setProviderReady(isReady);
        
        if (isReady) {
          // Immediately attempt a test message signing to verify functionality
          console.log('Testing provider with message signing...');
          const testMessage = 'Test message to verify provider functionality';
          result.provider.request({
            method: 'eth_requestAccounts',
            params: []
          }).then(accounts => {
            console.log('Accounts:', accounts);
          }).catch(err => {
            console.error('Error requesting accounts:', err);
          });
        }
      });
    } else {
      console.log('No wallets available yet');
    }
  }, [wallets, getProvider]);

  // Allow manual refetching
  const refetch = async () => {
    if (user?.email?.address) {
      await fetchWallet(user.email.address);
    } else {
      setError('No user email found for refetching');
    }
  };

  return {
    walletAddress,
    userId,
    isLoading,
    error,
    refetch,
    signMessage,
    sendTransaction,
    providerReady
  };
} 