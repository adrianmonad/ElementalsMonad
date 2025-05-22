import { NextRequest, NextResponse } from 'next/server';

// Simple ABI for a raw transaction call
const RAW_CALL_ABI = [
  {
    "inputs": [],
    "name": "execute",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  }
];

export async function POST(req: NextRequest) {
  try {
    const { order, taker } = await req.json();

    if (!order || !taker) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    console.log('=== PURCHASE API REQUEST ===');
    console.log('Processing buy request for token:', order.tokenId);
    console.log('Buyer wallet address:', taker);
    console.log('Order details:', JSON.stringify(order, null, 2));

    // Validate input parameters
    if (!order.contract || !order.tokenId || !order.price || !order.maker || !order.id) {
      return NextResponse.json({ error: 'Invalid order format. Missing required fields' }, { status: 400 });
    }

    // Validate wallet address format
    if (!taker.startsWith('0x') || taker.length !== 42) {
      return NextResponse.json({ 
        error: `Invalid wallet address format: ${taker}. Expected 0x prefixed 42 character hex string.` 
      }, { status: 400 });
    }

    // Format the request body according to Magic Eden's API requirements
    // Using only orderId as indicated by the error message about exclusive peers
    const requestBody = {
      taker,
      items: [
        {
          orderId: order.id,
          quantity: 1
        }
      ]
    };

    console.log('Request body:', JSON.stringify(requestBody, null, 2));

    // Call Magic Eden API to buy NFT
    let response;
    try {
      console.log('Calling Magic Eden API...');
      const startTime = Date.now();
      
      response = await fetch(
        'https://api-mainnet.magiceden.dev/v3/rtp/monad-testnet/execute/buy/v7',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer c2d12293-6c93-4fbf-a5d9-3055c6465ed8',
            'Cache-Control': 'no-cache, no-store',
            'Pragma': 'no-cache'
          },
          body: JSON.stringify(requestBody)
        }
      );
      
      const responseTime = Date.now() - startTime;
      console.log(`Magic Eden API response time: ${responseTime}ms`);
    } catch (fetchError) {
      console.error('Fetch error calling Magic Eden API:', fetchError);
      return NextResponse.json({ 
        success: false, 
        error: `Network error calling Magic Eden API: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}` 
      }, { status: 500 });
    }

    // Handle non-OK responses
    if (!response.ok) {
      const errorData = await response.text();
      console.error(`Magic Eden API error: ${response.status}`, errorData);
      
      // Return a more helpful error message
      let errorMessage = `Magic Eden API error: ${response.status}`;
      try {
        // Try to parse error response as JSON
        const errorJson = JSON.parse(errorData);
        if (errorJson.error) {
          errorMessage = errorJson.error;
        }
        if (errorJson.message) {
          errorMessage += `: ${errorJson.message}`;
        }
        
        console.error('Parsed Magic Eden error:', errorJson);
        
        // Check for specific error types
        if (errorJson.code === 'LISTING_NOT_FOUND') {
          return NextResponse.json({ 
            success: false, 
            error: 'This NFT listing no longer exists. It may have been purchased or cancelled.',
            code: 'LISTING_NOT_FOUND'
          }, { status: 404 });
        }
        
        if (errorJson.code === 'INSUFFICIENT_FUNDS') {
          return NextResponse.json({ 
            success: false, 
            error: 'Insufficient funds to complete this purchase.',
            code: 'INSUFFICIENT_FUNDS'
          }, { status: 400 });
        }
      } catch (e) {
        // If it's not valid JSON, use the raw text
        errorMessage += `: ${errorData}`;
      }
      
      return NextResponse.json({ 
        success: false, 
        error: errorMessage
      }, { status: response.status });
    }

    const data = await response.json();
    console.log('Purchase response:', data);
    
    // Extract transaction data from the Magic Eden response
    // The response contains steps with transaction data that needs to be executed
    type Step = {
      kind: string;
      items: Array<{
        data: any;
      }>;
    };
    
    const transactionData = data.steps?.find((step: Step) => step.kind === 'transaction')?.items[0]?.data;
    
    if (!transactionData) {
      console.error('No transaction data found in Magic Eden response:', data);
      throw new Error('Transaction data not found in the response');
    }
    
    // Log the original transaction data for debugging
    console.log('Original transaction data from Magic Eden:', {
      from: transactionData.from,
      to: transactionData.to,
      value: transactionData.value,
      dataLength: transactionData.data?.length
    });
    
    // Check if the listing exists in the response path
    if (!data.path || data.path.length === 0) {
      console.error('No path found in Magic Eden response:', data);
      return NextResponse.json({
        success: false,
        error: 'No listing path found in Magic Eden response. The listing may have been cancelled or already purchased.'
      }, { status: 400 });
    }
    
    // IMPORTANT: Update 'from' address in transaction data to match the user's address
    // This prevents the "from address mismatch" error
    if (transactionData.from) {
      if (transactionData.from.toLowerCase() !== taker.toLowerCase()) {
        console.log(`=== ADDRESS MISMATCH DETECTED ===`);
        console.log(`Magic Eden provided address: ${transactionData.from}`);
        console.log(`User's wallet address: ${taker}`);
        console.log(`Updating 'from' address from ${transactionData.from} to ${taker}`);
        transactionData.from = taker;
      } else {
        console.log('Transaction already has correct "from" address:', taker);
      }
    } else {
      console.log('Adding missing "from" address:', taker);
      transactionData.from = taker;
    }
    
    // Force check for other transaction properties
    if (!transactionData.to) {
      console.error('Transaction is missing "to" address!');
      return NextResponse.json({
        success: false,
        error: 'Invalid transaction data: missing destination address'
      }, { status: 400 });
    }
    
    if (!transactionData.value) {
      console.warn('Transaction is missing "value" field!');
    }
    
    if (!transactionData.data) {
      console.error('Transaction is missing "data" field!');
      return NextResponse.json({
        success: false,
        error: 'Invalid transaction data: missing transaction data'
      }, { status: 400 });
    }
    
    // Verify the transaction value against the expected price
    const txValueInEther = BigInt(transactionData.value || '0') / BigInt(10**18);
    const expectedPrice = parseFloat(order.price);
    
    // Allow for a small difference (up to 5% more) to account for fees
    if (txValueInEther > BigInt(Math.floor(expectedPrice * 1.05 * 10**18)) / BigInt(10**18)) {
      console.warn(`Transaction value (${txValueInEther} MONAD) is significantly higher than expected price (${expectedPrice} MONAD)`);
      
      // Still allow the transaction but log the warning
      console.log(`=== PRICE MISMATCH WARNING ===`);
      console.log(`Expected price: ${expectedPrice} MONAD`);
      console.log(`Transaction value: ${txValueInEther} MONAD`);
      console.log(`Difference: ${Number(txValueInEther) - expectedPrice} MONAD`);
    }
    
    // Format the response to be compatible with wagmi v2
    const wagmiCompatibleData = {
      address: transactionData.to,
      abi: RAW_CALL_ABI,
      functionName: 'execute',
      value: transactionData.value || '0',
      data: transactionData.data,
      from: taker
    };
    
    console.log('=== RETURNING TRANSACTION DATA ===');
    console.log('Transaction to address:', transactionData.to);
    console.log('Transaction from address (buyer):', taker);
    console.log('Transaction value:', transactionData.value || '0');
    console.log('Transaction value in MONAD:', BigInt(transactionData.value || '0') / BigInt(10**18));
    console.log('Transaction data length:', transactionData.data?.length || 0);
    
    // Log the first part of the data for debugging
    if (transactionData.data) {
      console.log('Transaction data (first 100 chars):', transactionData.data.substring(0, 100));
      
      // Try to decode the function signature
      const functionSignature = transactionData.data.substring(0, 10);
      console.log('Function signature:', functionSignature);
    }
    
    return NextResponse.json({ 
      success: true, 
      data: {
        transactionData,
        wagmiCompatibleData,
        originalResponse: data
      },
      message: 'Purchase transaction prepared'
    });
  } catch (error) {
    console.error('Error executing purchase:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Failed to execute purchase', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
} 