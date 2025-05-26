"use client";

import { ReactNode } from "react";
import { PrivyProvider } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';

export function PrivyProviderWrapper({ children }: { children: ReactNode }) {
  const router = useRouter();

  // Define Monad Testnet with fallback RPC
  const monadTestnet = {
    id: 10143,
    name: 'Monad Testnet',
    rpcUrls: {
      default: {
        http: [
          process.env.NEXT_PUBLIC_MONAD_RPC_URL || 
          'https://testnet-rpc.monad.xyz/'
        ]
      },
      public: {
        http: [
          process.env.NEXT_PUBLIC_MONAD_RPC_URL || 
          'https://testnet-rpc.monad.xyz/'
        ]
      }
    },
    nativeCurrency: {
      name: 'Monad',
      symbol: 'MONAD',
      decimals: 18
    }
  };

  console.log("Initializing Privy Provider with app ID:", process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cmaxolxnt001vjo0mw88rm5tl");

  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cmaxolxnt001vjo0mw88rm5tl"}
      config={{
        loginMethods: ['email', 'wallet', 'farcaster'],
        appearance: {
          theme: 'dark',
          accentColor: '#ffc107',
          logo: '/images/elementals-logo.png',
        },
        embeddedWallets: {
          createOnLogin: "all-users" as const,
          ethereum: { 
            createOnLogin: "all-users",
          },
          showWalletUIs: false,
        },
        supportedChains: [monadTestnet],
        defaultChain: monadTestnet,
        walletConnectCloudProjectId: '3fd3b124db7a6cb91c7cf7dc45cfbbd2',
      }}
    >
      {children}
    </PrivyProvider>
  );
}
