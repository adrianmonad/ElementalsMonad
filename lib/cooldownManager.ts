// Cooldown manager for battle system
import { RARITY_COOLDOWNS, RARITY_BASE_TIMES } from './constants';

// Type definitions
export interface CooldownInfo {
  expiresAt: number; // Timestamp when cooldown expires
  startedAt: number; // Timestamp when cooldown started
}

export interface RarityCooldowns {
  common?: CooldownInfo;
  uncommon?: CooldownInfo;
  epic?: CooldownInfo;
  legendary?: CooldownInfo;
  ultraRare?: CooldownInfo;
}

export type RarityType = 'common' | 'uncommon' | 'epic' | 'legendary' | 'ultraRare';

// Normalized rarity names
export const normalizeRarity = (rarity: string): RarityType => {
  const normalized = rarity.toLowerCase().replace(/\s+/g, '');
  if (normalized === 'ultrarare') return 'ultraRare';
  return normalized as RarityType;
};

// Check if rarity is on cooldown
export const isOnCooldown = (rarity: string): boolean => {
  try {
    const normalizedRarity = normalizeRarity(rarity);
    const cooldowns = getCooldowns();
    const cooldownInfo = cooldowns[normalizedRarity];
    
    if (!cooldownInfo) return false;
    
    const now = Date.now();
    return now < cooldownInfo.expiresAt;
  } catch (error) {
    console.error('Error checking cooldown:', error);
    return false;
  }
};

// Get cooldown remaining time in seconds
export const getCooldownRemaining = (rarity: string): number => {
  try {
    const normalizedRarity = normalizeRarity(rarity);
    const cooldowns = getCooldowns();
    const cooldownInfo = cooldowns[normalizedRarity];
    
    if (!cooldownInfo) return 0;
    
    const now = Date.now();
    if (now >= cooldownInfo.expiresAt) return 0;
    
    return Math.ceil((cooldownInfo.expiresAt - now) / 1000);
  } catch (error) {
    console.error('Error getting cooldown remaining:', error);
    return 0;
  }
};

// Format seconds into hours, minutes, seconds
export const formatCooldownTime = (seconds: number): string => {
  if (seconds <= 0) return 'Ready';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
};

// Start cooldown for a rarity
export const startCooldown = (rarity: string): void => {
  try {
    const normalizedRarity = normalizeRarity(rarity);
    const cooldowns = getCooldowns();
    const now = Date.now();
    
    // Default cooldown is 4 hours (14400000 ms)
    const cooldownDuration = RARITY_COOLDOWNS[normalizedRarity] || 14400000;
    
    cooldowns[normalizedRarity] = {
      startedAt: now,
      expiresAt: now + cooldownDuration
    };
    
    setCooldowns(cooldowns);
  } catch (error) {
    console.error('Error starting cooldown:', error);
  }
};

// Calculate attack time based on rarity and count
export const calculateAttackTime = (rarity: string, count: number): number => {
  try {
    const normalizedRarity = normalizeRarity(rarity);
    // Get base time in seconds from constants
    const baseTime = RARITY_BASE_TIMES[normalizedRarity] || 10;
    
    // Multiply by count of NFTs owned
    return baseTime * Math.max(count, 1);
  } catch (error) {
    console.error('Error calculating attack time:', error);
    return 10; // Default to 10 seconds
  }
};

// Get all cooldowns from localStorage
export const getCooldowns = (): RarityCooldowns => {
  try {
    if (typeof window === 'undefined') return {};
    
    const cooldownsStr = localStorage.getItem('elementalsBattleCooldowns');
    if (!cooldownsStr) return {};
    
    return JSON.parse(cooldownsStr);
  } catch (error) {
    console.error('Error getting cooldowns from localStorage:', error);
    return {};
  }
};

// Save cooldowns to localStorage
export const setCooldowns = (cooldowns: RarityCooldowns): void => {
  try {
    if (typeof window === 'undefined') return;
    
    localStorage.setItem('elementalsBattleCooldowns', JSON.stringify(cooldowns));
  } catch (error) {
    console.error('Error saving cooldowns to localStorage:', error);
  }
};

// Reset all cooldowns - useful for testing
export const resetAllCooldowns = (): void => {
  try {
    if (typeof window === 'undefined') return;
    
    localStorage.removeItem('elementalsBattleCooldowns');
  } catch (error) {
    console.error('Error resetting cooldowns:', error);
  }
}; 