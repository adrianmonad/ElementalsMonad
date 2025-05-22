// Utility functions for managing elemental inventory in localStorage

// Type definitions
export interface InventoryElemental {
  tokenId: number;
  mintedAt: number;
}

export interface UserInventory {
  elementals: InventoryElemental[];
}

export interface Inventory {
  [walletAddress: string]: UserInventory;
}

// Constants
const STORAGE_KEY = 'elementalsInventory';

/**
 * Add a newly hatched elemental to the user's inventory
 */
export function addElementalToInventory(walletAddress: string, tokenId: number): void {
  // Skip if running on server
  if (typeof window === 'undefined') return;
  
  // Get current inventory or initialize empty one
  const inventoryData = localStorage.getItem(STORAGE_KEY);
  const inventory: Inventory = inventoryData ? JSON.parse(inventoryData) : {};
  
  // Initialize user inventory if it doesn't exist
  if (!inventory[walletAddress]) {
    inventory[walletAddress] = { elementals: [] };
  }
  
  // Check if elemental already exists to avoid duplicates
  const exists = inventory[walletAddress].elementals.some(elem => elem.tokenId === tokenId);
  
  // Add new elemental if it doesn't exist
  if (!exists) {
    inventory[walletAddress].elementals.push({
      tokenId,
      mintedAt: Date.now()
    });
    
    // Save updated inventory
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inventory));
  }
}

/**
 * Get all elementals for a specific user
 */
export function getUserElementals(walletAddress: string): InventoryElemental[] {
  // Return empty array if running on server
  if (typeof window === 'undefined') return [];
  
  const inventoryData = localStorage.getItem(STORAGE_KEY);
  if (!inventoryData) return [];
  
  const inventory: Inventory = JSON.parse(inventoryData);
  return inventory[walletAddress]?.elementals || [];
}

/**
 * Sort elementals by various criteria
 */
export function sortElementals(elementals: InventoryElemental[], sortBy: 'newest' | 'oldest' | 'id' | 'rarity'): InventoryElemental[] {
  const sorted = [...elementals];
  
  switch (sortBy) {
    case 'newest':
      return sorted.sort((a, b) => b.mintedAt - a.mintedAt);
    case 'oldest':
      return sorted.sort((a, b) => a.mintedAt - b.mintedAt);
    case 'id':
      return sorted.sort((a, b) => a.tokenId - b.tokenId);
    case 'rarity':
      // Higher tokenId generally means higher rarity in your system
      return sorted.sort((a, b) => b.tokenId - a.tokenId);
    default:
      return sorted;
  }
}

/**
 * Clear user's inventory (for testing or reset)
 */
export function clearUserInventory(walletAddress: string): void {
  if (typeof window === 'undefined') return;
  
  const inventoryData = localStorage.getItem(STORAGE_KEY);
  if (!inventoryData) return;
  
  const inventory: Inventory = JSON.parse(inventoryData);
  if (inventory[walletAddress]) {
    inventory[walletAddress].elementals = [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inventory));
  }
}

/**
 * Get total count of elementals in user's inventory
 */
export function getUserElementalCount(walletAddress: string): number {
  return getUserElementals(walletAddress).length;
} 