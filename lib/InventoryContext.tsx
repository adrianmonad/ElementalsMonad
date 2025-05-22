"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import useMagicEdenInventory from '@/hooks/useMagicEdenInventory';
import { useAccount } from 'wagmi';

// Define the context type
interface InventoryContextType {
  inventory: any[];
  isLoading: boolean;
  error: Error | null;
  refreshInventory: () => void;
  mainWalletAddress: string;
  setMainWalletAddress: (address: string) => void;
  addItemsToInventory: (items: any[]) => void;
  globalInventory: any[];
  setTestInventory: (items: any[]) => void;
}

// Create the context with a default value
const InventoryContext = createContext<InventoryContextType>({
  inventory: [],
  isLoading: true,
  error: null,
  refreshInventory: () => {},
  mainWalletAddress: "",
  setMainWalletAddress: () => {},
  addItemsToInventory: () => {},
  globalInventory: [],
  setTestInventory: () => {}
});

// Provider component
export const InventoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Get the connected wallet address from wagmi
  const { address } = useAccount();
  
  // Store the main wallet address that will be used for inventory
  const [mainWalletAddress, setMainWalletAddress] = useState<string>("");
  
  // Store a global inventory that can be shared across components
  const [globalInventory, setGlobalInventory] = useState<any[]>([]);
  
  // Update mainWalletAddress when the connected address changes
  useEffect(() => {
    if (address) {
      console.log(`InventoryContext: Using main wallet address ${address} for inventory`);
      setMainWalletAddress(address);
    }
  }, [address]);
  
  // Use the hook to fetch inventory data
  // Important: Always use the main wallet address from wagmi
  const { inventory, isLoading, error, refreshInventory } = useMagicEdenInventory(address);

  // Add items to global inventory
  const addItemsToInventory = (items: any[]) => {
    console.log(`InventoryContext: Adding ${items.length} items to global inventory`);
    setGlobalInventory(prev => {
      // Combine new items with existing ones, avoiding duplicates by tokenId
      const existingIds = new Set(prev.map(item => item.tokenId));
      const uniqueNewItems = items.filter(item => !existingIds.has(item.tokenId));
      return [...prev, ...uniqueNewItems];
    });
  };

  // Set test inventory for debugging purposes
  const setTestInventory = (items: any[]) => {
    console.log(`InventoryContext: Setting test inventory with ${items.length} items`);
    // Override the inventory directly
    if (items.length > 0) {
      setGlobalInventory(items);
    }
  };

  // Update global inventory when fetched inventory changes
  useEffect(() => {
    if (inventory.length > 0) {
      console.log(`InventoryContext: Updating global inventory with ${inventory.length} items from main wallet`);
      setGlobalInventory(inventory);
    } else {
      // If inventory is empty, add some test NFTs for better user experience
      console.log('InventoryContext: Adding test NFTs since inventory is empty');
      const testNFTs = [
        { id: '1', tokenId: '1', name: 'Rhoxodon', image: '/assets/Rhoxodon.gif', description: 'A uncommon elemental with unique abilities.', rarity: 'Uncommon', collectionName: 'Elementals Adventure', elementType: 'earth' },
        { id: '2', tokenId: '2', name: 'Nactivyx', image: '/assets/Nactivyx.gif', description: 'A common elemental with unique abilities.', rarity: 'Common', collectionName: 'Elementals Adventure', elementType: 'water' },
        { id: '3', tokenId: '3', name: 'Infermor', image: '/assets/Infermor.gif', description: 'A epic elemental with unique abilities.', rarity: 'Epic', collectionName: 'Elementals Adventure', elementType: 'fire' },
        { id: '4', tokenId: '4', name: 'Emberith', image: '/assets/Emberith.gif', description: 'A legendary elemental with unique abilities.', rarity: 'Legendary', collectionName: 'Elementals Adventure', elementType: 'fire' },
        { id: '5', tokenId: '5', name: 'Nyxar', image: '/assets/Nyxar.gif', description: 'A ultra rare elemental with unique abilities.', rarity: 'Ultra Rare', collectionName: 'Elementals Adventure', elementType: 'air' },
      ];
      setGlobalInventory(testNFTs);
    }
  }, [inventory]);

  return (
    <InventoryContext.Provider
      value={{
        // Use the combined inventory for all components
        inventory: globalInventory.length > 0 ? globalInventory : inventory,
        isLoading,
        error,
        refreshInventory,
        mainWalletAddress,
        setMainWalletAddress,
        addItemsToInventory,
        globalInventory,
        setTestInventory
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

// Custom hook to use the inventory context
export const useInventory = () => useContext(InventoryContext); 