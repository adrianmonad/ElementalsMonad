// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title ElementalHatcherAuto
 * @dev Contract for automatically hatching Elemental Adventurers when payment is received
 * Users pay 0.1 MONAD and immediately receive a random NFT
 */
contract ElementalHatcherAuto is Ownable, ReentrancyGuard {
    // Constants
    uint256 public constant MAX_SUPPLY = 10000; // Total NFTs (0-9999)
    uint256 public constant HATCH_PRICE = 0.1 ether; // Cost to hatch an adventurer
    
    // State variables
    address public immutable nftContract; // The NFT contract address (0x8549FaF1d5553dB17C9c6154141e5357758006cC)
    address public immutable treasury; // Treasury wallet that receives the payments
    uint256 public claimedCount; // Number of claimed NFTs
    mapping(uint256 => bool) public claimedTokenIds; // Tracks which token IDs have been claimed
    
    // Events
    event AdventurerClaimed(address indexed user, uint256 indexed tokenId);
    
    /**
     * @dev Constructor sets the NFT contract and treasury addresses
     * @param _nftContract Address of the NFT contract
     * @param _treasury Address of the treasury wallet receiving payments
     */
    constructor(address _nftContract, address _treasury) Ownable(msg.sender) {
        require(_nftContract != address(0), "Invalid NFT contract address");
        require(_treasury != address(0), "Invalid treasury address");
        
        nftContract = _nftContract;
        treasury = _treasury;
    }
    
    /**
     * @dev Claim an adventurer by paying HATCH_PRICE
     * Randomly selects an unclaimed NFT and transfers it from treasury to caller
     */
    function claimAdventurer() external payable nonReentrant {
        require(msg.value == HATCH_PRICE, "Incorrect payment amount");
        require(claimedCount < MAX_SUPPLY, "All adventurers have been claimed");
        
        // Find an unclaimed token ID using a pseudo-random approach
        uint256 tokenId = _findUnclaimedTokenId();
        
        // Mark token as claimed
        claimedTokenIds[tokenId] = true;
        claimedCount++;
        
        // Transfer the NFT from the NFT contract to the caller
        IERC721(nftContract).transferFrom(treasury, msg.sender, tokenId);
        
        // Forward the payment to the treasury
        (bool success, ) = treasury.call{value: msg.value}("");
        require(success, "Payment forwarding failed");
        
        // Emit event
        emit AdventurerClaimed(msg.sender, tokenId);
    }
    
    /**
     * @dev Find an unclaimed token ID using a pseudo-random approach
     * @return tokenId The unclaimed token ID
     */
    function _findUnclaimedTokenId() private view returns (uint256) {
        // Generate a pseudo-random starting point
        uint256 randomSeed = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            msg.sender,
            claimedCount
        ))) % MAX_SUPPLY;
        
        // Linear search for an unclaimed token ID
        for (uint256 i = 0; i < MAX_SUPPLY; i++) {
            uint256 tokenId = (randomSeed + i) % MAX_SUPPLY;
            if (!claimedTokenIds[tokenId]) {
                return tokenId;
            }
        }
        
        // This should never be reached due to the check in claimAdventurer
        revert("No unclaimed tokens available");
    }
    
    /**
     * @dev Get the number of claimed tokens
     * @return The number of claimed tokens
     */
    function getClaimedTokenCount() external view returns (uint256) {
        return claimedCount;
    }
    
    /**
     * @dev Get the number of available tokens
     * @return The number of available tokens
     */
    function getAvailableTokenCount() external view returns (uint256) {
        return MAX_SUPPLY - claimedCount;
    }
    
    /**
     * @dev Fallback function to handle direct ETH transfers
     * This allows users to send ETH directly to the contract address
     */
    receive() external payable {
        // If someone sends exactly HATCH_PRICE, treat it as a claim request
        if (msg.value == HATCH_PRICE) {
            // Forward to claimAdventurer (will revert if any issues)
            this.claimAdventurer{value: msg.value}();
        } else {
            // For any other amount, just forward to treasury
            (bool success, ) = treasury.call{value: msg.value}("");
            require(success, "Payment forwarding failed");
        }
    }
} 