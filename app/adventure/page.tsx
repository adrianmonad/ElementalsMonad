"use client";

import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import useMagicEdenInventory from "@/hooks/useMagicEdenInventory";
import { GameFlow } from "@/components/Game/GameFlow";

export default function AdventurePage() {
  const router = useRouter();
  const { address } = useAccount();
  const { inventory } = useMagicEdenInventory(address);

  // Count the number of Elementals (NFTs)
  const elementalsCount = inventory?.length || 0;

  const handleBattleZone = () => {
    router.push("/battle-zone");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-black">
      <div className="max-w-md w-full bg-[var(--game-panel-bg)] rounded-lg shadow-lg p-6 flex flex-col items-center">
        <h1 className="font-pixel text-2xl text-[var(--game-gold)] mb-2 text-center">ADVENTURE HUB</h1>
        <p className="text-center text-[var(--game-gold)] mb-4">Welcome, Adventurer!</p>
        <div className="mb-4 text-center">
          <span className="font-pixel text-lg">You have </span>
          <span className="font-pixel text-2xl text-[var(--game-gold)]">{elementalsCount}</span>
          <span className="font-pixel text-lg"> Elemental{elementalsCount === 1 ? "" : "s"}</span>
        </div>
        {/* Inline hatching UI always visible */}
        <div className="w-full mb-6">
          <GameFlow />
        </div>
        <button
          className="game-button py-4 px-8 text-xl font-pixel bg-[var(--game-gold)] text-black hover:bg-yellow-400 w-full max-w-xs mb-2 shadow-lg border-2 border-yellow-400"
          onClick={handleBattleZone}
        >
          BATTLE ZONE
        </button>
      </div>
    </div>
  );
} 