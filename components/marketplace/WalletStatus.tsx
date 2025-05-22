import { useAccount, useConnect, useDisconnect } from "wagmi";
import { farcasterFrame } from "@farcaster/frame-wagmi-connector";
import { monadTestnet } from "viem/chains";

export function WalletStatus() {
  const { isConnected, address, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const { connect } = useConnect();

  // Format address for display
  const formatAddress = (addr: string | undefined) => {
    if (!addr) return '';
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  return (
    <div className="bg-[var(--ro-panel-bg)] p-4 shadow-lg mb-6 rounded-md">
      <h2 className="text-2xl font-pixel text-center mb-3 text-[var(--ro-gold)]">WALLET STATUS</h2>
      {isConnected ? (
        <div className="flex flex-col items-center space-y-3">
          <div className="bg-[var(--ro-panel-dark)] rounded-md p-3 w-full">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center">
                <span className="text-[var(--ro-gold)] font-pixel text-base mr-2">Connected Wallet:</span>
                <span className="font-pixel text-sm bg-transparent px-2 py-1 text-[var(--ro-gold)]">
                  {formatAddress(address)}
                </span>
              </div>
              <div className="flex items-center">
                <span className="text-[var(--ro-gold)] font-pixel text-base mr-2">Chain:</span>
                <span className="font-pixel text-sm bg-transparent px-2 py-1 text-[var(--ro-gold)]">
                  {chainId === monadTestnet.id ? "Monad Testnet" : `Unknown (${chainId})`}
                </span>
              </div>
            </div>
          </div>
          <button 
            className="bg-red-600 hover:bg-red-500 text-white rounded-md px-4 py-2 text-base font-pixel w-full transition-all border-2 border-red-800"
            onClick={() => disconnect()}
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center space-y-3">
          <p className="text-base text-[var(--ro-gold)] text-center">
            You are not connected to any wallet. Please connect to interact with the marketplace.
          </p>
          <button
            className="game-button w-full py-2"
            onClick={() => connect({ connector: farcasterFrame() })}
          >
            Connect Wallet
          </button>
        </div>
      )}
    </div>
  );
} 