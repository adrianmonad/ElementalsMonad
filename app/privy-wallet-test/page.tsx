"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PrivyWalletTestRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to the new battle-arena page
    router.replace('https://elementals-monad.vercel.app/battle-arena');
  }, [router]);
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="text-center">
        <h1 className="text-2xl mb-4">Redirecting...</h1>
        <p className="text-gray-400">Please wait while we redirect you to the Battle Arena.</p>
        <div className="mt-4 animate-pulse flex space-x-2 justify-center">
          <div className="h-3 w-3 bg-blue-400 rounded-full"></div>
          <div className="h-3 w-3 bg-blue-400 rounded-full"></div>
          <div className="h-3 w-3 bg-blue-400 rounded-full"></div>
        </div>
      </div>
    </div>
  );
} 