import { useState, useEffect } from "react";
import { useAccount, useSwitchChain, useSignTypedData } from "wagmi";
import { InventoryItem } from "@/hooks/useMagicEdenInventory";
import { useInventory } from "@/lib/InventoryContext";
import { MONAD_TESTNET_ID } from "@/config";

interface GroupedItem extends InventoryItem {
  count: number;
  items: InventoryItem[];
}

export default function Inventory() {
  const { address, isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const { signTypedDataAsync } = useSignTypedData();
  const { inventory, isLoading, refreshInventory } = useInventory();
  const [selectedItem, setSelectedItem] = useState<GroupedItem | null>(null);
  const [selectedTab, setSelectedTab] = useState<'all' | 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'ultra'>('all');
  const [isListingInProgress, setIsListingInProgress] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Add a force refresh function
  const handleForceRefresh = () => {
    console.log("Manually refreshing inventory...");
    setIsRefreshing(true);
    refreshInventory(); // Use the function from the context
    
    // Set a timeout to reset the refreshing state after 2 seconds
    // This ensures the user sees the refresh animation
    setTimeout(() => {
      setIsRefreshing(false);
    }, 2000);
  };

  // Group items by name to count duplicates
  const groupedItems = inventory.reduce<Record<string, GroupedItem>>((acc, item) => {
    const key = item.name;
    if (!acc[key]) {
      acc[key] = {
        ...item,
        count: 1,
        items: [item]
      };
    } else {
      acc[key].count += 1;
      acc[key].items.push(item);
    }
    return acc;
  }, {});

  // Filter items based on selected tab
  const filteredItems = Object.values(groupedItems).filter(item => {
    if (selectedTab === 'all') return true;
    if (selectedTab === 'ultra') return item.rarity.toLowerCase().includes('ultra');
    
    // Exact match for rarity to prevent partial matches
    const itemRarity = item.rarity.toLowerCase();
    const selectedRarity = selectedTab.toLowerCase();
    
    // Special case for common to exclude uncommon
    if (selectedRarity === 'common') {
      return itemRarity === 'common';
    }
    
    return itemRarity === selectedRarity;
  });

  const handleItemClick = (item: GroupedItem) => {
    setSelectedItem(item);
  };

  const closeModal = () => {
    setSelectedItem(null);
  };
  
  // Handle switch network
  const handleSwitchNetwork = async () => {
    if (switchChain) {
      try {
        console.log('Attempting to switch to Monad Testnet...');
        // Use the value from config.ts
        await switchChain({ chainId: MONAD_TESTNET_ID });
        console.log('Switch network request sent');
      } catch (err) {
        console.error('Failed to switch network:', err);
      }
    } else {
      console.error('switchChain function not available');
    }
  };

  // Get rarity color class based on rarity
  const getRarityColorClass = (rarity: string): string => {
    const lowerRarity = rarity.toLowerCase();
    if (lowerRarity.includes('common') && !lowerRarity.includes('un')) return 'ro-rarity-common';
    if (lowerRarity.includes('uncommon')) return 'ro-rarity-uncommon';
    if (lowerRarity.includes('rare')) return 'ro-rarity-rare';
    if (lowerRarity.includes('epic')) return 'ro-rarity-epic';
    if (lowerRarity.includes('legendary')) return 'ro-rarity-legendary';
    if (lowerRarity.includes('ultra')) return 'ro-rarity-ultra';
    return 'text-white';
  };

  // Handle listing an NFT for sale
  const handleListForSale = async (tokenId: string) => {
    console.log("handleListForSale called with tokenId:", tokenId);
    if (!address) {
      console.log("No address found, returning");
      return;
    }
    
    try {
      setIsListingInProgress(true);
      const price = prompt("Enter price in MONAD:");
      console.log("Price entered:", price);
      
      if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
        console.log("Invalid price, returning");
        setIsListingInProgress(false);
        return;
      }
      
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
      console.log("Price in wei:", priceInWei.toString());
      
      const order = {
        maker: address,
        contract: domain.verifyingContract,
        tokenId: BigInt(tokenId),
        price: priceInWei,
        expiration: Math.floor(Date.now() / 1000) + 86400, // 1 day
      };
      console.log("Order object:", JSON.stringify(order, (_, v) => typeof v === 'bigint' ? v.toString() : v));

      // Sign the order
      console.log("About to sign the order...");
      const signature = await signTypedDataAsync({
        domain,
        types,
        primaryType: 'Order',
        message: order,
      });
      console.log("Order signed, signature:", signature);

      // Format the order for the API
      const formattedOrder = {
        maker: address,
        contract: domain.verifyingContract,
        tokenId: tokenId,
        price: priceInWei.toString(),
        expiration: order.expiration,
        signature
      };
      console.log("Formatted order:", formattedOrder);

      // Send the signed order to the API
      console.log("Sending request to API...");
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
      console.log("API response:", data);
      
      if (data.success) {
        alert('Listing created successfully!');
        closeModal();
      } else {
        alert(`Failed to create listing: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating listing:', error);
      alert(`Error creating listing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsListingInProgress(false);
    }
  };

  return (
    <div className="p-0 h-full flex flex-col">
      {/* Network Warning */}
      {isConnected && chainId !== MONAD_TESTNET_ID && (
        <div className="mb-4 p-2 bg-yellow-800 border border-yellow-600 text-yellow-200 text-xs font-pixel text-center">
          Please switch to Monad Testnet to view your inventory
          <button
            onClick={handleSwitchNetwork}
            className="block mx-auto mt-2 ro-button text-xs py-1 px-3"
          >
            Switch Network
          </button>
        </div>
      )}
      
      {/* Refresh Button */}
      <div className="flex justify-between mb-4">
        <div className="text-xs font-pixel text-[var(--ro-gold)]">
          {isRefreshing ? "Refreshing inventory..." : inventory.length > 0 ? `You have ${inventory.length} elementals` : ""}
        </div>
        <button
          onClick={handleForceRefresh}
          className="ro-button-small text-xs py-1 px-3 flex items-center"
          disabled={isRefreshing || isLoading}
        >
          {isRefreshing ? (
            <>
              <span className="animate-spin mr-1">⟳</span> Refreshing...
            </>
          ) : (
            <>↻ Refresh Inventory</>
          )}
        </button>
      </div>
      
      {/* Loading Notice */}
      <div className="mb-4 text-xs text-yellow-400 bg-gray-800 p-2 rounded text-center">
        Inventory may load slowly. Keep clicking refresh if it doesn't show up yet.
      </div>
      
      {/* Inventory Tabs - Scrollable */}
      <div className="flex border-b-2 border-[var(--ro-border-dark)] mb-4 overflow-x-auto pb-1">
        <button 
          onClick={() => setSelectedTab('all')}
          className={`px-3 py-1 font-pixel text-xs whitespace-nowrap ${selectedTab === 'all' ? 'bg-[var(--ro-panel-light)] text-white' : 'text-gray-300'}`}
        >
          ALL
        </button>
        <button 
          onClick={() => setSelectedTab('common')}
          className={`px-3 py-1 font-pixel text-xs whitespace-nowrap ${selectedTab === 'common' ? 'bg-[var(--ro-panel-light)] text-white' : 'ro-rarity-common'}`}
        >
          COMMON
        </button>
        <button 
          onClick={() => setSelectedTab('uncommon')}
          className={`px-3 py-1 font-pixel text-xs whitespace-nowrap ${selectedTab === 'uncommon' ? 'bg-[var(--ro-panel-light)] text-white' : 'ro-rarity-uncommon'}`}
        >
          UNCOMMON
        </button>
        <button 
          onClick={() => setSelectedTab('rare')}
          className={`px-3 py-1 font-pixel text-xs whitespace-nowrap ${selectedTab === 'rare' ? 'bg-[var(--ro-panel-light)] text-white' : 'ro-rarity-rare'}`}
        >
          RARE
        </button>
        <button 
          onClick={() => setSelectedTab('epic')}
          className={`px-3 py-1 font-pixel text-xs whitespace-nowrap ${selectedTab === 'epic' ? 'bg-[var(--ro-panel-light)] text-white' : 'ro-rarity-epic'}`}
        >
          EPIC
        </button>
        <button 
          onClick={() => setSelectedTab('legendary')}
          className={`px-3 py-1 font-pixel text-xs whitespace-nowrap ${selectedTab === 'legendary' ? 'bg-[var(--ro-panel-light)] text-white' : 'ro-rarity-legendary'}`}
        >
          LEGEND
        </button>
        <button 
          onClick={() => setSelectedTab('ultra')}
          className={`px-3 py-1 font-pixel text-xs whitespace-nowrap ${selectedTab === 'ultra' ? 'bg-[var(--ro-panel-light)] text-white' : 'ro-rarity-ultra'}`}
        >
          ULTRA
        </button>
      </div>
      
      {/* Inventory Content */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-white font-pixel text-base animate-pulse">Loading your elementals...</div>
        </div>
      ) : inventory.length === 0 ? (
        <div className="flex flex-col justify-center items-center h-64 space-y-4">
          <p className="text-white font-pixel text-base">No elementals found</p>
          <p className="text-[var(--ro-gold)] font-pixel text-xs">Begin your adventure to collect elementals!</p>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto flex-grow overflow-y-auto">
          {/* Inventory Grid - Optimized for mobile */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {filteredItems.map((group, index) => (
              <div 
                key={index} 
                className="ro-item-slot cursor-pointer hover:border-[var(--ro-gold)] hover:shadow-[0_0_8px_rgba(255,204,51,0.5)] transition-all h-64"
                onClick={() => handleItemClick(group)}
              >
                {/* Item Image */}
                <div className="w-full h-full flex flex-col items-center justify-center relative">
                  {/* Rarity Badge */}
                  <div className="absolute top-1 right-1 z-10">
                    <span className={`px-2 py-0.5 text-[10px] font-pixel rounded-sm ${getRarityColorClass(group.rarity)}`}>
                      {group.rarity}
                    </span>
                  </div>
                  
                  {/* Item Image */}
                  <div className="w-full h-2/3 flex items-center justify-center p-2">
                    {group.image ? (
                      <img 
                        src={group.image} 
                        alt={group.name} 
                        className="w-full h-full object-contain pixelated"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-[var(--ro-bg-dark)] flex items-center justify-center text-white">?</div>
                    )}
                  </div>
                  
                  {/* Item Info */}
                  <div className="w-full text-center p-1 bg-[var(--ro-bg-dark)] border-t border-[var(--ro-border-dark)]">
                    <p className="font-pixel text-sm truncate text-white">
                      {group.name} #{group.tokenId}
                    </p>
                    {group.count > 1 && (
                      <p className="font-pixel text-[var(--ro-gold)] text-sm">
                        x{group.count} tokens
                      </p>
                    )}
                  </div>
                  
                  {/* Action Button */}
                  <div className="w-full mt-2 px-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleItemClick(group);
                      }}
                      className="ro-button w-full py-1 text-center text-xs"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {filteredItems.length === 0 && (
            <div className="flex justify-center items-center h-32">
              <p className="text-gray-400 font-pixel text-xs">No elementals found with this rarity</p>
            </div>
          )}
          
          {/* Help Text */}
          <div className="mt-4 text-center border-t border-[var(--ro-border-dark)] pt-2">
            <p className="text-gray-400 font-pixel text-xs">Click on an elemental to view details</p>
          </div>
        </div>
      )}
      
      {/* Item Detail Modal - Mobile Optimized */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-[100] overflow-y-auto py-8" onClick={closeModal}>
          <div className="min-h-screen flex items-center justify-center">
            <div className="ro-window w-full max-w-md mx-auto mb-16" onClick={(e) => e.stopPropagation()}>
              {/* Modal Header */}
              <div className="ro-window-header flex justify-between items-center sticky top-0 bg-[var(--ro-bg-dark)] z-10 border-b-2 border-[var(--ro-border-dark)] p-2">
                <h3 className={`font-pixel text-base ${getRarityColorClass(selectedItem.rarity)}`}>
                  {selectedItem.name}
                </h3>
                <button 
                  onClick={closeModal}
                  className="text-white font-pixel hover:text-[var(--ro-gold)] text-lg"
                >
                  X
                </button>
              </div>
              
              {/* Modal Content - Simplified for mobile */}
              <div className="p-3">
                {/* Elemental Image */}
                <div className="flex justify-center mb-3">
                  <div className="ro-item-slot w-48 h-48">
                    {selectedItem.image ? (
                      <img 
                        src={selectedItem.image} 
                        alt={selectedItem.name}
                        className="w-full h-full object-contain pixelated"
                      />
                    ) : (
                      <div className="w-full h-full bg-[var(--ro-bg-dark)] flex items-center justify-center text-white">?</div>
                    )}
                  </div>
                </div>
                
                {/* Rarity Badge */}
                <div className={`w-full text-center py-1 mb-3 border border-[var(--ro-border-light)] ${getRarityColorClass(selectedItem.rarity)}`}>
                  {selectedItem.rarity}
                </div>
                
                {/* Stats Table */}
                <div className="border border-[var(--ro-border-light)] mb-3">
                  <table className="w-full text-xs">
                    <tbody>
                      <tr className="border-b border-[var(--ro-border-dark)]">
                        <td className="p-2 text-[var(--ro-gold)] border-r border-[var(--ro-border-dark)] bg-[var(--ro-bg-dark)] w-1/3">Name</td>
                        <td className="p-2">{selectedItem.name}</td>
                      </tr>
                      <tr className="border-b border-[var(--ro-border-dark)]">
                        <td className="p-2 text-[var(--ro-gold)] border-r border-[var(--ro-border-dark)] bg-[var(--ro-bg-dark)]">Element</td>
                        <td className="p-2 capitalize">{selectedItem.elementType}</td>
                      </tr>
                      <tr className="border-b border-[var(--ro-border-dark)]">
                        <td className="p-2 text-[var(--ro-gold)] border-r border-[var(--ro-border-dark)] bg-[var(--ro-bg-dark)]">Rarity</td>
                        <td className={`p-2 ${getRarityColorClass(selectedItem.rarity)}`}>{selectedItem.rarity}</td>
                      </tr>
                      <tr className="border-b border-[var(--ro-border-dark)]">
                        <td className="p-2 text-[var(--ro-gold)] border-r border-[var(--ro-border-dark)] bg-[var(--ro-bg-dark)]">Quantity</td>
                        <td className="p-2">{selectedItem.count}</td>
                      </tr>
                      <tr>
                        <td className="p-2 text-[var(--ro-gold)] border-r border-[var(--ro-border-dark)] bg-[var(--ro-bg-dark)]">Token ID</td>
                        <td className="p-2">#{selectedItem.tokenId}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                
                {/* Description */}
                {selectedItem.description && (
                  <div className="border border-[var(--ro-border-light)] p-2 mb-3">
                    <h4 className="text-[var(--ro-gold)] font-pixel text-xs mb-1">Description</h4>
                    <p className="text-xs">{selectedItem.description}</p>
                  </div>
                )}
                
                {/* Individual Items Section - Always show for reference */}
                {selectedItem.count > 1 && (
                  <div className="border border-[var(--ro-border-light)] mb-3">
                    <div className="bg-[var(--ro-bg-dark)] border-b border-[var(--ro-border-dark)] p-2">
                      <h4 className="text-[var(--ro-gold)] font-pixel text-xs">Individual Tokens</h4>
                    </div>
                    <div className="max-h-24 overflow-y-auto p-2">
                      <div className="grid grid-cols-3 gap-1">
                        {selectedItem.items.map((item, i) => (
                          <div key={i} className="text-white font-pixel text-xs p-1 border border-[var(--ro-border-dark)] bg-[var(--ro-bg-dark)]">
                            #{item.tokenId}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* List for Sale Button - DIRECT LINK TO MAGIC EDEN */}
                <a 
                  href={`https://magiceden.io/item-details/monad-testnet/0x8549FaF1d5553dB17C9c6154141e5357758006cC/${selectedItem.tokenId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ro-button w-full py-2 text-center text-sm mb-3 block"
                >
                  View on Magic Eden
                </a>
                
                {/* Link to Marketplace */}
                <a 
                  href="/marketplace"
                  className="ro-button-small w-full py-2 text-center text-sm mb-3 block"
                >
                  Go to Marketplace
                </a>
                
                {/* Back Button */}
                <button 
                  onClick={closeModal}
                  className="ro-button w-full py-2 text-center text-sm"
                >
                  BACK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 