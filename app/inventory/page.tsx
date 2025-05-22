"use client";

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { useInventory } from '@/lib/InventoryContext';

// Dynamically import the Inventory component to prevent SSR issues with wagmi
const Inventory = dynamic(() => import('@/components/Game/Inventory'), {
  ssr: false,
});

export default function InventoryPage() {
  const { address, isConnected } = useAccount();
  const { mainWalletAddress, inventory } = useInventory();

  // Format address for display
  const formatAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  // Use the context wallet address if available, otherwise fall back to wagmi address
  const displayAddress = mainWalletAddress || address;
  const hasInventory = inventory.length > 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold">Elementals Inventory</h1>
        
        <div className="flex items-center gap-4">
          {/* Wallet Status Display */}
          {(isConnected || mainWalletAddress) ? (
            <div className="ro-window p-0 px-3 py-2">
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <span className="text-sm font-pixel text-[var(--ro-gold)]">Connected Wallet:</span>
                  <span className="text-sm font-mono font-pixel text-white">{formatAddress(displayAddress || '')}</span>
                  {hasInventory && <span className="text-xs font-pixel text-[var(--ro-gold)]">{inventory.length} NFTs</span>}
                </div>
              </div>
            </div>
          ) : (
            <Link href="/" className="ro-button-small text-xs py-1 px-3">
              Connect Wallet
            </Link>
          )}
          
          <Link href="/marketplace" className="ro-button text-sm py-1 px-4">
            Marketplace
          </Link>
        </div>
      </div>
      
      {/* Not Connected Warning */}
      {!isConnected && !mainWalletAddress && (
        <div className="mb-6 p-3 bg-[var(--ro-panel-dark)] border border-[var(--ro-border-dark)] text-[var(--ro-gold)] text-sm rounded text-center font-pixel">
          Please connect your wallet on the home page to view your inventory
        </div>
      )}
      
      <Suspense fallback={<div>Loading...</div>}>
        <Inventory />
      </Suspense>
      
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>Powered by Magic Eden API</p>
      </div>
    </div>
  );
} 