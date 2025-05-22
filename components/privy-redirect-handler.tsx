"use client";

import { ReactNode, useEffect } from "react";
import { usePrivy } from '@privy-io/react-auth';

export function PrivyRedirectHandler({ children }: { children: ReactNode }) {
  const privy = usePrivy();
  
  // Handle redirect after authentication
  useEffect(() => {
    // Check if we need to process a redirect (coming from auth flow)
    if (window.location.href.includes('privy-redirect')) {
      console.log("Detected Privy redirect URL, handling redirect");
      
      // Attempt to resolve the login
      try {
        // The Privy library will automatically handle the redirected state
        // Just ensure UI updates correctly
        setTimeout(() => {
          if (!privy.authenticated) {
            console.log("Auth not completed after redirect, refreshing page");
            window.location.reload();
          } else {
            console.log("Auth completed after redirect");
          }
        }, 3000);
      } catch (error) {
        console.error("Error handling Privy redirect:", error);
      }
    }
  }, [privy.authenticated]);
  
  return <>{children}</>;
} 