// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title ElementalHatcherRandom
 * @dev Gas-efficient contract with improved randomness for hatching Elemental Adventurers
 * Users pay 0.1 MONAD and immediately receive a random NFT
 */
contract ElementalHatcherRandom is Ownable, ReentrancyGuard {
    // Constants
    uint256 public constant MAX_SUPPLY = 10000; // Total NFTs (0-9999)
    uint256 public constant HATCH_PRICE = 0.1 ether; // Cost to hatch an adventurer
    
    // State variables
    address public immutable nftContract; // The NFT contract address
    address public immutable treasury; // Treasury wallet that receives the payments
    uint256 public claimedCount; // Number of claimed NFTs
    mapping(uint256 => bool) public claimedTokenIds; // Tracks which token IDs have been claimed
    
    // Still track last claimed for efficiency in some cases
    uint256 private lastClaimedTokenId;
    
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
     * Uses a balanced algorithm to select a random unclaimed token ID
     */
    function claimAdventurer() external payable nonReentrant {
        require(msg.value == HATCH_PRICE, "Incorrect payment amount");
        require(claimedCount < MAX_SUPPLY, "All adventurers have been claimed");
        
        // Find an unclaimed token ID using the improved random approach
        uint256 tokenId = _findUnclaimedTokenIdWithRandomness();
        
        // Mark token as claimed
        claimedTokenIds[tokenId] = true;
        claimedCount++;
        
        // Transfer the NFT from the treasury to the caller
        IERC721(nftContract).transferFrom(treasury, msg.sender, tokenId);
        
        // Forward the payment to the treasury
        (bool success, ) = treasury.call{value: msg.value}("");
        require(success, "Payment forwarding failed");
        
        // Emit event
        emit AdventurerClaimed(msg.sender, tokenId);
    }
    
    /**
     * @dev Find an unclaimed token ID with improved randomness
     * @return tokenId The unclaimed token ID
     */
    function _findUnclaimedTokenIdWithRandomness() private returns (uint256) {
        // Generate a pseudo-random starting point using a mix of factors
        uint256 randomStart = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            block.prevrandao,
            msg.sender,
            lastClaimedTokenId,
            claimedCount
        ))) % MAX_SUPPLY;
        
        // Start search from this random point
        uint256 tokenId = randomStart;
        
        // Search for an unclaimed token
        do {
            if (!claimedTokenIds[tokenId]) {
                lastClaimedTokenId = tokenId;
                return tokenId;
            }
            tokenId = (tokenId + 1) % MAX_SUPPLY;
        } while (tokenId != randomStart);
        
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
    
    /**
     * @dev Set a specific token ID as claimed (admin function)
     * This can be used to handle edge cases or fix issues
     */
    function setTokenClaimed(uint256 tokenId) external onlyOwner {
        require(tokenId < MAX_SUPPLY, "Invalid token ID");
        require(!claimedTokenIds[tokenId], "Token already claimed");
        
        claimedTokenIds[tokenId] = true;
        claimedCount++;
    }
} 