// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");

async function main() {
  // Treasury wallet address that will receive marketplace fees
  const TREASURY_ADDRESS = "0x20ce27B140A0EEECceF880e01D2082558400FDd6";

  console.log("Deploying ElementalsMarketplace contract...");
  console.log(`Treasury Address: ${TREASURY_ADDRESS}`);

  // Deploy the ElementalsMarketplace contract
  const ElementalsMarketplace = await hre.ethers.getContractFactory("ElementalsMarketplace");
  const marketplace = await ElementalsMarketplace.deploy(TREASURY_ADDRESS);

  await marketplace.waitForDeployment();

  const marketplaceAddress = await marketplace.getAddress();
  console.log(`ElementalsMarketplace deployed to: ${marketplaceAddress}`);
  console.log("");
  console.log("Next steps:");
  console.log(`1. Update your frontend config.ts to use the new marketplace contract address: ${marketplaceAddress}`);
  console.log(`2. Ensure NFT owners approve the marketplace contract (${marketplaceAddress}) to transfer their NFTs`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 