// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title ElementalsMarketplace
 * @dev A marketplace contract for Elementals NFTs
 */
contract ElementalsMarketplace is ReentrancyGuard, Ownable {
    using Counters for Counters.Counter;
    
    // Counter for listing IDs
    Counters.Counter private _listingIds;
    
    // Fee percentage (in basis points, 100 = 1%)
    uint256 public feePercentage = 250; // 2.5% fee
    
    // Treasury wallet to collect fees
    address public treasuryWallet;
    
    // Listing structure
    struct Listing {
        uint256 listingId;
        address seller;
        address nftContract;
        uint256 tokenId;
        uint256 price;
        bool active;
    }
    
    // Mapping from listing ID to Listing data
    mapping(uint256 => Listing) public listings;
    
    // Mapping from NFT contract and token ID to listing ID
    mapping(address => mapping(uint256 => uint256)) public activeListings;
    
    // Events
    event ItemListed(uint256 indexed listingId, address indexed seller, address indexed nftContract, uint256 tokenId, uint256 price);
    event ItemSold(uint256 indexed listingId, address indexed buyer, address seller, address nftContract, uint256 tokenId, uint256 price);
    event ListingCancelled(uint256 indexed listingId, address indexed seller, address indexed nftContract, uint256 tokenId);
    event FeePercentageUpdated(uint256 oldFeePercentage, uint256 newFeePercentage);
    event TreasuryWalletUpdated(address oldTreasuryWallet, address newTreasuryWallet);

    /**
     * @dev Constructor sets the treasury wallet address
     * @param _treasuryWallet Address to receive marketplace fees
     */
    constructor(address _treasuryWallet) {
        require(_treasuryWallet != address(0), "Treasury wallet cannot be zero address");
        treasuryWallet = _treasuryWallet;
    }
    
    /**
     * @dev Update the marketplace fee percentage
     * @param _feePercentage New fee percentage (in basis points, 100 = 1%)
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
     * @dev List an NFT for sale in the marketplace
     * @param nftContract Address of the NFT contract
     * @param tokenId Token ID of the NFT
     * @param price Sale price in native currency (wei)
     * @return listingId The ID of the newly created listing
     */
    function listItem(address nftContract, uint256 tokenId, uint256 price) external returns (uint256) {
        require(price > 0, "Price must be greater than zero");
        require(IERC721(nftContract).ownerOf(tokenId) == msg.sender, "Must be owner of the NFT");
        require(IERC721(nftContract).getApproved(tokenId) == address(this) || 
                IERC721(nftContract).isApprovedForAll(msg.sender, address(this)), 
                "Marketplace must be approved to transfer NFT");
        
        // Ensure the NFT is not already listed
        require(activeListings[nftContract][tokenId] == 0, "NFT is already listed");
        
        // Increment the listing ID counter
        _listingIds.increment();
        uint256 listingId = _listingIds.current();
        
        // Create the listing
        listings[listingId] = Listing({
            listingId: listingId,
            seller: msg.sender,
            nftContract: nftContract,
            tokenId: tokenId,
            price: price,
            active: true
        });
        
        // Track the active listing
        activeListings[nftContract][tokenId] = listingId;
        
        // Emit the listing event
        emit ItemListed(listingId, msg.sender, nftContract, tokenId, price);
        
        return listingId;
    }
    
    /**
     * @dev Purchase a listed NFT
     * @param listingId The ID of the listing to purchase
     */
    function buyItem(uint256 listingId) external payable nonReentrant {
        Listing storage listing = listings[listingId];
        
        // Verify the listing is active and exists
        require(listing.active, "Listing is not active");
        require(listing.seller != address(0), "Listing does not exist");
        require(listing.seller != msg.sender, "Cannot buy your own listing");
        require(msg.value >= listing.price, "Insufficient payment");
        
        // Update the listing status
        listing.active = false;
        activeListings[listing.nftContract][listing.tokenId] = 0;
        
        // Calculate fee and seller payment
        uint256 fee = (listing.price * feePercentage) / 10000;
        uint256 sellerPayment = listing.price - fee;
        
        // Process payments
        (bool feeSuccess, ) = treasuryWallet.call{value: fee}("");
        require(feeSuccess, "Fee transfer failed");
        
        (bool sellerSuccess, ) = listing.seller.call{value: sellerPayment}("");
        require(sellerSuccess, "Seller payment failed");
        
        // Process the NFT transfer
        IERC721(listing.nftContract).safeTransferFrom(listing.seller, msg.sender, listing.tokenId);
        
        // Emit sale event
        emit ItemSold(listingId, msg.sender, listing.seller, listing.nftContract, listing.tokenId, listing.price);
        
        // Return any excess payment to the buyer
        if (msg.value > listing.price) {
            (bool refundSuccess, ) = msg.sender.call{value: msg.value - listing.price}("");
            require(refundSuccess, "Refund of excess payment failed");
        }
    }
    
    /**
     * @dev Cancel an active listing
     * @param listingId The ID of the listing to cancel
     */
    function cancelListing(uint256 listingId) external {
        Listing storage listing = listings[listingId];
        
        // Verify the listing is active and caller is the seller
        require(listing.active, "Listing is not active");
        require(listing.seller == msg.sender, "Only seller can cancel listing");
        
        // Update listing status
        listing.active = false;
        activeListings[listing.nftContract][listing.tokenId] = 0;
        
        // Emit cancellation event
        emit ListingCancelled(listingId, msg.sender, listing.nftContract, listing.tokenId);
    }
    
    /**
     * @dev Update the price of a listing
     * @param listingId The ID of the listing to update
     * @param newPrice The new price of the listing
     */
    function updateListingPrice(uint256 listingId, uint256 newPrice) external {
        require(newPrice > 0, "Price must be greater than zero");
        
        Listing storage listing = listings[listingId];
        
        // Verify the listing is active and caller is the seller
        require(listing.active, "Listing is not active");
        require(listing.seller == msg.sender, "Only seller can update listing");
        
        // Update the price
        listing.price = newPrice;
        
        // Emit updated listing event
        emit ItemListed(listingId, msg.sender, listing.nftContract, listing.tokenId, newPrice);
    }
    
    /**
     * @dev Get all active listings
     * @return Array of active listings
     */
    function getActiveListings() external view returns (Listing[] memory) {
        uint256 totalListingCount = _listingIds.current();
        uint256 activeListingCount = 0;
        
        // Count active listings
        for (uint256 i = 1; i <= totalListingCount; i++) {
            if (listings[i].active) {
                activeListingCount++;
            }
        }
        
        // Create result array
        Listing[] memory result = new Listing[](activeListingCount);
        uint256 currentIndex = 0;
        
        // Populate result array
        for (uint256 i = 1; i <= totalListingCount; i++) {
            if (listings[i].active) {
                result[currentIndex] = listings[i];
                currentIndex++;
            }
        }
        
        return result;
    }
    
    /**
     * @dev Get active listings by seller
     * @param seller The address of the seller
     * @return Array of active listings by the seller
     */
    function getListingsBySeller(address seller) external view returns (Listing[] memory) {
        uint256 totalListingCount = _listingIds.current();
        uint256 sellerListingCount = 0;
        
        // Count seller's active listings
        for (uint256 i = 1; i <= totalListingCount; i++) {
            if (listings[i].active && listings[i].seller == seller) {
                sellerListingCount++;
            }
        }
        
        // Create result array
        Listing[] memory result = new Listing[](sellerListingCount);
        uint256 currentIndex = 0;
        
        // Populate result array
        for (uint256 i = 1; i <= totalListingCount; i++) {
            if (listings[i].active && listings[i].seller == seller) {
                result[currentIndex] = listings[i];
                currentIndex++;
            }
        }
        
        return result;
    }
} 