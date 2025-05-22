import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useState, useEffect, useRef } from 'react';
import { formatEther, parseEther, Hex, createWalletClient, custom } from 'viem';
import { monadTestnet } from 'viem/chains';
import { publicClient } from '../utils/publicClient';

export function useEmbeddedWalletTransactions() {
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const [address, setAddress] = useState<string>("");
  const userNonce = useRef<number>(0);
  const userBalance = useRef<bigint>(BigInt(0));
  
  // Extract embedded wallet address
  useEffect(() => {
    if (!user) {
      setAddress("");
      return;
    }

    const [privyUser] = user.linkedAccounts.filter(
      (account) => 
        account.type === "wallet" && 
        account.walletClientType === "privy"
    );
    
    if (!privyUser || !(privyUser as any).address) {
      setAddress("");
      return;
    }

    const embeddedAddress = (privyUser as any).address;
    setAddress(embeddedAddress);
    
    // Get initial nonce and balance
    if (embeddedAddress) {
      resetNonceAndBalance(embeddedAddress);
    }
  }, [user]);

  // Reset nonce and balance
  const resetNonceAndBalance = async (walletAddress = address) => {
    if (!walletAddress) return;
    
    try {
      const [nonce, balance] = await Promise.all([
        publicClient.getTransactionCount({ address: walletAddress as Hex }),
        publicClient.getBalance({ address: walletAddress as Hex })
      ]);
      
      userNonce.current = nonce;
      userBalance.current = balance;
      console.log(`Reset nonce: ${nonce}, balance: ${formatEther(balance)}`);
    } catch (error) {
      console.error("Failed to reset nonce and balance:", error);
    }
  };

  // Send a simple transaction (transfer to self)
  const sendTestTransaction = async () => {
    if (!address || !user) {
      throw new Error("No embedded wallet available");
    }
    
    // Find the embedded wallet from the wallets array
    const privyWallet = wallets.find(wallet => 
      wallet.walletClientType === 'privy'
    );
    
    if (!privyWallet) {
      throw new Error("Embedded wallet not found");
    }
    
    const balance = userBalance.current;
    if (balance < parseEther("0.00002")) {
      throw new Error("Insufficient balance for test transaction");
    }
    
    const nonce = userNonce.current;
    userNonce.current = nonce + 1;
    userBalance.current = balance - parseEther("0.00001");
    
    try {
      // Get the Ethereum provider from the embedded wallet
      const provider = await privyWallet.getEthereumProvider();
      
      // Create a wallet client using viem
      const walletClient = createWalletClient({
        chain: monadTestnet,
        transport: custom(provider)
      });
      
      // Send transaction using the wallet client
      const txHash = await walletClient.sendTransaction({
        to: address as Hex, // Sending to self
        value: parseEther("0.00001"),
        account: address as Hex,
        nonce
      });
      
      console.log(`Transaction hash: ${txHash}`);
      return txHash;
    } catch (error) {
      // Revert nonce on failure
      userNonce.current = nonce;
      userBalance.current = balance;
      console.error("Transaction failed:", error);
      throw error;
    }
  };

  return {
    address,
    resetNonceAndBalance,
    sendTestTransaction,
    balance: userBalance.current
  };
} 