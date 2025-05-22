const { ethers } = require('ethers');
require('dotenv').config();

async function approveHatcherContract() {
  try {
    // Use the same private key that was used for deployment
    const PRIVATE_KEY = process.env.PRIVATE_KEY;
    
    if (!PRIVATE_KEY || PRIVATE_KEY === "0000000000000000000000000000000000000000000000000000000000000000") {
      console.error("ERROR: Please set a valid PRIVATE_KEY in the .env file");
      process.exit(1);
    }
    
    // Contract addresses
    const NFT_CONTRACT = "0x8549FaF1d5553dB17C9c6154141e5357758006cC";
    const HATCHER_CONTRACT = "0x13712F7026faDb5299d3b04f687244EC1bc9252c"; // New random hatcher contract
    const TREASURY_ADDRESS = "0x20ce27B140A0EEECceF880e01D2082558400FDd6";
    
    console.log("Connecting to Monad Testnet...");
    // Connect to Monad Testnet
    const provider = new ethers.JsonRpcProvider("https://testnet-rpc.monad.xyz/");
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    
    console.log(`Your wallet address: ${wallet.address}`);
    console.log(`Treasury address: ${TREASURY_ADDRESS}`);
    
    // Check if the wallet is the treasury
    const isTreasury = (wallet.address.toLowerCase() === TREASURY_ADDRESS.toLowerCase());
    
    if (!isTreasury) {
      console.warn("WARNING: Your wallet address doesn't match the treasury address!");
      console.warn("The approval must come from the treasury wallet.");
      console.log("Do you want to continue anyway? (This will likely fail) (y/n)");
      
      // In a real script, you would add user input handling here
      // For this example, we'll just pause for 5 seconds to give time to abort
      console.log("Waiting 5 seconds before continuing... (Ctrl+C to abort)");
      await new Promise(resolve => setTimeout(resolve, 5000));
    } else {
      console.log("✅ Your wallet matches the treasury address. Good to proceed!");
    }
    
    // ERC721 interface for approval
    const nftAbi = [
      "function setApprovalForAll(address operator, bool approved) external",
      "function isApprovedForAll(address owner, address operator) view returns (bool)"
    ];
    
    const nftContract = new ethers.Contract(NFT_CONTRACT, nftAbi, wallet);
    
    // Check if already approved
    const isApproved = await nftContract.isApprovedForAll(wallet.address, HATCHER_CONTRACT);
    if (isApproved) {
      console.log("✅ The hatcher contract is already approved to transfer NFTs from the treasury!");
      return;
    }
    
    console.log("Approving hatcher contract to transfer NFTs...");
    console.log(`NFT Contract: ${NFT_CONTRACT}`);
    console.log(`Hatcher Contract: ${HATCHER_CONTRACT}`);
    
    const tx = await nftContract.setApprovalForAll(HATCHER_CONTRACT, true);
    console.log(`Transaction submitted! Hash: ${tx.hash}`);
    console.log("Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
    console.log("✅ Approval successful! The hatcher contract can now transfer NFTs from the treasury.");
    
    // Verify approval
    const approvedAfter = await nftContract.isApprovedForAll(wallet.address, HATCHER_CONTRACT);
    console.log(`Final approval status: ${approvedAfter ? "Approved ✅" : "Not Approved ❌"}`);
    
  } catch (error) {
    console.error("Error during approval process:");
    console.error(error.message || error);
    process.exit(1);
  }
}

// Execute the function
approveHatcherContract(); 