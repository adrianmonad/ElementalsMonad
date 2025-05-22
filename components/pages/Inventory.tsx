import { useState, useEffect } from "react";
import { useAccount, useConnect, useSwitchChain, useReadContract } from "wagmi";
import { monadTestnet } from "viem/chains";
import { farcasterFrame } from "@farcaster/frame-wagmi-connector";
import { ElementalDetails } from "@/components/Game/ElementalDetails";
import { getElementalGif, getElementalName, getRarityTier } from "@/lib/elementals";

// NFT Contract address
const NFT_CONTRACT = "0x8549FaF1d5553dB17C9c6154141e5357758006cC" as `0x${string}`;
const MONAD_TESTNET_ID = 10143;

// ERC721 ABI for the functions we need
const ERC721_ABI = [
  {
    "inputs": [{"internalType": "address", "name": "owner", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];

export default function Inventory() {
  const [userTokens, setUserTokens] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTokenId, setSelectedTokenId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'id' | 'rarity'>('id');
  const [error, setError] = useState<string | null>(null);
  const [fetchMethod, setFetchMethod] = useState<'alchemy' | 'magiceden' | 'none'>('none');
  const [rawResponse, setRawResponse] = useState<any>(null);
  const [balance, setBalance] = useState<BigInt>(BigInt(0));

  const { isConnected, address, chainId } = useAccount();
  const { connect } = useConnect();
  const { switchChain } = useSwitchChain();

  // Get the user's token balance from the contract
  const { data: balanceData, isLoading: isBalanceLoading } = useReadContract({
    address: NFT_CONTRACT,
    abi: ERC721_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
    query: {
      enabled: Boolean(isConnected && chainId === MONAD_TESTNET_ID && address),
    },
  });

  useEffect(() => {
    if (!isConnected || chainId !== MONAD_TESTNET_ID || !address) return;

    async function fetchUserTokens() {
      setIsLoading(true);
      setError(null);
      setUserTokens([]);
      
      try {
        console.log(`Fetching inventory for wallet: ${address}`);
        
        // Only use Magic Eden Tokens API
        const tokenData = await fetchTokensUsingMagicEden(address as string);
        console.log(`Found ${tokenData.length} tokens from Magic Eden API`);
        
        if (tokenData.length > 0) {
          setBalance(BigInt(tokenData.length));
          setUserTokens(sortTokens(tokenData, sortBy));
        } else {
          // If we got no tokens
          console.warn("No tokens found from Magic Eden API");
          setBalance(BigInt(0));
          setUserTokens([]);
        }
      } catch (err) {
        console.error("Error fetching user tokens:", err);
        setError("Failed to load your Elementals. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    }

    fetchUserTokens();
  }, [isConnected, chainId, address, sortBy]);

  // Helper function to fetch tokens using Magic Eden API
  async function fetchTokensUsingMagicEden(walletAddress: string): Promise<number[]> {
    console.log(`Fetching tokens for address ${walletAddress} using Magic Eden API`);
    
    const result = await fetch('/api/getMagicEdenTokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress,
      }),
    });
    
    if (!result.ok) {
      const errorData = await result.json();
      console.error('API error fetching tokens using Magic Eden:', errorData);
      throw new Error(errorData.error || 'Failed to fetch tokens using Magic Eden');
    }
    
    const data = await result.json();
    
    // Store raw response for debugging if not already set
    if (data.rawResponse && !rawResponse) {
      setRawResponse(data.rawResponse);
    }
    
    if (Array.isArray(data.tokens)) {
      console.log(`Found ${data.tokens.length} tokens using Magic Eden API:`, data.tokens);
      return data.tokens;
    }
    
    return [];
  }

  // Helper function to sort tokens
  function sortTokens(tokens: number[], sortType: string): number[] {
    const tokensCopy = [...tokens];
    
    switch (sortType) {
      case 'id':
        return tokensCopy.sort((a, b) => a - b);
      case 'rarity':
        // Higher tokenId generally means higher rarity in your system
        return tokensCopy.sort((a, b) => b - a);
      // For newest/oldest, we don't have timestamp data from the blockchain
      // So we'll just use ID as a proxy (higher ID = newer mint)
      case 'newest':
        return tokensCopy.sort((a, b) => b - a);
      case 'oldest':
        return tokensCopy.sort((a, b) => a - b);
      default:
        return tokensCopy;
    }
  }

  // Render connection state if not connected
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border border-[#333] rounded-md">
        <h2 className="text-xl font-bold mb-4">Your Elementals Inventory</h2>
        <p className="mb-4">Connect your wallet to view your Elementals</p>
        <button
          className="bg-white text-black rounded-md p-2 text-sm"
          onClick={() => connect({ connector: farcasterFrame() })}
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  // Render wrong network state
  if (chainId !== MONAD_TESTNET_ID) {
    return (
      <div className="flex flex-col items-center justify-center p-8 border border-[#333] rounded-md">
        <h2 className="text-xl font-bold mb-4">Your Elementals Inventory</h2>
        <p className="mb-4">Please switch to Monad Testnet to view your Elementals</p>
        <button
          className="bg-white text-black rounded-md p-2 text-sm"
          onClick={() => switchChain({ chainId: MONAD_TESTNET_ID })}
        >
          Switch to Monad Testnet
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 border border-[#333] rounded-md">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Your Elementals Inventory</h2>
        
        {/* Sorting options */}
        <div className="flex items-center">
          <span className="mr-2 text-sm text-gray-400">Sort by:</span>
          <select 
            className="bg-[#222] text-white text-sm rounded-md border border-[#444] px-2 py-1"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="id">Token ID</option>
            <option value="rarity">Rarity</option>
          </select>
        </div>
      </div>
      
      {isLoading || isBalanceLoading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
        </div>
      ) : error ? (
        <div className="text-red-500 text-center p-4">{error}</div>
      ) : userTokens.length === 0 ? (
        <div className="text-center p-8">
          <p className="mb-4">You don't own any Elementals yet</p>
          <p className="mb-4 text-sm text-yellow-400">
            {balance && Number(balance) > 0 ? 
              `Your wallet shows ${balance.toString()} NFTs, but we couldn't load them.` : 
              "Your wallet balance is 0 NFTs."
            }
          </p>
          <a 
            href="#"
            onClick={(e) => {
              e.preventDefault();
              // Navigate to home page
              window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'home' } }));
            }}
            className="bg-white text-black rounded-md p-2 text-sm inline-block"
          >
            Hatch Your First Elemental
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {userTokens.map((tokenId) => (
            <div 
              key={tokenId}
              className="bg-[#111] p-3 rounded-lg text-center flex flex-col items-center cursor-pointer hover:bg-[#222] transition-colors"
              onClick={() => setSelectedTokenId(tokenId)}
            >
              <div className="w-full pb-[100%] relative mb-2">
                <img 
                  src={getElementalGif(tokenId)}
                  alt={`${getElementalName(tokenId)} #${tokenId}`}
                  className="absolute inset-0 w-full h-full object-contain"
                />
              </div>
              <p className="text-sm font-semibold">{getElementalName(tokenId)}</p>
              <p className="text-xs text-yellow-400">{getRarityTier(tokenId)}</p>
              <p className="text-xs text-gray-400">#{tokenId}</p>
            </div>
          ))}
        </div>
      )}
      
      {/* Modal for elemental details */}
      {selectedTokenId !== null && (
        <ElementalDetails 
          tokenId={selectedTokenId} 
          onClose={() => setSelectedTokenId(null)} 
        />
      )}
    </div>
  );
} 