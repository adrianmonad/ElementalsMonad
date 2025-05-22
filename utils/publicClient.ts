import { createPublicClient, http } from 'viem';
import { monadTestnet } from 'viem/chains';

// Use environment variable or fallback to default RPC URL
const rpc = process.env.NEXT_PUBLIC_MONAD_RPC_URL || 
            monadTestnet.rpcUrls.default.http[0];

export const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(rpc)
}); 