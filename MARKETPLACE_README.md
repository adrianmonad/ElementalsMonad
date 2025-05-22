# Elementals Escrow-Based NFT Marketplace

This document explains how the escrow-based NFT marketplace for Elementals Adventure works.

## Overview

The marketplace uses an escrow-based model where NFTs are held in a secure escrow wallet until sold. This approach provides several benefits:

1. **Security**: NFTs are held in a trusted escrow wallet
2. **Simplicity**: No need for complex on-chain approval management
3. **Reliability**: Listings are guaranteed to be available when shown in the UI

## How It Works

### Listing Process

1. **User selects an NFT to list** and specifies a price
2. **User approves the marketplace contract** to transfer their NFT
3. **User transfers the NFT to the escrow wallet** by calling the `onERC721Received` function
4. **Listing information is stored** in our backend database
5. **Monitoring service detects the NFT** in the escrow wallet and marks the listing as active

### Purchase Process

1. **Buyer selects an NFT** to purchase
2. **Buyer sends payment** in MON tokens
3. **Backend detects the payment** and updates the listing status
4. **Admin transfers the NFT** from the escrow wallet to the buyer
5. **Admin sends payment** (minus marketplace fee) to the seller

### Cancellation Process

1. **Seller requests cancellation** of their listing
2. **Backend updates the listing status** to cancelled
3. **Admin returns the NFT** from the escrow wallet to the original seller

## Contract Structure

The `MarketplaceFinal.sol` contract serves as the escrow wallet with the following key functions:

- `onERC721Received`: Accepts NFTs into escrow
- `withdrawNFT`: Admin function to withdraw an NFT to a specific address
- `batchWithdrawNFT`: Admin function to withdraw multiple NFTs at once
- `holdsNFT`: Check if the contract holds a specific NFT
- `setFeePercentage`: Update the marketplace fee percentage
- `setTreasuryWallet`: Update the treasury wallet address

## Backend API

The backend provides several API endpoints:

- `/api/createListing`: Create a new listing
- `/api/updateListing`: Update an existing listing
- `/api/getListings`: Get all active listings
- `/api/monitorEscrow`: Check for NFTs in the escrow wallet and update listings

## Security Considerations

- The escrow wallet is controlled by a secure admin account
- Marketplace fees are sent to a designated treasury wallet
- The contract includes reentrancy protection
- Only the contract owner can withdraw NFTs or ETH

## Deployment

To deploy the marketplace:

1. Run `npx hardhat run scripts/deploy-marketplace-final.js --network monadTestnet`
2. Update the `MARKETPLACE_CONTRACT_ADDRESS` in `config.ts` with the new contract address
3. Restart the application

## Monitoring

The escrow wallet should be monitored regularly to:

1. Detect new NFTs and activate their listings
2. Process purchases by transferring NFTs to buyers
3. Handle cancellations by returning NFTs to sellers 