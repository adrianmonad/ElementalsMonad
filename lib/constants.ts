export const MESSAGE_EXPIRATION_TIME = 1000 * 60 * 60 * 24 * 30; // 30 day
export const APP_URL = process.env.NEXT_PUBLIC_URL || "https://rb-sectors-distributed-arrangement.trycloudflare.com";

// Global constants

// Chain IDs
export const MONAD_TESTNET_ID = 10143;

// Rarity base times (in seconds)
export const RARITY_BASE_TIMES = {
  common: 10,     // Common: 10 seconds per elemental
  uncommon: 20,   // Uncommon: 20 seconds per elemental
  epic: 40,       // Epic: 40 seconds per elemental
  legendary: 60,  // Legendary: 60 seconds per elemental
  ultraRare: 120  // Ultra Rare: 120 seconds per elemental
};

// Rarity cooldown times (in milliseconds)
export const RARITY_COOLDOWNS = {
  common: 14400000,     // 4 hours (4 * 60 * 60 * 1000)
  uncommon: 14400000,   // 4 hours
  epic: 14400000,       // 4 hours
  legendary: 14400000,  // 4 hours
  ultraRare: 14400000   // 4 hours
};
