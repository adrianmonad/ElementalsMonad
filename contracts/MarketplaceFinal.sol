// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MarketplaceFinal
 * @dev A simple escrow-based NFT marketplace contract
 * NFTs are held in escrow until sold, with listing data stored off-chain
 */
contract MarketplaceFinal is Ownable, IERC721Receiver, ReentrancyGuard {
    // Fee percentage (250 = 2.5%)
    uint256 public feePercentage = 250;
    
    // Treasury wallet to receive fees
    address public treasuryWallet;
    
    // Events
    event NFTReceived(address indexed sender, address indexed nftContract, uint256 tokenId);
    event NFTWithdrawn(address indexed receiver, address indexed nftContract, uint256 tokenId);
    event FeePercentageUpdated(uint256 oldFeePercentage, uint256 newFeePercentage);
    event TreasuryWalletUpdated(address oldTreasuryWallet, address newTreasuryWallet);
    
    constructor(address _treasuryWallet) Ownable(msg.sender) {
        require(_treasuryWallet != address(0), "Treasury wallet cannot be zero address");
        treasuryWallet = _treasuryWallet;
    }
    
    /**
     * @dev Required function to receive ERC721 tokens
     */
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external override returns (bytes4) {
        // Get the NFT contract address
        address nftContract = msg.sender;
        
        // Emit event for tracking
        emit NFTReceived(from, nftContract, tokenId);
        
        // Return the function selector
        return this.onERC721Received.selector;
    }
    
    /**
     * @dev Withdraw an NFT from the escrow (admin only)
     * @param nftContract Address of the NFT contract
     * @param tokenId Token ID to withdraw
     * @param receiver Address to receive the NFT
     */
    function withdrawNFT(
        address nftContract,
        uint256 tokenId,
        address receiver
    ) external onlyOwner nonReentrant {
        require(receiver != address(0), "Cannot withdraw to zero address");
        
        // Transfer the NFT to the receiver
        IERC721(nftContract).safeTransferFrom(address(this), receiver, tokenId);
        
        // Emit event
        emit NFTWithdrawn(receiver, nftContract, tokenId);
    }
    
    /**
     * @dev Batch withdraw multiple NFTs (admin only)
     * @param nftContract Address of the NFT contract
     * @param tokenIds Array of token IDs to withdraw
     * @param receiver Address to receive the NFTs
     */
    function batchWithdrawNFT(
        address nftContract,
        uint256[] calldata tokenIds,
        address receiver
    ) external onlyOwner nonReentrant {
        require(receiver != address(0), "Cannot withdraw to zero address");
        
        // Transfer each NFT to the receiver
        for (uint256 i = 0; i < tokenIds.length; i++) {
            IERC721(nftContract).safeTransferFrom(address(this), receiver, tokenIds[i]);
            emit NFTWithdrawn(receiver, nftContract, tokenIds[i]);
        }
    }
    
    /**
     * @dev Update the fee percentage
     * @param _feePercentage New fee percentage (in basis points, e.g., 250 = 2.5%)
     */
    function setFeePercentage(uint256 _feePercentage) external onlyOwner {
        require(_feePercentage <= 1000, "Fee percentage cannot be more than 10%");
        uint256 oldFeePercentage = feePercentage;
        feePercentage = _feePercentage;
        emit FeePercentageUpdated(oldFeePercentage, _feePercentage);
    }
    
    /**
     * @dev Update the treasury wallet address
     * @param _treasuryWallet New treasury wallet address
     */
    function setTreasuryWallet(address _treasuryWallet) external onlyOwner {
        require(_treasuryWallet != address(0), "Treasury wallet cannot be zero address");
        address oldTreasuryWallet = treasuryWallet;
        treasuryWallet = _treasuryWallet;
        emit TreasuryWalletUpdated(oldTreasuryWallet, _treasuryWallet);
    }
    
    /**
     * @dev Check if the contract holds a specific NFT
     * @param nftContract Address of the NFT contract
     * @param tokenId Token ID to check
     * @return True if the contract holds the NFT, false otherwise
     */
    function holdsNFT(address nftContract, uint256 tokenId) external view returns (bool) {
        return IERC721(nftContract).ownerOf(tokenId) == address(this);
    }
    
    /**
     * @dev Withdraw ETH from the contract (admin only)
     * @param amount Amount to withdraw
     * @param recipient Address to receive the ETH
     */
    function withdrawETH(uint256 amount, address payable recipient) external onlyOwner nonReentrant {
        require(recipient != address(0), "Cannot withdraw to zero address");
        require(amount <= address(this).balance, "Insufficient balance");
        
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "ETH transfer failed");
    }
    
    /**
     * @dev Allow the contract to receive ETH
     */
    receive() external payable {}
} 