const { ethers } = require('ethers');
require('dotenv').config();

async function checkApproval() {
  try {
    const PRIVATE_KEY = process.env.PRIVATE_KEY;
    const NFT_CONTRACT = '0x8549FaF1d5553dB17C9c6154141e5357758006cC';
    const HATCHER_CONTRACT = '0x1beB1252E17e62772870a53434693da516CDf767';
    const TREASURY_ADDRESS = '0x20ce27B140A0EEECceF880e01D2082558400FDd6';
    
    const provider = new ethers.JsonRpcProvider('https://testnet-rpc.monad.xyz/');
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    
    const nftAbi = [
      'function balanceOf(address owner) view returns (uint256)',
      'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
      'function isApprovedForAll(address owner, address operator) view returns (bool)'
    ];
    
    const nftContract = new ethers.Contract(NFT_CONTRACT, nftAbi, wallet);
    
    // Check approval status
    const isApproved = await nftContract.isApprovedForAll(TREASURY_ADDRESS, HATCHER_CONTRACT);
    console.log(`Approval status: ${isApproved ? 'Approved ✅' : 'Not Approved ❌'}`);
    
    // Check NFT balance
    try {
      const balance = await nftContract.balanceOf(TREASURY_ADDRESS);
      console.log(`Treasury NFT balance: ${balance.toString()}`);
      
      if (balance > 0) {
        const tokenId = await nftContract.tokenOfOwnerByIndex(TREASURY_ADDRESS, 0);
        console.log(`Sample token ID owned by treasury: ${tokenId.toString()}`);
      }
    } catch (error) {
      console.log('Error checking NFT balance:', error.message);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkApproval(); 