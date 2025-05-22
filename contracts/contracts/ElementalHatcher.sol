// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title ElementalHatcher
 * @dev Contract for hatching Elemental Adventurers by claiming NFTs from a treasury
 */
contract ElementalHatcher is Ownable, ReentrancyGuard {
    // Constants
    uint256 public constant MAX_SUPPLY = 10000; // Total NFTs (0-9999)
    uint256 public constant HATCH_PRICE = 0.1 ether; // Cost to hatch an adventurer
    
    // State variables
    address public immutable nftContract; // The NFT contract address
    address public immutable treasury; // Treasury wallet that holds the NFTs
    uint256 public claimedCount; // Number of claimed NFTs
    mapping(uint256 => bool) public claimedTokenIds; // Tracks which token IDs have been claimed
    
    // Events
    event AdventurerClaimed(address indexed user, uint256 indexed tokenId);
    
    /**
     * @dev Constructor sets the NFT contract and treasury addresses
     * @param _nftContract Address of the NFT contract
     * @param _treasury Address of the treasury wallet holding the NFTs
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
        
        // Transfer the NFT from treasury to the caller
        IERC721(nftContract).transferFrom(treasury, msg.sender, tokenId);
        
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
     * @dev Withdraw contract balance to owner
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");
        
        (bool success, ) = owner().call{value: balance}("");
        require(success, "Withdrawal failed");
    }
} 