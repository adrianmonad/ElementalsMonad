const { ethers } = require('ethers');
require('dotenv').config();

async function debugContract() {
  try {
    const PRIVATE_KEY = process.env.PRIVATE_KEY;
    const NFT_CONTRACT = '0x8549FaF1d5553dB17C9c6154141e5357758006cC';
    const HATCHER_CONTRACT = '0x1beB1252E17e62772870a53434693da516CDf767';
    const TREASURY_ADDRESS = '0x20ce27B140A0EEECceF880e01D2082558400FDd6';
    
    const provider = new ethers.JsonRpcProvider('https://testnet-rpc.monad.xyz/');
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    
    console.log(`Connected wallet: ${wallet.address}`);
    
    // Get contract ABI from artifacts
    const fs = require('fs');
    const path = require('path');
    
    // Read ElementalHatcher ABI
    const hatcherAbiPath = path.join(__dirname, '../../abi/ElementalHatcher.json');
    const hatcherAbi = JSON.parse(fs.readFileSync(hatcherAbiPath, 'utf8'));
    
    // Connect to the contract
    const hatcherContract = new ethers.Contract(HATCHER_CONTRACT, hatcherAbi, wallet);
    
    // Get contract state
    const claimedCount = await hatcherContract.getClaimedTokenCount();
    const availableCount = await hatcherContract.getAvailableTokenCount();
    const treasuryAddress = await hatcherContract.treasury();
    const nftContractAddress = await hatcherContract.nftContract();
    const hatchPrice = await hatcherContract.HATCH_PRICE();
    
    console.log('Contract State:');
    console.log(`- Claimed Count: ${claimedCount.toString()}`);
    console.log(`- Available Count: ${availableCount.toString()}`);
    console.log(`- Treasury Address: ${treasuryAddress}`);
    console.log(`- NFT Contract Address: ${nftContractAddress}`);
    console.log(`- Hatch Price: ${ethers.formatEther(hatchPrice)} MONAD`);
    
    // Check if treasury address matches
    if (treasuryAddress.toLowerCase() !== TREASURY_ADDRESS.toLowerCase()) {
      console.log('⚠️ WARNING: Treasury address in contract does not match expected address!');
    }
    
    // Check if NFT contract address matches
    if (nftContractAddress.toLowerCase() !== NFT_CONTRACT.toLowerCase()) {
      console.log('⚠️ WARNING: NFT contract address in contract does not match expected address!');
    }
    
    // Check contract balance
    const contractBalance = await provider.getBalance(HATCHER_CONTRACT);
    console.log(`Contract balance: ${ethers.formatEther(contractBalance)} MONAD`);
    
    console.log('\nDiagnosis:');
    console.log('1. The contract is configured to have users pay 0.1 MONAD to the contract');
    console.log('2. The contract then transfers an NFT from the treasury to the user');
    console.log('3. The treasury has approved the contract to transfer NFTs on its behalf');
    console.log('4. The treasury has 9995 NFTs available');
    
    if (claimedCount > 0) {
      console.log(`\nSome tokens (${claimedCount}) have already been claimed successfully.`);
    }
    
    console.log('\nPossible issues:');
    console.log('1. The NFT contract might not support tokenOfOwnerByIndex (ERC721Enumerable)');
    console.log('2. The transaction might be running out of gas');
    console.log('3. There might be a revert in the contract execution');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugContract(); 