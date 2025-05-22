import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // Get form data
    const formData = await req.formData();
    const tokenId = formData.get('tokenId') as string;
    const price = formData.get('price') as string;
    const address = formData.get('address') as string;
    
    if (!tokenId || !price || !address) {
      return NextResponse.redirect(new URL('/inventory?error=Missing+required+parameters', req.url));
    }
    
    // Store the listing information in the session or localStorage
    // This is a simplified approach - in a real app, you would call the Magic Eden API
    
    // Redirect to the marketplace page with success message
    return NextResponse.redirect(new URL(`/marketplace?success=true&tokenId=${tokenId}&price=${price}`, req.url));
    
  } catch (error) {
    console.error('Error creating listing:', error);
    return NextResponse.redirect(new URL('/inventory?error=Failed+to+create+listing', req.url));
  }
} 