const { ethers } = require('ethers');
require('dotenv').config();

async function debugTransaction() {
  try {
    // Failed transaction hash
    const TX_HASH = '0x501aece6ff8f2603e52e4c480ffea9464f47d7602839c51ad69960469abe9845';
    
    // Contract addresses
    const NFT_CONTRACT = "0x8549FaF1d5553dB17C9c6154141e5357758006cC";
    const HATCHER_CONTRACT = "0xDb6e6Cb60FDbFD685F8c16E8AE7EBdfdfE32f0f6";
    const TREASURY_ADDRESS = "0x20ce27B140A0EEECceF880e01D2082558400FDd6";
    
    console.log("Connecting to Monad Testnet...");
    // Connect to Monad Testnet
    const provider = new ethers.JsonRpcProvider("https://testnet-rpc.monad.xyz/");
    
    // Get private key for diagnostics
    const PRIVATE_KEY = process.env.PRIVATE_KEY;
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    console.log(`Connected with wallet: ${wallet.address}`);
    
    // Check approval status
    const nftAbi = [
      "function balanceOf(address owner) view returns (uint256)",
      "function isApprovedForAll(address owner, address operator) view returns (bool)"
    ];
    
    const nftContract = new ethers.Contract(NFT_CONTRACT, nftAbi, wallet);
    const isApproved = await nftContract.isApprovedForAll(TREASURY_ADDRESS, HATCHER_CONTRACT);
    
    console.log(`NFT Contract: ${NFT_CONTRACT}`);
    console.log(`Hatcher Contract: ${HATCHER_CONTRACT}`);
    console.log(`Treasury Address: ${TREASURY_ADDRESS}`);
    console.log(`Approval Status: ${isApproved ? 'Approved ✅' : 'Not Approved ❌'}`);
    
    // Get NFT balance
    const treasuryBalance = await nftContract.balanceOf(TREASURY_ADDRESS);
    console.log(`Treasury NFT Balance: ${treasuryBalance.toString()}`);
    
    // Get transaction details
    console.log(`\nFetching details for transaction: ${TX_HASH}`);
    const tx = await provider.getTransaction(TX_HASH);
    if (!tx) {
      console.log('Transaction not found');
      return;
    }
    
    console.log(`From: ${tx.from}`);
    console.log(`To: ${tx.to}`);
    console.log(`Value: ${ethers.formatEther(tx.value)} MONAD`);
    console.log(`Gas Limit: ${tx.gasLimit.toString()}`);
    
    // Get transaction receipt
    const receipt = await provider.getTransactionReceipt(TX_HASH);
    if (!receipt) {
      console.log('Receipt not found');
      return;
    }
    
    console.log(`\nTransaction Receipt:`);
    console.log(`Status: ${receipt.status === 0 ? 'Failed ❌' : 'Success ✅'}`);
    console.log(`Gas Used: ${receipt.gasUsed.toString()}`);
    console.log(`Block Number: ${receipt.blockNumber}`);
    
    if (receipt.status === 0) {
      console.log('\nPossible Reasons for Failure:');
      
      if (!isApproved) {
        console.log('1. Treasury has not approved the Hatcher contract to transfer NFTs');
      } else {
        console.log('1. Treasury has approved the Hatcher contract ✅');
      }
      
      if (treasuryBalance.toString() === '0') {
        console.log('2. Treasury has no NFTs to transfer');
      } else {
        console.log(`2. Treasury has ${treasuryBalance.toString()} NFTs available ✅`);
      }
      
      if (tx.to.toLowerCase() !== HATCHER_CONTRACT.toLowerCase()) {
        console.log(`3. Transaction was sent to wrong address (${tx.to} instead of ${HATCHER_CONTRACT})`);
      } else {
        console.log('3. Transaction was sent to correct contract address ✅');
      }
      
      if (tx.value < ethers.parseEther('0.1')) {
        console.log(`4. Incorrect payment amount (${ethers.formatEther(tx.value)} MONAD instead of 0.1 MONAD)`);
      } else {
        console.log('4. Correct payment amount ✅');
      }
      
      console.log('\nOther possible issues:');
      console.log('- The random token selection algorithm might be failing');
      console.log('- The token might have already been claimed');
      console.log('- There might be a bug in the contract code');
      
      console.log('\nRecommended Actions:');
      console.log('1. Try to claim a different token by sending another transaction');
      console.log('2. Check if the token selection algorithm in the contract is working correctly');
      console.log('3. Try with a higher gas limit (5,000,000 or more)');
    }
    
  } catch (error) {
    console.error('Error during debugging:');
    console.error(error.message || error);
  }
}

// Execute the function
debugTransaction(); 