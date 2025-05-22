// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title ElementalHatcherTest
 * @dev Modified version of ElementalHatcher for testing with deterministic token selection
 */
contract ElementalHatcherTest is Ownable, ReentrancyGuard {
    // Constants
    uint256 public constant MAX_SUPPLY = 10000; // Total NFTs (0-9999)
    uint256 public constant HATCH_PRICE = 0.1 ether; // Cost to hatch an adventurer
    
    // State variables
    address public nftContract; // The NFT contract address
    address public immutable treasury; // Treasury wallet that holds the NFTs
    uint256 public claimedCount; // Number of claimed NFTs
    mapping(uint256 => bool) public claimedTokenIds; // Tracks which token IDs have been claimed
    
    // Test-specific variables
    uint256 private nextTokenId; // For deterministic testing
    
    // Events
    event AdventurerClaimed(address indexed user, uint256 indexed tokenId);
    
    /**
     * @dev Constructor sets the owner and treasury addresses
     * @param _owner Address of the contract owner
     * @param _treasury Address of the treasury wallet holding the NFTs
     */
    constructor(address _owner, address _treasury) Ownable(_owner) {
        require(_treasury != address(0), "Invalid treasury address");
        treasury = _treasury;
    }
    
    /**
     * @dev Set the NFT contract address for testing
     * @param _nftContract Address of the NFT contract
     */
    function setNftContract(address _nftContract) external onlyOwner {
        require(_nftContract != address(0), "Invalid NFT contract address");
        nftContract = _nftContract;
    }
    
    /**
     * @dev Set the next token ID for deterministic testing
     * @param _tokenId The token ID to be claimed next
     */
    function setNextTokenId(uint256 _tokenId) external onlyOwner {
        nextTokenId = _tokenId;
    }
    
    /**
     * @dev Claim an adventurer by paying HATCH_PRICE
     * Uses the predetermined token ID for testing
     */
    function claimAdventurer() external payable nonReentrant {
        require(msg.value == HATCH_PRICE, "Incorrect payment amount");
        require(claimedCount < MAX_SUPPLY, "All adventurers have been claimed");
        
        // Use the predetermined token ID
        uint256 tokenId = nextTokenId;
        
        // Mark token as claimed
        claimedTokenIds[tokenId] = true;
        claimedCount++;
        
        // Transfer the NFT from treasury to the caller
        IERC721(nftContract).transferFrom(treasury, msg.sender, tokenId);
        
        // Emit event
        emit AdventurerClaimed(msg.sender, tokenId);
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