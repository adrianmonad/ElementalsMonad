import { useEffect, useRef } from 'react';
import { 
  getElementalGif, 
  getElementalName, 
  getRarityTier, 
  getElementType, 
  getPowerLevel,
  calculateHealth,
  calculateAttack,
  calculateDefense,
  calculateSpeed,
  createElementalShareMessage
} from '@/lib/elementals';

interface ElementalDetailsProps {
  tokenId: number | null;
  onClose: () => void;
}

export function ElementalDetails({ tokenId, onClose }: ElementalDetailsProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  
  // Close modal when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  // Close on escape key
  useEffect(() => {
    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    
    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [onClose]);

  if (!tokenId) return null;

  const elementalName = getElementalName(tokenId);
  const rarityTier = getRarityTier(tokenId);
  const elementType = getElementType(tokenId);
  const powerLevel = getPowerLevel(tokenId);
  
  // Get stats
  const health = calculateHealth(tokenId);
  const attack = calculateAttack(tokenId);
  const defense = calculateDefense(tokenId);
  const speed = calculateSpeed(tokenId);
  
  // Get share message
  const shareMessage = createElementalShareMessage(tokenId);

  // Get color based on rarity
  const getRarityColor = (rarity: string): string => {
    switch (rarity) {
      case 'Legendary': return 'var(--game-gold)';
      case 'Epic': return '#9b59b6';
      case 'Rare': return '#3498db';
      case 'Uncommon': return '#2ecc71';
      default: return '#ecf0f1';
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 z-[100] p-4">
      <div 
        ref={modalRef}
        className="game-panel max-w-md w-full overflow-y-auto max-h-[90vh]"
      >
        <div className="game-panel-header flex justify-between items-center sticky top-0 bg-[var(--ro-bg-dark)] z-10 p-2">
          <h2 className="text-sm font-pixel">{elementalName.toUpperCase()} #{tokenId}</h2>
          <button 
            onClick={onClose}
            className="text-white hover:text-gray-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="game-panel-content">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Elemental image */}
            <div className="w-full md:w-1/2">
              <div className="game-panel p-2 flex items-center justify-center">
                <img 
                  src={getElementalGif(tokenId)} 
                  alt={`${elementalName} #${tokenId}`}
                  className="w-32 h-32 object-contain pixelated"
                />
              </div>
              <p className="text-center mt-2">
                <span className="text-xs font-pixel" style={{ color: getRarityColor(rarityTier) }}>
                  {rarityTier}
                </span>
              </p>
            </div>
            
            {/* Stats */}
            <div className="w-full md:w-1/2">
              <div className="mb-3">
                <h3 className="font-pixel text-[10px] text-[var(--game-gold)] mb-1">ELEMENT</h3>
                <p className="text-xs">{elementType}</p>
              </div>
              
              <div className="mb-3">
                <h3 className="font-pixel text-[10px] text-[var(--game-gold)] mb-1">POWER LEVEL</h3>
                <div className="w-full bg-[#333] h-2 mb-1 border border-[var(--game-panel-border-outer)]">
                  <div 
                    className="bg-[#3366ff] h-full" 
                    style={{ width: `${(powerLevel / 25) * 100}%` }}
                  ></div>
                </div>
                <p className="text-[8px] text-right">{powerLevel}/25</p>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-pixel text-[10px] text-[var(--game-gold)] mb-1">STATS</h3>
                
                <div>
                  <div className="flex justify-between text-[10px]">
                    <span>HP</span>
                    <span>{health}</span>
                  </div>
                  <div className="w-full bg-[#333] h-2 mt-1 border border-[var(--game-panel-border-outer)]">
                    <div className="bg-[#ff3333] h-full" style={{ width: `${(health / 350) * 100}%` }}></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-[10px]">
                    <span>ATK</span>
                    <span>{attack}</span>
                  </div>
                  <div className="w-full bg-[#333] h-2 mt-1 border border-[var(--game-panel-border-outer)]">
                    <div className="bg-[#ff9933] h-full" style={{ width: `${(attack / 60) * 100}%` }}></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-[10px]">
                    <span>DEF</span>
                    <span>{defense}</span>
                  </div>
                  <div className="w-full bg-[#333] h-2 mt-1 border border-[var(--game-panel-border-outer)]">
                    <div className="bg-[#3366ff] h-full" style={{ width: `${(defense / 30) * 100}%` }}></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-[10px]">
                    <span>SPD</span>
                    <span>{speed}</span>
                  </div>
                  <div className="w-full bg-[#333] h-2 mt-1 border border-[var(--game-panel-border-outer)]">
                    <div className="bg-[#33cc33] h-full" style={{ width: `${(speed / 20) * 100}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => {
                window.open(`https://warpcast.com/~/compose?text=${encodeURIComponent(shareMessage)}`, '_blank');
              }}
              className="game-button py-2 px-3 text-xs flex items-center"
            >
              <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M13.31 1.417a1.25 1.25 0 0 0-2.62 0l-1.299 5.246a.25.25 0 0 1-.434.121L4.32 3.049a1.25 1.25 0 0 0-1.854 1.666l3.436 3.823a.25.25 0 0 1-.121.434L.535 10.271a1.25 1.25 0 0 0 0 2.458l5.246 1.3a.25.25 0 0 1 .121.433l-3.736 4.636a1.25 1.25 0 0 0 1.85 1.674l4.644-3.842a.25.25 0 0 1 .434.119l1.299 5.246a1.25 1.25 0 0 0 2.62 0l1.299-5.246a.25.25 0 0 1 .434-.12l4.643 3.843a1.25 1.25 0 0 0 1.854-1.666l-3.736-4.644a.25.25 0 0 1 .121-.433l5.246-1.3a1.25 1.25 0 0 0 0-2.458l-5.246-1.3a.25.25 0 0 1-.12-.433l3.734-4.648a1.25 1.25 0 0 0-1.851-1.666l-4.644 3.843a.25.25 0 0 1-.434-.121l-1.299-5.246Z" />
              </svg>
              SHARE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 