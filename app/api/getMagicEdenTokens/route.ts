import { NextResponse } from 'next/server';

// Magic Eden API key
const MAGIC_EDEN_API_KEY = 'c2d12293-6c93-4fbf-a5d9-3055c6465ed8';

// NFT Contract address
const NFT_CONTRACT = "0x8549FaF1d5553dB17C9c6154141e5357758006cC";

// Maximum number of tokens to fetch (higher numbers will use pagination)
const MAX_TOKENS = 100;

// Simple in-memory cache to store API results
interface CacheEntry {
  tokens: number[];
  timestamp: number;
}

// Cache expires after 15 minutes (900,000 ms) instead of 5 minutes
const CACHE_EXPIRY = 15 * 60 * 1000;
const tokenCache: Record<string, CacheEntry> = {};

// Global cache to reduce API calls across different users
const GLOBAL_CACHE_KEY = 'global_tokens_cache';

// Rate limiting settings
interface RateLimitEntry {
  count: number;
  resetTime: number;
}
const rateLimits: Record<string, RateLimitEntry> = {};
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 5; // 5 requests per minute

export async function POST(request: Request) {
  try {
    // Parse the request body
    const body = await request.json();
    const { walletAddress, forceRefresh = false } = body;
    
    console.log(`API: Request to fetch Magic Eden tokens for wallet ${walletAddress}${forceRefresh ? ' (forced refresh)' : ''}`);
    
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
    
    // Create cache key from wallet address
    const cacheKey = `tokens_${walletAddress.toLowerCase()}`;
    
    // Check rate limit
    const now = Date.now();
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitKey = `${clientIp}_${walletAddress.toLowerCase()}`;
    
    // First check if we have valid data in the global cache or wallet-specific cache
    let shouldFetchFromAPI = true;
    let cachedData = null;

    // Check wallet-specific cache first as it's more accurate
    if (tokenCache[cacheKey] && !forceRefresh) {
      cachedData = tokenCache[cacheKey];
      const cacheAge = now - cachedData.timestamp;
      const isExpired = cacheAge > CACHE_EXPIRY;
      
      if (!isExpired) {
        shouldFetchFromAPI = false;
        console.log(`API: Returning cached token data for ${walletAddress} from ${new Date(cachedData.timestamp).toISOString()} (age: ${Math.round(cacheAge / 1000)}s)`);
      } else {
        console.log(`API: Cache expired for ${walletAddress}, fetching fresh data`);
      }
    }
    
    // Then check global cache as fallback if no wallet-specific cache or it's expired
    if (shouldFetchFromAPI && tokenCache[GLOBAL_CACHE_KEY] && !forceRefresh) {
      cachedData = tokenCache[GLOBAL_CACHE_KEY];
      shouldFetchFromAPI = false;
      console.log(`API: Using global cached data from ${new Date(cachedData.timestamp).toISOString()}`);
    }
    
    // If force refresh, log it but still keep cached data as fallback
    if (forceRefresh && cachedData) {
      console.log(`API: Force refresh requested, but keeping cache as fallback`);
      shouldFetchFromAPI = true;
    }
    
    // If we have valid cached data and don't need to fetch, return it immediately
    if (!shouldFetchFromAPI && cachedData) {
      return NextResponse.json({ 
        tokens: cachedData.tokens, 
        cached: true,
        timestamp: cachedData.timestamp
      });
    }
    
    // If we get here, we need to check rate limits before making API calls
    
    // Initialize or check rate limit
    if (!rateLimits[rateLimitKey]) {
      rateLimits[rateLimitKey] = {
        count: 0,
        resetTime: now + RATE_LIMIT_WINDOW
      };
    }
    
    // Clean up expired rate limits
    Object.keys(rateLimits).forEach(key => {
      if (rateLimits[key].resetTime < now) {
        delete rateLimits[key];
      }
    });
    
    // Check if rate limited
    if (rateLimits[rateLimitKey].resetTime < now) {
      // Reset rate limit if window has passed
      rateLimits[rateLimitKey] = {
        count: 1,
        resetTime: now + RATE_LIMIT_WINDOW
      };
    } else {
      // Increment count
      rateLimits[rateLimitKey].count += 1;
      
      // Check if over limit
      if (rateLimits[rateLimitKey].count > MAX_REQUESTS_PER_WINDOW) {
        console.log(`API: Rate limit exceeded for ${rateLimitKey}`);
        
        // If we have any cached data at all, return it with a warning
        if (cachedData) {
          return NextResponse.json({ 
            tokens: cachedData.tokens, 
            cached: true,
            timestamp: cachedData.timestamp,
            rateLimited: true,
            message: "Rate limit exceeded, returning cached data"
          }, { status: 200 }); // Return 200 with cached data even when rate limited
        }
        
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again later.' },
          { status: 429 }
        );
      }
    }
    
    console.log(`API: ${forceRefresh ? 'Force refreshing' : 'Cache miss'}, fetching from Magic Eden for ${walletAddress}`);
    
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
      
      try {
        const meResponse = await fetch(meTokensUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${MAGIC_EDEN_API_KEY}`,
            'accept': 'application/json'
          },
          // Add a short timeout to prevent hanging requests
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });
        
        if (!meResponse.ok) {
          const errorText = await meResponse.text();
          console.error('Magic Eden API error:', errorText);
          
          // If rate limited by Magic Eden API, return whatever we have with a warning
          if (meResponse.status === 429) {
            // If we have partial data from current fetch or any cached data, return it
            if (allTokens.length > 0 || cachedData) {
              const tokensToReturn = allTokens.length > 0 ? 
                processRawTokens(allTokens) : 
                (cachedData ? cachedData.tokens : []);
              
              // Store whatever we have in cache
              if (allTokens.length > 0) {
                tokenCache[cacheKey] = {
                  tokens: processRawTokens(allTokens),
                  timestamp: now
                };
              }
              
              return NextResponse.json({ 
                tokens: tokensToReturn,
                cached: allTokens.length === 0,
                partial: allTokens.length > 0,
                message: "Rate limited by Magic Eden API, returning partial or cached data"
              });
            }
          }
          
          throw new Error(`Failed to fetch from Magic Eden API: ${errorText}`);
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
      } catch (error) {
        // Handle fetch errors, including timeouts
        console.error(`API: Error fetching page ${offset/limit + 1}:`, error);
        
        // If we have partial data from current fetch or any cached data, return it
        if (allTokens.length > 0 || cachedData) {
          const tokensToReturn = allTokens.length > 0 ? 
            processRawTokens(allTokens) : 
            (cachedData ? cachedData.tokens : []);
          
          // Store whatever we have in cache if better than nothing
          if (allTokens.length > 0) {
            tokenCache[cacheKey] = {
              tokens: processRawTokens(allTokens),
              timestamp: now
            };
          }
          
          return NextResponse.json({ 
            tokens: tokensToReturn,
            cached: allTokens.length === 0,
            partial: allTokens.length > 0,
            error: `Error fetching from Magic Eden API: ${error instanceof Error ? error.message : String(error)}`,
            message: "Error fetching all pages, returning partial or cached data"
          });
        }
        
        // If we have no data, rethrow to be caught by the outer catch
        throw error;
      }
    }
    
    // Process tokens and store in cache
    const tokenIds = processRawTokens(allTokens);
    
    // Store result in cache (both wallet-specific and global)
    tokenCache[cacheKey] = {
      tokens: tokenIds,
      timestamp: now
    };
    
    // Update global cache if we found tokens
    if (tokenIds.length > 0) {
      tokenCache[GLOBAL_CACHE_KEY] = {
        tokens: tokenIds,
        timestamp: now
      };
    }
    
    // Clean up old cache entries
    Object.keys(tokenCache).forEach(key => {
      if ((now - tokenCache[key].timestamp) > CACHE_EXPIRY) {
        delete tokenCache[key];
      }
    });
    
    return NextResponse.json({ tokens: tokenIds, cached: false, timestamp: now });
  } catch (error) {
    console.error('API error:', error);
    
    // Generic error response
    return NextResponse.json(
      { error: 'Failed to fetch tokens', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// Helper function to process raw token data and extract IDs
function processRawTokens(allTokens: any[]): number[] {
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
  
  return tokenIds;
} 