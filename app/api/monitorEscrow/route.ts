import { NextRequest, NextResponse } from 'next/server';
import { listings } from '../createListing/route';
import { MarketplaceListing } from '@/lib/types';
import { NFT_CONTRACT_ADDRESS, ESCROW_WALLET_ADDRESS } from '@/config';
import { createPublicClient, http } from 'viem';
import { monadTestnet } from 'viem/chains';

// ERC721 minimal ABI for ownership checks
const ERC721_ABI = [
  {
    "inputs": [{"internalType": "address", "name": "owner", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "tokenId", "type": "uint256"}],
    "name": "ownerOf",
    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  }
];

// Create a public client for Monad Testnet
const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http('https://rpc.testnet.monad.xyz/json-rpc')
});

export async function GET() {
  try {
    // Fetch NFTs in the escrow wallet using Magic Eden API
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/getMagicEdenTokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ wallet: ESCROW_WALLET_ADDRESS }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch escrow tokens: ${response.statusText}`);
    }

    const data = await response.json();
    const escrowTokens = data.tokens || [];
    
    console.log(`Found ${escrowTokens.length} tokens in escrow wallet`);
    
    // Update pending listings to active if they're in the escrow wallet
    let updatedListings = 0;
    
    for (const token of escrowTokens) {
      // Find matching pending listing
      const pendingListing = listings.find((listing: MarketplaceListing) => 
        listing.nftContract.toLowerCase() === NFT_CONTRACT_ADDRESS.toLowerCase() &&
        listing.tokenId === token.tokenId &&
        listing.status === 'pending'
      );
      
      if (pendingListing) {
        // Update to active
        pendingListing.status = 'active';
        pendingListing.updatedAt = Date.now();
        updatedListings++;
        
        console.log(`Activated listing for token ${token.tokenId}`);
      }
    }
    
    return NextResponse.json({ 
      success: true,
      escrowTokenCount: escrowTokens.length,
      updatedListings
    });
  } catch (error) {
    console.error('Error monitoring escrow wallet:', error);
    return NextResponse.json({ error: 'Failed to monitor escrow wallet' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { txHash, tokenId, contract, buyer } = await req.json();

    // Validate required parameters
    if (!txHash && !tokenId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Either txHash or tokenId+contract+buyer must be provided' 
      }, { status: 400 });
    }

    let result: any = {
      success: true,
      txStatus: null,
      ownershipStatus: null
    };

    // If transaction hash is provided, check transaction status
    if (txHash) {
      try {
        console.log(`Checking transaction status for: ${txHash}`);
        const txReceipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
        
        result.txStatus = {
          status: txReceipt.status,
          blockNumber: txReceipt.blockNumber,
          gasUsed: txReceipt.gasUsed.toString(),
          effectiveGasPrice: txReceipt.effectiveGasPrice.toString(),
          totalGasCost: (txReceipt.gasUsed * txReceipt.effectiveGasPrice).toString(),
          confirmations: 1, // Simplified for now
          logs: txReceipt.logs.length
        };
        
        // Check for common error patterns in the logs
        const hasError = txReceipt.logs.some(log => 
          log.topics.some(topic => topic.includes('error') || topic.includes('fail'))
        );
        
        if (hasError) {
          result.txStatus.warning = "Transaction logs contain potential error indicators";
        }
        
        console.log(`Transaction status: ${txReceipt.status ? 'SUCCESS' : 'FAILED'}`);
      } catch (error) {
        console.error('Error fetching transaction receipt:', error);
        
        // Check if the transaction is pending
        try {
          const tx = await publicClient.getTransaction({ hash: txHash as `0x${string}` });
          if (tx) {
            result.txStatus = {
              status: 'pending',
              blockNumber: null,
              gasUsed: null,
              value: tx.value.toString()
            };
            console.log('Transaction is pending');
          } else {
            result.txStatus = {
              status: 'not_found',
              error: 'Transaction not found'
            };
            console.log('Transaction not found');
          }
        } catch (e) {
          result.txStatus = {
            status: 'error',
            error: e instanceof Error ? e.message : String(e)
          };
        }
      }
    }

    // If token details are provided, check ownership
    if (tokenId && contract && buyer) {
      try {
        console.log(`Checking ownership of token ${tokenId} at contract ${contract}`);
        
        // Check if the buyer owns the token
        const owner = await publicClient.readContract({
          address: contract as `0x${string}`,
          abi: ERC721_ABI,
          functionName: 'ownerOf',
          args: [BigInt(tokenId)]
        });
        
        const ownerAddress = owner as `0x${string}`;
        const buyerOwnsToken = ownerAddress.toLowerCase() === buyer.toLowerCase();
        
        result.ownershipStatus = {
          currentOwner: ownerAddress,
          buyerIsOwner: buyerOwnsToken,
          tokenId
        };
        
        console.log(`Token ${tokenId} owner: ${ownerAddress}`);
        console.log(`Buyer ${buyer} owns token: ${buyerOwnsToken}`);
      } catch (error) {
        console.error('Error checking token ownership:', error);
        result.ownershipStatus = {
          error: error instanceof Error ? error.message : String(error),
          details: 'Could not determine token ownership. The token may not exist or the contract address may be incorrect.'
        };
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in monitor endpoint:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to monitor transaction/token', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
} 