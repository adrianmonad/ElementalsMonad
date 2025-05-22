'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import Link from 'next/link';
import MagicEdenMarketplace from '@/components/Game/MagicEdenMarketplace';
import { MONAD_TESTNET_ID } from '@/config';
import { WalletStatus } from "@/components/marketplace/WalletStatus";

export default function MarketplacePage() {
  const { address, isConnected, chainId } = useAccount();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-pixel text-center mb-6">MARKETPLACE</h1>
      
      {/* Wallet Status - More Prominent */}
      <div className="max-w-2xl mx-auto mb-8">
        <WalletStatus />
      </div>
      
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold">Elementals Marketplace</h1>
        
        <div className="flex items-center gap-4">
          <Link href="/inventory" className="ro-button text-sm py-1 px-4">
            My Inventory
          </Link>
        </div>
      </div>
      
      {/* Not Connected Warning */}
      {!isConnected && (
        <div className="mb-6 p-3 bg-[var(--ro-panel-dark)] border border-[var(--ro-border-dark)] text-[var(--ro-gold)] text-sm rounded text-center font-pixel">
          Please connect your wallet using the button above to interact with the marketplace
        </div>
      )}
      
      <MagicEdenMarketplace />
    </div>
  );
} 