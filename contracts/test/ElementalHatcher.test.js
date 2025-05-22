const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ElementalHatcher", function () {
  let ElementalHatcher;
  let hatcher;
  let owner;
  let treasury;
  let user;
  let mockNFT;
  
  const HATCH_PRICE = ethers.parseEther("0.1");
  
  // We'll need to modify the contract for testing to make token selection deterministic
  beforeEach(async function () {
    // Get signers
    [owner, treasury, user] = await ethers.getSigners();
    
    // Deploy a modified version of ElementalHatcher for testing
    const ElementalHatcherTest = await ethers.getContractFactory("ElementalHatcherTest");
    hatcher = await ElementalHatcherTest.deploy(owner.address, treasury.address);
    
    // Deploy a mock NFT contract
    const MockERC721 = await ethers.getContractFactory("MockERC721");
    mockNFT = await MockERC721.deploy("ElementalAdventurer", "ELEM");
    
    // Set the NFT contract in the hatcher
    await hatcher.setNftContract(await mockNFT.getAddress());
    
    // Mint tokens to the treasury (0-9)
    for (let i = 0; i < 10; i++) {
      await mockNFT.mint(treasury.address, i);
    }
    
    // Treasury approves the hatcher contract to transfer its tokens
    await mockNFT.connect(treasury).setApprovalForAll(await hatcher.getAddress(), true);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await hatcher.owner()).to.equal(owner.address);
    });

    it("Should set the right treasury", async function () {
      expect(await hatcher.treasury()).to.equal(treasury.address);
    });
  });

  describe("Claiming", function () {
    it("Should revert if payment is incorrect", async function () {
      await expect(
        hatcher.connect(user).claimAdventurer({ value: ethers.parseEther("0.05") })
      ).to.be.revertedWith("Incorrect payment amount");
    });

    it("Should transfer NFT from treasury to user", async function () {
      // Set the next token ID to be claimed
      await hatcher.setNextTokenId(5);
      
      await hatcher.connect(user).claimAdventurer({ value: HATCH_PRICE });
      
      // Check that the token was transferred
      expect(await mockNFT.ownerOf(5)).to.equal(user.address);
      
      // Check that the token was marked as claimed
      expect(await hatcher.claimedTokenIds(5)).to.be.true;
      
      // Check that the claimed count was incremented
      expect(await hatcher.claimedCount()).to.equal(1);
    });

    it("Should emit AdventurerClaimed event", async function () {
      // Set the next token ID to be claimed
      await hatcher.setNextTokenId(7);
      
      await expect(
        hatcher.connect(user).claimAdventurer({ value: HATCH_PRICE })
      )
        .to.emit(hatcher, "AdventurerClaimed")
        .withArgs(user.address, 7);
    });
  });

  describe("Utility Functions", function () {
    it("Should return correct claimed token count", async function () {
      expect(await hatcher.getClaimedTokenCount()).to.equal(0);
      
      // Set the next token ID to be claimed
      await hatcher.setNextTokenId(3);
      await hatcher.connect(user).claimAdventurer({ value: HATCH_PRICE });
      
      expect(await hatcher.getClaimedTokenCount()).to.equal(1);
    });

    it("Should return correct available token count", async function () {
      const maxSupply = await hatcher.MAX_SUPPLY();
      expect(await hatcher.getAvailableTokenCount()).to.equal(maxSupply);
      
      // Set the next token ID to be claimed
      await hatcher.setNextTokenId(8);
      await hatcher.connect(user).claimAdventurer({ value: HATCH_PRICE });
      
      expect(await hatcher.getAvailableTokenCount()).to.equal(maxSupply - 1n);
    });
  });

  describe("Withdrawal", function () {
    it("Should allow owner to withdraw funds", async function () {
      // Set the next token ID to be claimed
      await hatcher.setNextTokenId(1);
      
      // User claims an adventurer
      await hatcher.connect(user).claimAdventurer({ value: HATCH_PRICE });
      
      // Check contract balance
      const contractBalance = await ethers.provider.getBalance(await hatcher.getAddress());
      expect(contractBalance).to.equal(HATCH_PRICE);
      
      // Owner withdraws funds
      const initialOwnerBalance = await ethers.provider.getBalance(owner.address);
      await hatcher.withdraw();
      const finalOwnerBalance = await ethers.provider.getBalance(owner.address);
      
      // Check that owner received the funds (minus gas)
      expect(finalOwnerBalance).to.be.greaterThan(initialOwnerBalance);
    });

    it("Should revert if non-owner tries to withdraw", async function () {
      // Set the next token ID to be claimed
      await hatcher.setNextTokenId(2);
      
      await hatcher.connect(user).claimAdventurer({ value: HATCH_PRICE });
      
      await expect(
        hatcher.connect(user).withdraw()
      ).to.be.revertedWithCustomError(hatcher, "OwnableUnauthorizedAccount");
    });
  });
}); 