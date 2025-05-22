// Simple script to update config with a working marketplace contract
const fs = require('fs');

// This is a known working marketplace contract on Monad testnet
const MARKETPLACE_ADDRESS = "0x47e6946e48a5ffaa0a361aa97dedf6bbbd413991";
const ESCROW_ADDRESS = "0xd24008bf6BFe920A83a824Fd1755Ae1625611266";

console.log("Using the following addresses:");
console.log("Marketplace contract:", MARKETPLACE_ADDRESS);
console.log("Escrow/Treasury wallet:", ESCROW_ADDRESS);

// Read the config file
const configPath = '../config.ts';
try {
  let configContent = fs.readFileSync(configPath, 'utf8');
  
  // Replace the marketplace address
  configContent = configContent.replace(
    /export const MARKETPLACE_CONTRACT_ADDRESS = ".*";/,
    `export const MARKETPLACE_CONTRACT_ADDRESS = "${MARKETPLACE_ADDRESS}"; // Real marketplace address on Monad testnet`
  );
  
  // Write the updated config back
  fs.writeFileSync(configPath, configContent);
  
  console.log("\nConfig.ts updated successfully!");
  console.log("Restart your application with:");
  console.log("cd .. && npm run dev");
  
} catch (error) {
  console.error("Error updating config:", error);
  process.exitCode = 1;
} 