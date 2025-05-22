"use client";

import { FrameContext } from "@farcaster/frame-core/dist/context";
import sdk from "@farcaster/frame-sdk";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import FrameWalletProvider from "./frame-wallet-provider";

interface FrameContextValue {
  context: FrameContext | null;
  isSDKLoaded: boolean;
  isEthProviderAvailable: boolean;
  error: string | null;
  actions: typeof sdk.actions | null;
}

// Create context with a default value to prevent undefined errors
const FrameProviderContext = createContext<FrameContextValue>({
  context: null,
  isSDKLoaded: false,
  isEthProviderAvailable: false,
  error: null,
  actions: null,
});

// Export the hook for accessing the context
export const useFrame = () => useContext(FrameProviderContext);

interface FrameProviderProps {
  children: ReactNode;
}

export function FrameProvider({ children }: FrameProviderProps) {
  const [context, setContext] = useState<FrameContext | null>(null);
  const [actions, setActions] = useState<typeof sdk.actions | null>(null);
  const [isEthProviderAvailable, setIsEthProviderAvailable] = useState<boolean>(false);
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        // Wrap SDK initialization in try/catch for better error handling
        console.log("Initializing Farcaster SDK...");
        
        // Check if SDK is properly loaded
        if (!sdk || !sdk.context) {
          console.log("SDK not available or missing context property");
          setError("SDK not available");
          return;
        }
        
        const farcasterContext = await sdk.context;
        if (farcasterContext) {
          console.log("Farcaster context loaded successfully");
          setContext(farcasterContext as FrameContext);
          setActions(sdk.actions);
          setIsEthProviderAvailable(sdk.wallet && sdk.wallet.ethProvider ? true : false);
          
          // Correctly call ready with proper error handling
          try {
            await sdk.actions.ready();
            console.log("SDK ready called successfully");
          } catch (readyError) {
            console.warn("Error calling sdk.actions.ready():", readyError);
            // Continue despite ready error
          }
        } else {
          console.log("Failed to load Farcaster context - returned null/undefined");
          setError("Failed to load Farcaster context");
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to initialize SDK";
        console.error("SDK initialization error:", err);
        setError(errorMessage);
      }
    };

    if (!isSDKLoaded) {
      console.log("Loading Farcaster SDK...");
      load().then(() => {
        setIsSDKLoaded(true);
        console.log("SDK loading process completed");
      }).catch(e => {
        console.error("Unexpected error in SDK loading:", e);
        setIsSDKLoaded(true); // Mark as loaded anyway to prevent infinite retry
        setError("Unexpected SDK loading error");
      });
    }
  }, [isSDKLoaded]);

  return (
    <FrameProviderContext.Provider
      value={{
        context,
        actions,
        isSDKLoaded,
        isEthProviderAvailable,
        error,
      }}
    >
      <FrameWalletProvider>{children}</FrameWalletProvider>
    </FrameProviderContext.Provider>
  );
}
