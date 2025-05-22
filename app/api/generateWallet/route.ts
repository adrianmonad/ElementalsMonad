import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Use the hardcoded credentials from the curl example
    const appId = "cmapz1r8l003rjp0m2e3ygesl";
    const apiKey = "37HM9di5kVFGPuDmFCdqJNz6hFUNr8PCTteAxsgqBgEVnMTqbUWmvFZUJFWDQNViUhEhGj9pyeEmpcsN4sU9cosL";
    
    console.log(`Generating wallet for email: ${email}`);

    // Make the API call to Privy to generate a wallet
    const privyRes = await fetch('https://auth.privy.io/api/v1/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${appId}:${apiKey}`).toString('base64')}`,
        'privy-app-id': appId
      },
      body: JSON.stringify({
        create_ethereum_wallet: true,
        linked_accounts: [
          {
            address: email,
            type: 'email',
          },
        ],
      }),
    });

    if (!privyRes.ok) {
      const errorText = await privyRes.text();
      console.error('Privy API error:', errorText);
      return NextResponse.json({ error: errorText }, { status: privyRes.status });
    }

    const data = await privyRes.json();
    console.log('Wallet generated successfully:', JSON.stringify(data));
    
    // Extract wallet address from linked_accounts - find the wallet account
    const walletAccount = data?.linked_accounts?.find(
      (account: any) => account.type === "wallet" && account.address
    );
    
    const walletAddress = walletAccount?.address || null;
    const userId = data?.id || null;

    if (!walletAddress || !userId) {
      console.error('Missing wallet address or user ID in response:', data);
      return NextResponse.json(
        { error: 'Failed to get wallet address or user ID from Privy' }, 
        { status: 500 }
      );
    }

    console.log(`Generated wallet for ${email}: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`);
    return NextResponse.json({ walletAddress, userId });
  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { error: (error as Error).message }, 
      { status: 500 }
    );
  }
} 