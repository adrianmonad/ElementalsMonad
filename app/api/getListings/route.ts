import { NextRequest, NextResponse } from 'next/server';
import { getElementalGif, getElementalName, getElementType, getRarityTier } from '@/lib/elementals';

// Use a placeholder address that will be replaced by the connected wallet address
const PLACEHOLDER_ADDRESS = "0x0000000000000000000000000000000000000000";

// Sample data for demonstration
const sampleListings = [
  {
    id: '1',
    tokenId: '279',
    name: 'Elementals #279',
    image: '/assets/Rhoxodon.gif',
    species: 'Rhoxodon',
    rarity: 'Uncommon',
    price: '0.05',
    seller: PLACEHOLDER_ADDRESS,
    elementType: 'Earth',
    signature: '0x123456789abcdef',
    expiration: Math.floor(Date.now() / 1000) + 86400
  },
  {
    id: '2',
    tokenId: '9869',
    name: 'Elementals #9869',
    image: '/assets/Nyxar.gif',
    species: 'Nyxar',
    rarity: 'Ultra Rare',
    price: '0.5',
    seller: PLACEHOLDER_ADDRESS,
    elementType: 'Void',
    signature: '0x123456789abcdef',
    expiration: Math.floor(Date.now() / 1000) + 86400
  },
  {
    id: '3',
    tokenId: '9894',
    name: 'Elementals #9894',
    image: '/assets/Nyxar.gif',
    species: 'Nyxar',
    rarity: 'Ultra Rare',
    price: '0.4',
    seller: PLACEHOLDER_ADDRESS,
    elementType: 'Void',
    signature: '0x123456789abcdef',
    expiration: Math.floor(Date.now() / 1000) + 86400
  }
];

export async function GET(req: NextRequest) {
  try {
    // Get all query parameters (like timestamp) for caching control
    const url = new URL(req.url);
    const timestamp = url.searchParams.get('t') || Date.now().toString();
    const connectedWallet = url.searchParams.get('wallet') || PLACEHOLDER_ADDRESS;
    console.log(`Fetching listings at timestamp: ${timestamp} for wallet: ${connectedWallet}`);
    
    // Use the Reservoir API directly to get all listings
    const response = await fetch(
      'https://api-monad-testnet.reservoir.tools/orders/asks/v5?contracts=0x8549FaF1d5553dB17C9c6154141e5357758006cC',
      {
        headers: {
          'accept': 'application/json',
          // Add cache control headers to prevent caching
          'Cache-Control': 'no-cache, no-store',
          'Pragma': 'no-cache'
        },
        // Add cache: 'no-store' to fetch options
        cache: 'no-store'
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Reservoir API error: ${response.status}`, errorText);
      throw new Error(`Reservoir API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`Reservoir API found ${data.orders?.length || 0} listings`);
    
    // Log first part of raw data for debugging
    console.log('Raw data sample:', JSON.stringify(data).substring(0, 200) + '...');
    
    if (data.orders && data.orders.length > 0) {
      // Transform the data to match our listing format
      const listings = data.orders.map((order: any) => {
        // Extract the token ID from the criteria or tokenSetId
        let tokenId = '';
        if (order.criteria?.data?.token?.tokenId) {
          tokenId = order.criteria.data.token.tokenId;
        } else if (order.tokenSetId) {
          // Format is typically "token:0x123:456"
          const parts = order.tokenSetId.split(':');
          if (parts.length === 3) {
            tokenId = parts[2];
          }
        }
        
        if (!tokenId) {
          console.error('Could not find tokenId in order:', JSON.stringify(order).substring(0, 200));
          return null;
        }
        
        return {
          id: order.id || tokenId,
          tokenId: tokenId,
          name: `Elementals #${tokenId}`,
          image: getElementalGif(parseInt(tokenId)),
          species: getElementalName(parseInt(tokenId)),
          rarity: getRarityTier(parseInt(tokenId)),
          price: (order.price?.amount?.decimal || "0").toString(),
          seller: order.maker,
          elementType: getElementType(parseInt(tokenId)),
          contract: order.contract,
          source: order.source?.name || 'Magic Eden',
          // For signature and validUntil, try to extract from the data for Magic Eden compatibility
          signature: order.signature || '',
          expiration: order.validUntil || order.expiration || Math.floor(Date.now() / 1000) + 86400,
          // Add raw order data for debugging
          rawOrder: JSON.stringify(order).substring(0, 200) + '...'
        };
      }).filter(Boolean); // Remove any null entries
      
      if (listings.length > 0) {
        console.log(`Successfully mapped ${listings.length} listings`);
        
        // Sort listings by price from lowest to highest
        listings.sort((a: any, b: any) => parseFloat(a.price) - parseFloat(b.price));
        
        // Log the first few listings for debugging
        listings.slice(0, 3).forEach((listing: any, index: number) => {
          console.log(`Listing ${index + 1}: TokenID ${listing.tokenId}, Price ${listing.price}, Seller ${listing.seller.substring(0, 8)}...`);
        });
        
        return NextResponse.json({ listings });
      }
    }
    
    // No listings found or empty listings after mapping, return sample data with the connected wallet
    console.log("No valid listings found for Elementals, returning sample data");
    // Replace placeholder address with connected wallet address in sample listings
    const updatedSampleListings = sampleListings.map(listing => ({
      ...listing,
      seller: connectedWallet
    }));
    return NextResponse.json({ listings: updatedSampleListings });
  } catch (error) {
    console.error('Error fetching listings:', error);
    // Return sample data in case of error, with connected wallet address
    const connectedWallet = new URL(req.url).searchParams.get('wallet') || PLACEHOLDER_ADDRESS;
    const updatedSampleListings = sampleListings.map(listing => ({
      ...listing,
      seller: connectedWallet
    }));
    return NextResponse.json({ listings: updatedSampleListings });
  }
}

export const dynamic = 'force-dynamic'; 