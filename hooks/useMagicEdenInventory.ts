import { useState, useEffect, useCallback, useRef } from 'react';
import { useAccount } from 'wagmi';

// Define types for our inventory items
export interface InventoryItem {
  id: string;
  tokenId: string;
  name: string;
  image: string;
  description: string;
  rarity: string;
  collectionName: string;
  elementType?: string;
}

// Get elemental name based on token ID range
const getElementalName = (tokenId: number): string => {
  if (tokenId >= 1 && tokenId <= 3250) return "Rhoxodon";
  if (tokenId >= 3251 && tokenId <= 6499) return "Nactivyx";
  if (tokenId >= 6500 && tokenId <= 7999) return "Infermor";
  if (tokenId >= 8000 && tokenId <= 9499) return "Emberith";
  if (tokenId >= 9500 && tokenId <= 10000) return "Nyxar";
  return "Unknown Elemental"; // Fallback
};

// Get elemental type based on token ID for image mapping
const getElementalType = (tokenId: number): string => {
  // Simple deterministic mapping based on token ID
  if (tokenId >= 1 && tokenId <= 3250) return "earth"; // Rhoxodon - earth
  if (tokenId >= 3251 && tokenId <= 6499) return "water"; // Nactivyx - water
  if (tokenId >= 6500 && tokenId <= 7999) return "fire"; // Infermor - fire
  if (tokenId >= 8000 && tokenId <= 9499) return "fire"; // Emberith - fire (different variant)
  if (tokenId >= 9500 && tokenId <= 10000) return "air"; // Nyxar - air
  return "fire"; // Default fallback
};

// Get rarity based on token ID range
const getRarity = (tokenId: number): string => {
  if (tokenId >= 1 && tokenId <= 3250) return "Uncommon";   // Rhoxodon - Uncommon
  if (tokenId >= 3251 && tokenId <= 6499) return "Common";   // Nactivyx - Common
  if (tokenId >= 6500 && tokenId <= 7999) return "Epic";     // Infermor - Epic
  if (tokenId >= 8000 && tokenId <= 9499) return "Legendary"; // Emberith - Legendary
  if (tokenId >= 9500 && tokenId <= 10000) return "Ultra Rare"; // Nyxar - Ultra Rare
  return "Unknown"; // Fallback
};

// Get image URL based on elemental name
const getElementalImage = (name: string): string => {
  switch (name) {
    case 'Rhoxodon':
      return '/assets/Rhoxodon.gif';
    case 'Nactivyx':
      return '/assets/Nactivyx.gif';
    case 'Infermor':
      return '/assets/Infermor.gif';
    case 'Emberith':
      return '/assets/Emberith.gif';
    case 'Nyxar':
      return '/assets/Nyxar.gif';
    default:
      return '/assets/Emberith.gif'; // Default fallback
  }
};

// Maintain a component-level cache for addresses we've already fetched
// This prevents unnecessary API calls when components remount
const fetchedAddressesCache = new Map<string, {
  timestamp: number;
  inventory: InventoryItem[];
}>();

// Cache duration - 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;

