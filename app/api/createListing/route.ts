import { NextRequest, NextResponse } from 'next/server';
import { CreateListingRequest, MarketplaceListing } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

// In a real application, this would be a database
// For this example, we'll use an in-memory store
export let listings: MarketplaceListing[] = [];

export async function POST(req: NextRequest) {
  try {
    const { order } = await req.json();

    if (!order || !order.maker || !order.contract || !order.tokenId || !order.price || !order.signature) {
      return NextResponse.json({ error: 'Missing required order parameters' }, { status: 400 });
    }

    // Call Magic Eden API to create listing
    const response = await fetch(
      'https://api-mainnet.magiceden.dev/v3/rtp/monad-testnet/order/v4',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer c2d12293-6c93-4fbf-a5d9-3055c6465ed8'
        },
        body: JSON.stringify({ 
          order,
          source: "magiceden.io"  // Add source parameter
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`Magic Eden API error: ${response.status}`, errorData);
      throw new Error(`Magic Eden API error: ${response.status}`);
    }

    const data = await response.json();
    
    return NextResponse.json({ 
      success: true, 
      data,
      message: 'Listing created successfully'
    });
  } catch (error) {
    console.error('Error creating listing:', error);
    return NextResponse.json({ 
      error: 'Failed to create listing', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ listings });
} 