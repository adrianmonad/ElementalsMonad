/**
 * Escrow Wallet Monitor Script
 * 
 * This script periodically checks the escrow wallet for NFTs and updates listings.
 * It can be run as a cron job or a background process.
 */

const fetch = require('node-fetch');
// Fix the import path to use relative path from project root
const config = require('../config');
const ESCROW_WALLET_ADDRESS = config.ESCROW_WALLET_ADDRESS;

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const MONITOR_INTERVAL = process.env.MONITOR_INTERVAL || 60000; // 1 minute by default

/**
 * Monitor the escrow wallet
 */
async function monitorEscrow() {
  try {
    console.log(`[${new Date().toISOString()}] Checking escrow wallet: ${ESCROW_WALLET_ADDRESS}`);
    
    // Call the monitorEscrow API
    const response = await fetch(`${API_BASE_URL}/api/monitorEscrow`);
    
    if (!response.ok) {
      throw new Error(`Failed to monitor escrow: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log(`[${new Date().toISOString()}] Found ${data.escrowTokenCount} tokens in escrow`);
    console.log(`[${new Date().toISOString()}] Updated ${data.updatedListings} listings`);
    
    return data;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error monitoring escrow:`, error);
    return null;
  }
}

/**
 * Main function to run the monitor
 */
async function main() {
  console.log(`[${new Date().toISOString()}] Starting escrow monitor`);
  console.log(`[${new Date().toISOString()}] API Base URL: ${API_BASE_URL}`);
  console.log(`[${new Date().toISOString()}] Monitor interval: ${MONITOR_INTERVAL}ms`);
  
  // Run the monitor immediately
  await monitorEscrow();
  
  // Set up interval to run the monitor periodically
  setInterval(async () => {
    await monitorEscrow();
  }, parseInt(MONITOR_INTERVAL));
}

// Start the monitor if this script is run directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { monitorEscrow }; 