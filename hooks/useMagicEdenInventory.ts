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

export default function useMagicEdenInventory(address: string | undefined) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshCounter, setRefreshCounter] = useState<number>(0);
  const [lastFetchedAddress, setLastFetchedAddress] = useState<string | undefined>(undefined);
  const isFetchingRef = useRef<boolean>(false);

  // Function to manually refresh inventory - this forces a new fetch
  const refreshInventory = useCallback(() => {
    console.log(`Manually refreshing inventory for address: ${address}`);
    if (address) {
      // Clear the cache for this address when manually refreshing
      fetchedAddressesCache.delete(address);
    }
    setRefreshCounter(prev => prev + 1);
  }, [address]);

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

    // Check if we have a valid cache entry
    const now = Date.now();
    if (fetchedAddressesCache.has(address)) {
      const cachedData = fetchedAddressesCache.get(address)!;
      // If cache is still valid (less than 5 minutes old) and not forcing refresh
      if (now - cachedData.timestamp < CACHE_DURATION && refreshCounter === 0) {
        console.log(`Using cached inventory for ${address} from hook-level cache`);
        setInventory(cachedData.inventory);
        setIsLoading(false);
        return;
      }
    }

    // Check if the address has changed
    if (lastFetchedAddress !== address) {
      console.log(`Wallet address changed from ${lastFetchedAddress || 'none'} to ${address}, refreshing inventory`);
      setLastFetchedAddress(address);
    } else if (refreshCounter > 0) {
      console.log(`Refreshing inventory for same address: ${address} (refresh #${refreshCounter})`);
    } else {
      console.log(`Initial inventory load for address: ${address}`);
    }

    const fetchInventory = async () => {
      // Set fetching flag to prevent duplicate calls
      isFetchingRef.current = true;
      setIsLoading(true);
      
      try {
        console.log(`Fetching tokens for wallet: ${address}`);
        
        // Call the Magic Eden tokens endpoint directly
        const meResponse = await fetch('/api/getMagicEdenTokens', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            walletAddress: address,
            // Only send timestamp for force refresh
            ...(refreshCounter > 0 ? { timestamp: Date.now() } : {})
          }),
        });

        if (!meResponse.ok) {
          if (meResponse.status === 429) {
            console.log("Rate limit exceeded, will use cached data if available");
            // If rate limited and we have cache, use it
            if (fetchedAddressesCache.has(address)) {
              const cachedData = fetchedAddressesCache.get(address)!;
              setInventory(cachedData.inventory);
              setIsLoading(false);
              isFetchingRef.current = false;
              return;
            }
          }
          throw new Error(`Magic Eden API error: ${meResponse.statusText} (${meResponse.status})`);
        }
        
        const meData = await meResponse.json();
        const tokenIds = meData.tokens || [];
        
        console.log(`Found ${tokenIds.length} tokens from Magic Eden Tokens API for address ${address}`);
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
          
          console.log(`Created ${items.length} inventory items from tokens for address ${address}`);
          
          // Update the cache
          fetchedAddressesCache.set(address, {
            timestamp: now,
            inventory: items
          });
          
          setInventory(items);
          setIsLoading(false);
          isFetchingRef.current = false;
          return;
        }
        
        // If no tokens found, show minimal samples for new users
        console.log(`No tokens found for address ${address}, returning empty inventory`);
        // Cache empty result too
        fetchedAddressesCache.set(address, {
          timestamp: now,
          inventory: []
        });
        setInventory([]);
        setIsLoading(false);
      } catch (err) {
        console.error(`Error fetching inventory for address ${address}:`, err);
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setIsLoading(false);
        
        // Set empty inventory on error
        console.log("Error occurred - returning empty inventory");
        setInventory([]);
      } finally {
        // Make sure to reset the fetching flag
        isFetchingRef.current = false;
      }
    };

    fetchInventory();
  }, [address, refreshCounter]); // Depend on address changes and refresh counter

  return { inventory, isLoading, error, refreshInventory };
} 