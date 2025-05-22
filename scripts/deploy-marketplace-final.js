const hre = require("hardhat");

async function main() {
  // Get the contract factory
  const MarketplaceFinal = await hre.ethers.getContractFactory("MarketplaceFinal");

  console.log("Deploying MarketplaceFinal...");

  // Treasury wallet address to receive marketplace fees
  const TREASURY_ADDRESS = "0xd24008bf6BFe920A83a824Fd1755Ae1625611266";
  console.log(`Treasury Address: ${TREASURY_ADDRESS}`);

  // Deploy the contract with the treasury address
  const marketplace = await MarketplaceFinal.deploy(TREASURY_ADDRESS);
  await marketplace.waitForDeployment();

  const marketplaceAddress = await marketplace.getAddress();
  console.log(`MarketplaceFinal deployed to: ${marketplaceAddress}`);

  // Wait for 5 block confirmations
  console.log("Waiting for 5 confirmations...");
  await marketplace.deploymentTransaction().wait(5);
  console.log("Confirmed!");

  // Verify the contract on the block explorer
  console.log("Verifying contract on block explorer...");
  try {
    await hre.run("verify:verify", {
      address: marketplaceAddress,
      constructorArguments: [TREASURY_ADDRESS],
    });
    console.log("Contract verified successfully");
  } catch (error) {
    console.error("Error verifying contract:", error);
  }
}

// Execute the deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 