"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// This redirects from the old battle-zone page to the new battle-area implementation
export default function BattleZoneRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/battle-area');
  }, [router]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center">
      <div className="w-16 h-16 animate-spin rounded-full border-4 border-[#333333] border-t-[#ffc107]"></div>
      <p className="mt-4 text-white">Redirecting to Battle Arena...</p>
    </div>
  );
} 