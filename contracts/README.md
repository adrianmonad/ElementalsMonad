# Elementals Hatcher Contract

This contract implements the Elementals Hatching Mechanic for the Elementals Adventure game on Monad Testnet.

## Contract Features

- Users pay 0.1 MON to hatch an Elemental Adventurer NFT
- Contract randomly selects an unclaimed NFT token ID from 0-9999
- NFT is transferred from a treasury wallet to the user
- Emits an event `AdventurerClaimed(address user, uint256 tokenId)`
- Prevents claiming if all NFTs are already claimed

## Technical Details

- NFT Contract: `0x8549FaF1d5553dB17C9c6154141e5357758006cC`
- Treasury Wallet: `0x20ce27B140A0EEECceF880e01D2082558400FDd6`
- Chain: Monad Testnet (Chain ID: 10143)
- RPC URL: `https://testnet-rpc.monad.xyz/`

## Deployment Instructions

1. Install dependencies:
   ```
   npm install
   ```

2. Create a `.env` file with your private key:
   ```
   PRIVATE_KEY=your_private_key_here
   ```

3. Compile the contract:
   ```
   npm run compile
   ```

4. Deploy to Monad Testnet:
   ```
   npm run deploy:testnet
   ```

5. After deployment, ensure the treasury wallet approves the contract to transfer NFTs:
   ```solidity
   // Call this function on the NFT contract from the treasury wallet
   function setApprovalForAll(address operator, bool approved) public;
   ```

## Integration with Frontend

Update your frontend to use the deployed contract address and ABI. The contract exposes the following functions:

- `claimAdventurer()` - Payable function that requires 0.1 MON
- `getClaimedTokenCount()` - Returns the number of claimed tokens
- `getAvailableTokenCount()` - Returns the number of available tokens

## Contract Architecture

- Uses OpenZeppelin's `Ownable` for owner-only functions
- Uses OpenZeppelin's `ReentrancyGuard` to prevent reentrancy attacks
- Implements a pseudo-random algorithm to select unclaimed token IDs
- Tracks claimed tokens using a mapping 