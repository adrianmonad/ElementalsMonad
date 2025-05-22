import { monadTestnet } from "viem/chains";
import { createPublicClient, http } from "viem";

const environment = process.env.NODE_ENV;
const rpc = environment === "production" ? process.env.NEXT_PUBLIC_MONAD_RPC_URL || monadTestnet.rpcUrls.default.http[0] : monadTestnet.rpcUrls.default.http[0];

export const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http(rpc),
});
