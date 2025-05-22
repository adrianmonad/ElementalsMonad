"use client";

import { User } from "@/components/Home/User";
import { WalletActions } from "@/components/Home/WalletActions";
import { GameFlow } from "@/components/Game/GameFlow";
import { useState, useRef, useEffect } from "react";
import Inventory from "@/components/Game/Inventory";
import MagicEdenMarketplace from "@/components/Game/MagicEdenMarketplace";
import { useMiniAppContext } from "@/hooks/use-miniapp-context";
import { useAccount } from "wagmi";
import Image from "next/image";

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<'home' | 'inventory' | 'marketplace' | 'leaderboard' | 'battle-zone'>('home');
  const [gameFlowState, setGameFlowState] = useState<'start' | 'hatch' | 'adventure'>('start');
  const menuRef = useRef<HTMLDivElement>(null);
  const { context } = useMiniAppContext();
  const { address, isConnected } = useAccount();

  // Game stats (mock data)
  const [stats, setStats] = useState({
    health: 80,
    mana: 65,
    coins: 150,
    attack: 25,
    defense: 18,
    level: 5,
  });

  // Listen for game state changes from GameFlow component
  useEffect(() => {
    function handleGameStateChange(event: Event) {
      const customEvent = event as CustomEvent;
      if (customEvent.detail && customEvent.detail.gameStep) {
        setGameFlowState(customEvent.detail.gameStep);
      }
    }
    
    window.addEventListener('gameStateChange', handleGameStateChange);
    return () => {
      window.removeEventListener('gameStateChange', handleGameStateChange);
    };
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuRef]);

  // Handle navigation
  const navigateTo = (page: 'home' | 'inventory' | 'marketplace' | 'leaderboard' | 'battle-zone') => {
    if (page === 'battle-zone') {
      // Use router for page-level navigation
      window.location.href = '/battle-zone';
      return;
    }
    
    setCurrentPage(page);
    setMenuOpen(false);
    
    // Reset gameFlowState to 'start' when navigating to home page
    if (page === 'home') {
      setGameFlowState('start');
      // Dispatch event to notify GameFlow component about the reset
      window.dispatchEvent(new CustomEvent('resetGameFlow', { 
        detail: { reset: true }
      }));
    }
  };

  // Get rarity color class based on level
  const getRarityClass = (level: number): string => {
    if (level < 3) return "ro-rarity-common";
    if (level < 6) return "ro-rarity-uncommon";
    if (level < 10) return "ro-rarity-rare";
    if (level < 15) return "ro-rarity-epic";
    return "ro-rarity-legendary";
  };

  return (
    <div className="min-h-screen w-full flex flex-col relative p-4 pt-2 md:pt-4 pb-20 overflow-x-hidden">
      {/* Main layout container with proper spacing */}
      <div className="flex flex-col w-full">
        {/* Clean header layout: profile left, menu right - consistent across all pages */}
        <div className="flex flex-row items-start justify-between w-full px-1 py-2">
          {/* Profile Card - More compact and cleaner - only on home page */}
          {currentPage === 'home' && gameFlowState !== 'hatch' && (
            <div className="z-50 mt-0">
              <div className="ro-window p-1 h-full">
                <div className="flex items-center">
                  {/* Character Portrait */}
                  <div className="ro-portrait w-14 h-14 border-r-2 border-[var(--ro-border-dark)] relative pixel-border-animated pixel-dots-animated">
                    {context?.user?.pfpUrl ? (
                      <img 
                        src={context.user.pfpUrl} 
                        alt="Avatar" 
                        className="w-full h-full object-cover pixelated"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white bg-[var(--ro-bg-dark)]">
                        ?
                      </div>
                    )}
                  </div>
                  {/* User Info - Clean vertical stack */}
                  <div className="flex flex-col p-2 pl-3">
                    {/* Display Name */}
                    <div className="text-sm font-pixel text-[var(--ro-gold)] leading-tight">
                      {context?.user?.displayName || "Adventurer"}
                    </div>
                    {/* Username and FID in clean stack */}
                    <div className="text-xs font-pixel text-[var(--ro-text)] leading-tight mt-1">
                      @{context?.user?.username || "user"}
                    </div>
                    <div className="text-xs font-pixel text-[var(--ro-text)] leading-tight">
                      FID: <span className="text-[var(--ro-gold)]">{context?.user?.fid || "—"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Page title on non-home pages (left side) */}
          {currentPage !== 'home' && (
            <div className="invisible w-16">Spacer</div>
          )}
          {/* Empty div to preserve justify-between spacing if no content on left side */}
          {currentPage !== 'home' && gameFlowState === 'hatch' && (
            <div></div>
          )}
          
          {/* Menu Button - Always on right */}
          <div className="relative z-50 ml-auto mt-0" ref={menuRef}>
            <div className="ro-window p-0">
              <div className="ro-menu-button" onClick={() => setMenuOpen(!menuOpen)}>
                <div className="ro-menu-line"></div>
                <div className="ro-menu-line"></div>
                <div className="ro-menu-line"></div>
              </div>
            </div>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 z-50">
                <div className="ro-menu">
                  <div className="ro-window-header">Menu</div>
                  <div className="p-2 space-y-1">
                    <button 
                      onClick={() => navigateTo('home')}
                      className={`w-full ro-button ${currentPage === 'home' ? 'bg-[var(--ro-accent)]' : ''}`}
                    >
                      HOME
                    </button>
                    <button 
                      onClick={() => navigateTo('inventory')}
                      className={`w-full ro-button ${currentPage === 'inventory' ? 'bg-[var(--ro-accent)]' : ''}`}
                    >
                      INVENTORY
                    </button>
                    <button 
                      onClick={() => navigateTo('marketplace')}
                      className={`w-full ro-button ${currentPage === 'marketplace' ? 'bg-[var(--ro-accent)]' : ''}`}
                    >
                      MARKETPLACE
                    </button>
                    <button 
                      onClick={() => navigateTo('leaderboard')}
                      className={`w-full ro-button ${currentPage === 'leaderboard' ? 'bg-[var(--ro-accent)]' : ''}`}
                    >
                      RANKINGS
                    </button>
                    {/* Always show Battle Arena */}
                    <a href="https://elementals-monad.vercel.app/battle-area" target="_blank" rel="noopener noreferrer">
                      <button className="w-full ro-button bg-blue-600 mt-2">
                        BATTLE ARENA
                      </button>
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Game content with balanced margin */}
        <div className="mt-6">
          {/* Page Title */}
          <div className="text-center mb-4">
            {currentPage !== 'home' && (
              <h1 className={`text-2xl font-pixel text-shadow pb-2 ${getRarityClass(stats.level)}`}>
                {currentPage === 'inventory' && 'INVENTORY'}
                {currentPage === 'marketplace' && 'MARKETPLACE'}
                {currentPage === 'leaderboard' && 'RANKINGS'}
              </h1>
            )}
          </div>
          
          {/* Page Content */}
          <div className="w-full">
            <div className="ro-window overflow-hidden">
              {currentPage === 'home' && (
                <div className="p-4">
                  {!isConnected ? (
                    <div className="flex flex-col items-center mb-6">
                      <div className="text-center mb-4">
                        <div className="flex justify-center items-center mb-4">
                          <img 
                            src="/images/elementals-logo.png" 
                            alt="Elementals Adventure" 
                            className="h-28 md:h-32 object-contain pixelated"
                            style={{ imageRendering: 'pixelated' }}
                          />
                        </div>
                        <h2 className="text-xl font-pixel text-yellow-400 mb-3">
                          BEGIN YOUR QUEST
                        </h2>
                        <p className="text-yellow-400 text-sm mb-4">Embark on an adventure in the Elementals universe!</p>
                      </div>
                      <div className="w-full max-w-md">
                        <WalletActions />
                      </div>
                    </div>
                  ) : (
                    <>
                      {gameFlowState === 'start' && (
                        <div className="text-center mb-6">
                          <div className="flex justify-center items-center mb-4">
                            <img 
                              src="/images/elementals-logo.png" 
                              alt="Elementals Adventure" 
                              className="h-28 md:h-32 object-contain pixelated"
                              style={{ imageRendering: 'pixelated' }}
                            />
                          </div>
                        </div>
                      )}
                      <GameFlow />
                      <div className="mt-6">
                        <WalletActions />
                      </div>
                    </>
                  )}
                </div>
              )}
              
              {currentPage === 'inventory' && (
                <div className="p-2 max-h-[70vh] md:max-h-[80vh] overflow-y-auto">
                  <Inventory />
                </div>
              )}
              
              {currentPage === 'marketplace' && (
                <div className="p-2 max-h-[70vh] md:max-h-[80vh] overflow-y-auto">
                  <MagicEdenMarketplace />
                </div>
              )}
              
              {currentPage === 'leaderboard' && (
                <div className="p-4">
                  <div className="flex flex-col items-center">
                    <div className="w-full h-64 bg-[var(--ro-bg-dark)] border-2 border-[var(--ro-border-light)] mb-4 flex flex-col items-center justify-center">
                      <p className="text-[var(--ro-gold)] text-sm font-pixel mb-4">RANKINGS COMING SOON</p>
                      <div className="flex space-x-4">
                        <img src="/assets/Emberith.gif" alt="Emberith" className="w-16 h-16 pixelated" />
                        <img src="/assets/Nyxar.gif" alt="Nyxar" className="w-16 h-16 pixelated" />
                        <img src="/assets/Rhoxodon.gif" alt="Rhoxodon" className="w-16 h-16 pixelated" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}