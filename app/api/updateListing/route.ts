import { NextResponse } from 'next/server';
import { UpdateListingRequest, MarketplaceListing } from '@/lib/types';

// In a real application, this would access a database
// For this example, we'll import from the createListing endpoint
// This is not ideal for production, but works for our demo
import { listings } from '../createListing/route';

export async function POST(request: Request) {
  try {
    const body = await request.json() as UpdateListingRequest;
    
    // Validate request
    if (!body.id || !body.status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Find the listing
    const listingIndex = listings.findIndex((listing: MarketplaceListing) => listing.id === body.id);
    
    if (listingIndex === -1) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }
    
    // Update the listing
    listings[listingIndex] = {
      ...listings[listingIndex],
      status: body.status,
      updatedAt: Date.now(),
      ...(body.buyerAddress && { buyerAddress: body.buyerAddress }),
      ...(body.transactionHash && { transactionHash: body.transactionHash })
    };
    
    console.log(`Updated listing ${body.id} status to ${body.status}`);
    
    return NextResponse.json({ 
      success: true, 
      listing: listings[listingIndex]
    });
  } catch (error) {
    console.error('Error updating listing:', error);
    return NextResponse.json({ error: 'Failed to update listing' }, { status: 500 });
  }
} 