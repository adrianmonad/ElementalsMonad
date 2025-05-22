import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useState, useEffect, useRef } from 'react';
import { formatEther, parseEther, Hex, createWalletClient, custom, parseGwei } from 'viem';
import { monadTestnet } from 'viem/chains';
import { publicClient } from '../utils/publicClient';

export default function WalletTest() {
  const { login, logout, authenticated, user } = usePrivy();
  const { ready, wallets } = useWallets();
  const [address, setAddress] = useState<string>("");
  const [balance, setBalance] = useState<string>("0");
  const [txHash, setTxHash] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // Keep track of wallet client, nonce and balance
  const walletClient = useRef<any>(null);
  const userNonce = useRef<number>(0);
  const userBalance = useRef<bigint>(BigInt(0));
  
  // Extract embedded wallet address when user changes
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
    
    // Get balance and nonce
    if (embeddedAddress) {
      fetchBalanceAndNonce(embeddedAddress);
    }
  }, [user]);
  
  // Set up wallet client when wallets change
  useEffect(() => {
    async function setupWalletClient() {
      if (!ready || !wallets) return;
      
      const userWallet = wallets.find(w => w.walletClientType === 'privy');
      if (!userWallet) return;
      
      const ethereumProvider = await userWallet.getEthereumProvider();
      const provider = createWalletClient({
        chain: monadTestnet,
        transport: custom(ethereumProvider)
      });
      
      console.log("Setting up wallet client:", provider);
      walletClient.current = provider;
    }
    
    setupWalletClient();
  }, [ready, wallets]);
  
  // Fetch balance and nonce
  const fetchBalanceAndNonce = async (walletAddress: string) => {
    if (!walletAddress) return;
    
    try {
      const [nonce, balance] = await Promise.all([
        publicClient.getTransactionCount({ address: walletAddress as Hex }),
        publicClient.getBalance({ address: walletAddress as Hex })
      ]);
      
      userNonce.current = nonce;
      userBalance.current = balance;
      setBalance(formatEther(balance));
      
      console.log(`Wallet address: ${walletAddress}`);
      console.log(`Current nonce: ${nonce}`);
      console.log(`Current balance: ${formatEther(balance)}`);
    } catch (error) {
      console.error("Failed to fetch balance and nonce:", error);
    }
  };
  
  // Handle login
  const handleLogin = () => {
    login();
  };
  
  // Send test transaction using the embedded wallet
  const handleSendTransaction = async () => {
    setIsLoading(true);
    setError("");
    
    try {
      if (!address || !user) {
        throw new Error("No embedded wallet available");
      }
      
      const provider = walletClient.current;
      if (!provider) {
        throw new Error("Wallet client not initialized");
      }
      
      // Check balance
      const currentBalance = userBalance.current;
      if (currentBalance < parseEther("0.00002")) {
        throw new Error("Insufficient balance for test transaction");
      }
      
      // Get nonce
      const nonce = userNonce.current;
      userNonce.current = nonce + 1;
      
      // Sign the transaction using the 2048 pattern
      const signedTransaction = await provider.signTransaction({
        to: address as Hex, // Sending to self
        account: address as Hex,
        value: parseEther("0.00001"),
        nonce,
        gas: BigInt(21000),
        maxFeePerGas: parseGwei("50"),
        maxPriorityFeePerGas: parseGwei("5"),
      });
      
      // Send the transaction
      const txHash = await publicClient.sendRawTransaction({
        serializedTransaction: signedTransaction
      });
      
      setTxHash(txHash);
      console.log("Transaction sent:", txHash);
      
      // Update balance after transaction
      setTimeout(() => fetchBalanceAndNonce(address), 2000);
    } catch (error: any) {
      console.error("Transaction failed:", error);
      setError(error.message || "Transaction failed");
      
      // Revert nonce increment on failure
      if (userNonce.current > 0) {
        userNonce.current -= 1;
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-8">Embedded Wallet Test</h1>
      
      {!authenticated ? (
        <button 
          onClick={handleLogin}
          className="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Login with Email or Wallet
        </button>
      ) : (
        <div className="flex flex-col items-center space-y-4 w-full max-w-md">
          <div className="text-sm bg-gray-100 p-3 rounded w-full overflow-hidden">
            <p><span className="font-bold">Address:</span> {address || "No embedded wallet"}</p>
            <p><span className="font-bold">Balance:</span> {balance} MONAD</p>
            <p><span className="font-bold">Nonce:</span> {userNonce.current}</p>
            <p><span className="font-bold">Wallet Client:</span> {walletClient.current ? "Initialized" : "Not initialized"}</p>
            <p><span className="font-bold">Wallet Linked:</span> {wallets.length > 0 ? wallets.map(w => w.walletClientType).join(', ') : 'None'}</p>
          </div>

          <div className="flex space-x-2">
            <button 
              onClick={handleSendTransaction}
              disabled={isLoading || !address || !walletClient.current}
              className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
            >
              {isLoading ? "Sending..." : "Send Test Transaction"}
            </button>
            
            <button 
              onClick={() => fetchBalanceAndNonce(address)}
              className="px-4 py-2 bg-gray-600 text-white rounded"
            >
              Refresh Balance
            </button>
          </div>

          <button 
            onClick={logout}
            className="px-4 py-2 bg-red-600 text-white rounded"
          >
            Logout
          </button>

          {txHash && (
            <div className="mt-4 p-3 bg-green-100 rounded w-full overflow-auto">
              <p className="font-bold">Transaction sent!</p>
              <p className="text-xs break-all">{txHash}</p>
              <a 
                href={`https://testnet.monadexplorer.com/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline text-sm"
              >
                View on Explorer
              </a>
            </div>
          )}
          
          {error && (
            <div className="mt-4 p-3 bg-red-100 text-red-700 rounded w-full">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
} 