// Simple script to deploy just the marketplace contract
const { ethers } = require("ethers");
require("dotenv").config();
require("dotenv").config({ path: '.env.escrow' });

async function main() {
  // Treasury wallet address from .env.escrow
  const ESCROW_ADDRESS = process.env.ESCROW_ADDRESS || "0xd24008bf6BFe920A83a824Fd1755Ae1625611266";
  
  console.log("Using escrow address:", ESCROW_ADDRESS);
  
  // Connect to Monad testnet
  const provider = new ethers.JsonRpcProvider("https://rpc.testnet.monad.xyz/monad");
  const privateKey = process.env.PRIVATE_KEY;
  
  if (!privateKey) {
    console.error("No private key found in .env file!");
    process.exit(1);
  }
  
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log("Deploying from address:", wallet.address);
  
  // Get the marketplace contract source code
  const fs = require("fs");
  const marketplaceSource = fs.readFileSync("./ElementalsMarketplace.sol", "utf8");
  
  // Compile the contract
  const solc = require("solc");
  
  const input = {
    language: "Solidity",
    sources: {
      "ElementalsMarketplace.sol": {
        content: marketplaceSource
      }
    },
    settings: {
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode"]
        }
      }
    }
  };
  
  console.log("Compiling contract...");
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  
  // Deploy the contract
  const abi = output.contracts["ElementalsMarketplace.sol"]["ElementalsMarketplace"].abi;
  const bytecode = output.contracts["ElementalsMarketplace.sol"]["ElementalsMarketplace"].evm.bytecode.object;
  
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  
  console.log("Deploying contract...");
  const contract = await factory.deploy(ESCROW_ADDRESS);
  await contract.deploymentTransaction().wait();
  
  console.log("Contract deployed to:", contract.address);
  console.log("Update your config.ts with this address");
  
  return contract.address;
}

main()
  .then((address) => console.log("Deployment successful! Address:", address))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exitCode = 1;
  }); 