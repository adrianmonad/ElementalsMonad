'use client';

import { useState, useEffect } from 'react';
import { useAccount, useSwitchChain, useSignTypedData } from 'wagmi';
import { useRouter, useSearchParams } from 'next/navigation';
import { MONAD_TESTNET_ID } from '@/config';

export default function CreateListing() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenId = searchParams.get('tokenId');
  const price = searchParams.get('price');
  
  const { address, isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const { signTypedDataAsync } = useSignTypedData();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  useEffect(() => {
    if (tokenId && price && address) {
      createListing();
    }
  }, [tokenId, price, address]);
  
  const createListing = async () => {
    if (!tokenId || !price || !address) {
      setError('Missing required parameters');
      return;
    }
    
    if (chainId !== MONAD_TESTNET_ID) {
      handleSwitchNetwork();
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // Create the order object for signing
      const domain = {
        name: "MagicEden",
        version: "1",
        chainId: 10143,
        verifyingContract: "0x8549FaF1d5553dB17C9c6154141e5357758006cC" as `0x${string}`,
      };

      const types = {
        Order: [
          { name: "maker", type: "address" },
          { name: "contract", type: "address" },
          { name: "tokenId", type: "uint256" },
          { name: "price", type: "uint256" },
          { name: "expiration", type: "uint256" },
        ],
      };

      // Convert price from ETH to wei (multiply by 10^18)
      const priceInWei = BigInt(parseFloat(price) * 10**18);
      
      const order = {
        maker: address,
        contract: domain.verifyingContract,
        tokenId: BigInt(tokenId),
        price: priceInWei,
        expiration: Math.floor(Date.now() / 1000) + 86400, // 1 day
      };

      // Sign the order
      const signature = await signTypedDataAsync({
        domain,
        types,
        primaryType: 'Order',
        message: order,
      });

      // Format the order for the API
      const formattedOrder = {
        maker: address,
        contract: domain.verifyingContract,
        tokenId: tokenId,
        price: priceInWei.toString(),
        expiration: order.expiration,
        signature
      };

      // Send the signed order to the API
      const response = await fetch('/api/createListing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order: formattedOrder
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/marketplace');
        }, 2000);
      } else {
        setError(data.error || 'Failed to create listing');
      }
    } catch (err) {
      console.error('Error creating listing:', err);
      setError(err instanceof Error ? err.message : 'Failed to create listing');
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Handle network switching
  const handleSwitchNetwork = async () => {
    if (switchChain) {
      try {
        await switchChain({ chainId: MONAD_TESTNET_ID });
      } catch (err) {
        console.error('Failed to switch network:', err);
        setError('Failed to switch network');
      }
    } else {
      setError('Network switching not available');
    }
  };
  
  return (
    <div className="p-4 h-full flex flex-col items-center justify-center">
      <div className="ro-window max-w-md w-full">
        <div className="ro-window-header p-2 text-center">
          <h1 className="font-pixel text-white text-lg">Create Listing</h1>
        </div>
        
        <div className="p-4">
          {isProcessing && (
            <div className="mb-4 p-2 bg-blue-900 border border-blue-600 text-blue-200 text-xs font-pixel text-center">
              Creating your listing... Please wait and approve the signature request.
            </div>
          )}
          
          {error && (
            <div className="mb-4 p-2 bg-red-900 border border-red-600 text-red-200 text-xs font-pixel text-center">
              {error}
              <button
                onClick={() => router.push('/inventory')}
                className="ro-button mt-2 w-full py-1 px-3 text-xs"
              >
                Back to Inventory
              </button>
            </div>
          )}
          
          {success && (
            <div className="mb-4 p-2 bg-green-900 border border-green-600 text-green-200 text-xs font-pixel text-center">
              Listing created successfully! Redirecting to marketplace...
            </div>
          )}
          
          {!isProcessing && !error && !success && (
            <div className="flex flex-col items-center space-y-4">
              <p className="text-white font-pixel text-sm">
                Creating listing for Token #{tokenId} at {price} MONAD
              </p>
              <div className="animate-pulse">
                <p className="text-white font-pixel text-xs">
                  Please approve the signature request in your wallet...
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 