// Function to get inventory from localStorage
const getLocalStorageInventory = (address: string): { inventory: InventoryItem[], timestamp: number } | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    const cached = localStorage.getItem(`inventory_${address}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      return {
        inventory: parsed.inventory,
        timestamp: parsed.timestamp
      };
    }
  } catch (e) {
    console.error("Error loading inventory from localStorage:", e);
  }
  return null;
};

// Function to save inventory to localStorage
const saveLocalStorageInventory = (address: string, inventory: InventoryItem[]): void => {
  if (typeof window === 'undefined') return;
  
  try {
    const data = {
      inventory,
      timestamp: Date.now()
    };
    localStorage.setItem(`inventory_${address}`, JSON.stringify(data));
    console.log(`Saved ${inventory.length} items to localStorage for ${address}`);
  } catch (e) {
    console.error("Error saving inventory to localStorage:", e);
  }
};

export default function useMagicEdenInventory(address: string | undefined) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshCounter, setRefreshCounter] = useState<number>(0);
  const [lastFetchedAddress, setLastFetchedAddress] = useState<string | undefined>(undefined);
  const isFetchingRef = useRef<boolean>(false);
  const fetchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Function to manually refresh inventory - this forces a new fetch
  const refreshInventory = useCallback(() => {
    console.log(`Manually refreshing inventory for address: ${address}`);
    if (address) {
      // Clear the cache for this address when manually refreshing
      fetchedAddressesCache.delete(address);
      // Also clear localStorage cache to force a full refresh
      try {
        localStorage.removeItem(`inventory_${address}`);
      } catch (e) {
        console.error("Error clearing localStorage cache:", e);
      }
    }
    setRefreshCounter(prev => prev + 1);
  }, [address]);

  const fetchInventory = useCallback(async (addr: string, forceRefresh = false) => {
    // Skip if no address or already fetching
    if (!addr || isFetchingRef.current) return;
    
    // Set fetching flag to prevent duplicate calls
    isFetchingRef.current = true;
    
    // Show loading state if we don't have inventory yet
    if (inventory.length === 0) {
      setIsLoading(true);
    }
    
    try {
      console.log(`Fetching tokens for wallet: ${addr}${forceRefresh ? ' (forced refresh)' : ''}`);
      
      // Call the Magic Eden tokens endpoint
      const meResponse = await fetch('/api/getMagicEdenTokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          walletAddress: addr,
          forceRefresh
        }),
      });

      if (!meResponse.ok) {
        if (meResponse.status === 429) {
          console.log("Rate limit exceeded, will use cached data if available");
          throw new Error("Rate limit exceeded");
        }
        throw new Error(`Magic Eden API error: ${meResponse.statusText} (${meResponse.status})`);
      }
      
      const meData = await meResponse.json();
      const tokenIds = meData.tokens || [];
      
      console.log(`Found ${tokenIds.length} tokens from Magic Eden Tokens API for address ${addr}`);
      console.log(`Response was cached: ${meData.cached ? 'yes' : 'no'}`);
      
      // If we have tokens, create inventory items from real tokens
      if (tokenIds.length > 0) {
        const items: InventoryItem[] = tokenIds.map((tokenId: number) => {
          const name = getElementalName(tokenId);
          const elementType = getElementalType(tokenId);
          const rarity = getRarity(tokenId);
          
          return {
            id: tokenId.toString(),
            tokenId: tokenId.toString(),
            name: name,
            image: getElementalImage(name),
            description: `A ${rarity.toLowerCase()} elemental with unique abilities.`,
            rarity: rarity,
            collectionName: 'Elementals Adventure',
            elementType: elementType
          };
        });
        
        console.log(`Created ${items.length} inventory items from tokens for address ${addr}`);
        
        // Update both caches
        const now = Date.now();
        fetchedAddressesCache.set(addr, {
          timestamp: now,
          inventory: items
        });
        
        // Save to localStorage
        saveLocalStorageInventory(addr, items);
        
        setInventory(items);
        setIsLoading(false);
        return;
      }
      
      // If no tokens found, show minimal samples for new users
      console.log(`No tokens found for address ${addr}, returning empty inventory`);
      // Cache empty result too
      fetchedAddressesCache.set(addr, {
        timestamp: Date.now(),
        inventory: []
      });
      
      // Save empty array to localStorage too
      saveLocalStorageInventory(addr, []);
      
      setInventory([]);
      setIsLoading(false);
    } catch (err) {
      console.error(`Error fetching inventory for address ${addr}:`, err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      
      // On error, we don't change the inventory state if we already have data
      if (inventory.length === 0) {
        setIsLoading(false);
      }
    } finally {
      // Make sure to reset the fetching flag
      isFetchingRef.current = false;
    }
  }, [inventory.length]);

  useEffect(() => {
    // Don't fetch if no address is provided
    if (!address) {
      console.log("No wallet address provided, clearing inventory");
      setInventory([]);
      setIsLoading(false);
      return;
    }

    // Check if we're already fetching to prevent duplicate calls
    if (isFetchingRef.current) {
      console.log(`Already fetching inventory for ${address}, skipping duplicate fetch`);
      return;
    }

    // Clear any existing fetch timer
    if (fetchTimerRef.current) {
      clearTimeout(fetchTimerRef.current);
      fetchTimerRef.current = null;
    }

    // FIRST: Check localStorage for immediate display
    const localStorageData = getLocalStorageInventory(address);
    if (localStorageData) {
      const { inventory: cachedInventory, timestamp } = localStorageData;
      const now = Date.now();
      const isExpired = now - timestamp > CACHE_DURATION;
      
      console.log(`Found localStorage inventory for ${address} with ${cachedInventory.length} items, age: ${Math.round((now - timestamp) / 1000)}s`);
      
      // Always show cached data immediately even if expired
      if (cachedInventory.length > 0) {
        console.log(`Showing cached inventory from localStorage immediately`);
        setInventory(cachedInventory);
        setIsLoading(false);
        
        // Also update memory cache
        fetchedAddressesCache.set(address, { timestamp, inventory: cachedInventory });
        
        // If cache is expired, schedule a background refresh
        if (isExpired || refreshCounter > 0) {
          console.log(`Cache is expired or refresh requested, scheduling background refresh`);
          fetchTimerRef.current = setTimeout(() => {
            fetchInventory(address, true);
          }, 100);
          return;
        }
        
        return; // Use cache and don't fetch
      }
    }

    // SECOND: Check memory cache if localStorage failed
    const now = Date.now();
    if (fetchedAddressesCache.has(address)) {
      const cachedData = fetchedAddressesCache.get(address)!;
      // If cache is still valid (less than 5 minutes old) and not forcing refresh
      if (now - cachedData.timestamp < CACHE_DURATION && refreshCounter === 0) {
        console.log(`Using cached inventory for ${address} from memory cache`);
        setInventory(cachedData.inventory);
        setIsLoading(false);
        return;
      }
    }

    // THIRD: No valid cache, need to fetch
    // Check if the address has changed
    if (lastFetchedAddress !== address) {
      console.log(`Wallet address changed from ${lastFetchedAddress || 'none'} to ${address}, refreshing inventory`);
      setLastFetchedAddress(address);
    } else if (refreshCounter > 0) {
      console.log(`Refreshing inventory for same address: ${address} (refresh #${refreshCounter})`);
    } else {
      console.log(`Initial inventory load for address: ${address}`);
    }

    // Fetch inventory (with a small delay to allow for batching)
    fetchTimerRef.current = setTimeout(() => {
      fetchInventory(address, refreshCounter > 0);
    }, 50);

    // Cleanup function
    return () => {
      if (fetchTimerRef.current) {
        clearTimeout(fetchTimerRef.current);
        fetchTimerRef.current = null;
      }
    };
  }, [address, refreshCounter, fetchInventory, lastFetchedAddress]); 

  return { inventory, isLoading, error, refreshInventory };
} 