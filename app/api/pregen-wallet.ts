import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.query;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid email' });
  }

  try {
    // Use the hardcoded credentials from the curl example
    const appId = "cmapz1r8l003rjp0m2e3ygesl";
    const apiKey = "37HM9di5kVFGPuDmFCdqJNz6hFUNr8PCTteAxsgqBgEVnMTqbUWmvFZUJFWDQNViUhEhGj9pyeEmpcsN4sU9cosL";
    
    if (!appId || !apiKey) {
      return res.status(500).json({ error: 'Missing Privy credentials' });
    }
    
    // EXACTLY match the cURL format from the example
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

    // Log response status and text for debugging
    console.log(`Privy API response status: ${privyRes.status}`);
    
    if (!privyRes.ok) {
      const errorText = await privyRes.text();
      console.error('Privy API error:', errorText);
      return res.status(privyRes.status).json({ error: errorText });
    }

    const data = await privyRes.json();
    console.log('Privy API response:', JSON.stringify(data, null, 2));
    
    // Extract wallet address from linked_accounts - find the wallet account
    const walletAccount = data?.linked_accounts?.find(
      (account: any) => account.type === "wallet" && account.address
    );
    
    const walletAddress = walletAccount?.address || null;
    const userId = data?.id || null;

    if (!walletAddress || !userId) {
      console.error('No wallet address or user ID in response:', data);
      return res.status(500).json({ error: 'Failed to get wallet address or user ID from Privy' });
    }

    return res.status(200).json({ walletAddress, userId });
  } catch (error) {
    console.error('API route error:', error);
    return res.status(500).json({ error: (error as Error).message });
  }
} 