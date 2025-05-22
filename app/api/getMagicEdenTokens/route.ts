import { NextResponse } from 'next/server';

// Magic Eden API key
const MAGIC_EDEN_API_KEY = 'c2d12293-6c93-4fbf-a5d9-3055c6465ed8';

// NFT Contract address
const NFT_CONTRACT = "0x8549FaF1d5553dB17C9c6154141e5357758006cC";

// Maximum number of tokens to fetch (higher numbers will use pagination)
const MAX_TOKENS = 100;

export async function POST(request: Request) {
  try {
    // Parse the request body
    const body = await request.json();
    const { walletAddress } = body;
    
    console.log(`API: Fetching Magic Eden tokens for wallet ${walletAddress}`);
    
    // Validate inputs
    if (!walletAddress) {
      console.log('API: Missing required parameter walletAddress');
      return NextResponse.json(
        { error: 'Missing required parameter: walletAddress' },
        { status: 400 }
      );
    }
    
    // Validate address format
    if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      console.log('API: Invalid address format');
      return NextResponse.json(
        { error: 'Invalid address format' },
        { status: 400 }
      );
    }
    
    // Fetch all tokens using pagination
    let allTokens: any[] = [];
    let offset = 0;
    const limit = 20; // Magic Eden's maximum limit per request
    let hasMore = true;
    
    // Loop until we've fetched all tokens or reached our maximum
    while (hasMore && allTokens.length < MAX_TOKENS) {
      // Build the API URL with pagination parameters
      const meTokensUrl = `https://api-mainnet.magiceden.dev/v3/rtp/monad-testnet/users/${walletAddress}/tokens/v2?collection=${NFT_CONTRACT}&limit=${limit}&offset=${offset}`;
      
      console.log(`API: Calling Magic Eden Tokens API (page ${offset/limit + 1}): ${meTokensUrl}`);
      
      const meResponse = await fetch(meTokensUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${MAGIC_EDEN_API_KEY}`,
          'accept': 'application/json'
        }
      });
      
      if (!meResponse.ok) {
        const errorText = await meResponse.text();
        console.error('Magic Eden API error:', errorText);
        return NextResponse.json(
          { error: 'Failed to fetch from Magic Eden API', details: errorText },
          { status: meResponse.status }
        );
      }
      
      const meData = await meResponse.json();
      
      // Check if response contains tokens
      if (meData && Array.isArray(meData.tokens) && meData.tokens.length > 0) {
        // Add tokens from this page to our collection
        allTokens = [...allTokens, ...meData.tokens];
        
        // Update offset for next page
        offset += limit;
        
        // Check if we need to fetch more (got full page)
        hasMore = meData.tokens.length === limit;
        
        console.log(`API: Received ${meData.tokens.length} tokens on page ${offset/limit}. Total so far: ${allTokens.length}`);
      } else {
        // No more tokens to fetch
        hasMore = false;
        console.log(`API: No more tokens found at offset ${offset}`);
      }
    }
    
    // Process the response to extract token IDs
    let tokenIds: number[] = [];
    
    try {
      // Extract token IDs from all fetched tokens
      tokenIds = allTokens
        .map((item: any) => {
          if (item.token && item.token.tokenId) {
            const tokenId = item.token.tokenId;
            if (typeof tokenId === 'string') {
              return parseInt(tokenId, 10);
            } else if (typeof tokenId === 'number') {
              return tokenId;
            }
          }
          return null;
        })
        .filter((id: number | null) => id !== null);
      
      console.log(`API: Successfully extracted ${tokenIds.length} token IDs from Magic Eden response`);
      console.log('Token IDs:', tokenIds); // Log the actual token IDs
    } catch (error) {
      console.error('Error processing Magic Eden response:', error);
    }
    
    // If we couldn't extract token IDs, return the raw response for debugging
    if (tokenIds.length === 0) {
      console.log('API: No tokens found in Magic Eden response, logging raw data for debugging');
      console.log(JSON.stringify({ sample: allTokens.slice(0, 2) }).substring(0, 500) + '...');
      
      return NextResponse.json({
        tokens: [],
        rawResponse: { sample: allTokens.slice(0, 2) },
        message: 'Could not extract token IDs from Magic Eden response. Check rawResponse for details.'
      });
    }
    
    return NextResponse.json({ tokens: tokenIds });
  } catch (error) {
    console.error('API error:', error);
    
    // Generic error response
    return NextResponse.json(
      { error: 'Failed to fetch tokens', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 