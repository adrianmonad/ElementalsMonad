# Treasury Approval Instructions

This document provides instructions for the treasury wallet owner to approve the ElementalHatcher contract to transfer NFTs.

## Important Addresses

- **NFT Contract**: `0x8549FaF1d5553dB17C9c6154141e5357758006cC`
- **Treasury Wallet**: `0x20ce27B140A0EEECceF880e01D2082558400FDd6`
- **Hatcher Contract**: `0xe02365336C43B3D1C65E56a07fbEE93BAe3BBADe`

## Using the Approval Script

1. Make sure you have Node.js installed on your computer.

2. Create a `.env` file in the `contracts` directory with the following content:
   ```
   # Treasury wallet's private key (without 0x prefix)
   # This should be the private key of: 0x20ce27B140A0EEECceF880e01D2082558400FDd6
   TREASURY_PRIVATE_KEY=your_treasury_private_key_here
   ```

3. Replace `your_treasury_private_key_here` with the actual private key of the treasury wallet.

4. Install the required dependencies:
   ```
   npm install
   ```

5. Run the approval script:
   ```
   node scripts/approve.js
   ```

6. The script will:
   - Verify that you're using the correct treasury wallet
   - Check if approval is already granted
   - Submit the approval transaction
   - Wait for confirmation
   - Verify that the approval was successful

## Manual Approval (Alternative)

If you prefer to manually approve the contract:

1. Connect your treasury wallet to a dApp interface like [Monad Explorer](https://testnet.monadexplorer.com/)
2. Navigate to the NFT contract (`0x8549FaF1d5553dB17C9c6154141e5357758006cC`)
3. Find the "Write Contract" section
4. Look for the `setApprovalForAll` function
5. Enter these parameters:
   - `operator`: `0xe02365336C43B3D1C65E56a07fbEE93BAe3BBADe` (the hatcher contract)
   - `approved`: `true`
6. Submit the transaction

## Verification

To verify that the approval was successful:

1. Navigate to the NFT contract on [Monad Explorer](https://testnet.monadexplorer.com/)
2. Find the "Read Contract" section
3. Look for the `isApprovedForAll` function
4. Enter these parameters:
   - `owner`: `0x20ce27B140A0EEECceF880e01D2082558400FDd6` (the treasury wallet)
   - `operator`: `0xe02365336C43B3D1C65E56a07fbEE93BAe3BBADe` (the hatcher contract)
5. The function should return `true` if the approval was successful

## Security Note

Keep your private key secure and never share it with anyone. The approval script is designed to be run locally on your own machine. 