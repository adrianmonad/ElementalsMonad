// Utility functions for Elementals

/**
 * Get the GIF image path for an elemental based on its token ID
 */
export function getElementalGif(tokenId: number | null): string {
  if (tokenId === null) return "/assets/unknown.gif";
  
  if (tokenId >= 1 && tokenId <= 3250) return "/assets/Rhoxodon.gif";
  if (tokenId >= 3251 && tokenId <= 6499) return "/assets/Nactivyx.gif";
  if (tokenId >= 6500 && tokenId <= 7999) return "/assets/Infermor.gif";
  if (tokenId >= 8000 && tokenId <= 9499) return "/assets/Emberith.gif";
  if (tokenId >= 9500 && tokenId <= 10000) return "/assets/Nyxar.gif";
  
  return "/assets/unknown.gif";
}

/**
 * Get the name of an elemental based on its token ID
 */
export function getElementalName(tokenId: number | null): string {
  if (tokenId === null) return "Unknown";
  
  if (tokenId >= 1 && tokenId <= 3250) return "Rhoxodon";
  if (tokenId >= 3251 && tokenId <= 6499) return "Nactivyx";
  if (tokenId >= 6500 && tokenId <= 7999) return "Infermor";
  if (tokenId >= 8000 && tokenId <= 9499) return "Emberith";
  if (tokenId >= 9500 && tokenId <= 10000) return "Nyxar";
  
  return "Unknown";
}

/**
 * Get the rarity tier of an elemental based on its token ID
 */
export function getRarityTier(tokenId: number | null): string {
  if (tokenId === null) return "Unknown";
  
  if (tokenId >= 1 && tokenId <= 3250) return "Uncommon";
  if (tokenId >= 3251 && tokenId <= 6499) return "Common";
  if (tokenId >= 6500 && tokenId <= 7999) return "Epic";
  if (tokenId >= 8000 && tokenId <= 9499) return "Legendary";
  if (tokenId >= 9500 && tokenId <= 10000) return "Ultra Rare";
  
  return "Unknown";
}

/**
 * Get the element type of an elemental based on its token ID
 */
export function getElementType(tokenId: number | null): string {
  if (tokenId === null) return "Unknown";
  
  if (tokenId >= 1 && tokenId <= 3250) return "Earth";
  if (tokenId >= 3251 && tokenId <= 6499) return "Water";
  if (tokenId >= 6500 && tokenId <= 7999) return "Fire";
  if (tokenId >= 8000 && tokenId <= 9499) return "Air";
  if (tokenId >= 9500 && tokenId <= 10000) return "Void";
  
  return "Unknown";
}

/**
 * Get the power level of an elemental based on its token ID
 */
export function getPowerLevel(tokenId: number | null): number {
  if (tokenId === null) return 0;
  
  if (tokenId >= 1 && tokenId <= 3250) return 5;
  if (tokenId >= 3251 && tokenId <= 6499) return 10;
  if (tokenId >= 6500 && tokenId <= 7999) return 15;
  if (tokenId >= 8000 && tokenId <= 9499) return 20;
  if (tokenId >= 9500 && tokenId <= 10000) return 25;
  
  return 0;
}

/**
 * Calculate health stat based on power level
 */
export function calculateHealth(tokenId: number | null): number {
  const powerLevel = getPowerLevel(tokenId);
  return 100 + (powerLevel * 10);
}

/**
 * Calculate attack stat based on power level
 */
export function calculateAttack(tokenId: number | null): number {
  const powerLevel = getPowerLevel(tokenId);
  return 10 + (powerLevel * 2);
}

/**
 * Calculate defense stat based on power level
 */
export function calculateDefense(tokenId: number | null): number {
  const powerLevel = getPowerLevel(tokenId);
  return 5 + powerLevel;
}

/**
 * Calculate speed stat based on power level
 */
export function calculateSpeed(tokenId: number | null): number {
  const powerLevel = getPowerLevel(tokenId);
  return 10 + Math.floor(powerLevel / 2);
}

/**
 * Get CSS class for rarity badge
 */
export function getRarityBadgeClass(rarityTier: string): string {
  switch (rarityTier) {
    case 'Common':
      return 'bg-gray-600 text-white';
    case 'Uncommon':
      return 'bg-green-600 text-white';
    case 'Rare':
      return 'bg-blue-600 text-white';
    case 'Epic':
      return 'bg-purple-600 text-white';
    case 'Legendary':
      return 'bg-yellow-600 text-black';
    case 'Ultra Rare':
      return 'bg-red-600 text-white';
    default:
      return 'bg-gray-600 text-white';
  }
}

/**
 * Create a Farcaster share message for an elemental
 */
export function createElementalShareMessage(tokenId: number | null): string {
  if (tokenId === null) return '';
  
  const elementalName = getElementalName(tokenId);
  const rarityTier = getRarityTier(tokenId);
  
  return `Check out my ${rarityTier} ${elementalName} #${tokenId} in Elementals Adventure on @monad! #ElementalsNFT\n\nHatch your own at: https://elementals.monad.xyz`;
} 