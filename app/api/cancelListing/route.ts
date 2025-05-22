import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { order } = await req.json();

    if (!order || !order.maker || !order.contract || !order.tokenId || !order.signature) {
      return NextResponse.json({ error: 'Missing required order parameters' }, { status: 400 });
    }

    // Call Magic Eden API to cancel listing
    const response = await fetch(
      'https://api-mainnet.magiceden.dev/v3/rtp/monad-testnet/order/cancel',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer c2d12293-6c93-4fbf-a5d9-3055c6465ed8'
        },
        body: JSON.stringify({ order })
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
      message: 'Listing canceled successfully'
    });
  } catch (error) {
    console.error('Error canceling listing:', error);
    return NextResponse.json({ 
      error: 'Failed to cancel listing', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
} 