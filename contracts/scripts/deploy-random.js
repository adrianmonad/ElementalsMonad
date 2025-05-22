// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");

async function main() {
  // NFT contract address on Monad Testnet
  const NFT_CONTRACT_ADDRESS = "0x8549FaF1d5553dB17C9c6154141e5357758006cC";
  // Treasury wallet address that holds the NFTs and receives payments
  const TREASURY_ADDRESS = "0x20ce27B140A0EEECceF880e01D2082558400FDd6";

  console.log("Deploying ElementalHatcherRandom contract...");
  console.log(`NFT Contract: ${NFT_CONTRACT_ADDRESS}`);
  console.log(`Treasury: ${TREASURY_ADDRESS}`);

  // Deploy the ElementalHatcherRandom contract
  const ElementalHatcherRandom = await hre.ethers.getContractFactory("ElementalHatcherRandom");
  const hatcher = await ElementalHatcherRandom.deploy(NFT_CONTRACT_ADDRESS, TREASURY_ADDRESS);

  await hatcher.waitForDeployment();

  const hatcherAddress = await hatcher.getAddress();
  console.log(`ElementalHatcherRandom deployed to: ${hatcherAddress}`);
  console.log("");
  console.log("Next steps:");
  console.log(`1. Ensure the treasury wallet (${TREASURY_ADDRESS}) has approved the hatcher contract (${hatcherAddress}) to transfer NFTs`);
  console.log(`2. Update your frontend to use the new contract address: ${hatcherAddress}`);
  console.log(`3. Keep the high gas limit (5,000,000) for reliable transactions`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 