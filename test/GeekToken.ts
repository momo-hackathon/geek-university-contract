import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { parseEther } from "ethers";
// Corrected import paths for typechain types
import { GeekToken } from "../typechain-types/contracts/GeekToken"; 
import { GeekToken__factory } from "../typechain-types/factories/contracts/GeekToken__factory";

describe("GeekToken", function () {
  async function deployGeekTokenFixture() {
    const [owner, account1, account2, teamWallet, marketingWallet, communityWallet] = await hre.ethers.getSigners();

    const geekTokenFactory = (await hre.ethers.getContractFactory("GeekToken")) as GeekToken__factory;
    const geekToken = (await geekTokenFactory.deploy()) as GeekToken;
    await geekToken.waitForDeployment();

    const TOKENS_PER_ETH: bigint = await geekToken.TOKENS_PER_ETH();
    const MAX_SUPPLY: bigint = await geekToken.MAX_SUPPLY();
    const DECIMALS: bigint = await geekToken.decimals();

    return {
      geekToken,
      owner,
      account1,
      account2,
      teamWallet,
      marketingWallet,
      communityWallet,
      TOKENS_PER_ETH,
      MAX_SUPPLY,
      DECIMALS
    };
  }

  describe("Deployment", function () {
    it("Should set the right token name and symbol", async function () {
      const { geekToken } = await loadFixture(deployGeekTokenFixture);
      expect(await geekToken.name()).to.equal("Geek Token");
      expect(await geekToken.symbol()).to.equal("Geek");
    });

    it("Should set the right owner", async function () {
      const { geekToken, owner } = await loadFixture(deployGeekTokenFixture);
      expect(await geekToken.owner()).to.equal(owner.address);
    });

    it("Should have correct MAX_SUPPLY", async function () {
      const { geekToken, MAX_SUPPLY } = await loadFixture(deployGeekTokenFixture);
      expect(await geekToken.MAX_SUPPLY()).to.equal(MAX_SUPPLY);
      expect(MAX_SUPPLY).to.equal(1250000n);
    });

    it("Should have correct TOKENS_PER_ETH", async function () {
      const { geekToken, TOKENS_PER_ETH } = await loadFixture(deployGeekTokenFixture);
      expect(await geekToken.TOKENS_PER_ETH()).to.equal(TOKENS_PER_ETH);
      expect(TOKENS_PER_ETH).to.equal(1000n);
    });

    it("Should have correct decimals", async function () {
      const { geekToken, DECIMALS } = await loadFixture(deployGeekTokenFixture);
      expect(await geekToken.decimals()).to.equal(DECIMALS);
      expect(DECIMALS).to.equal(0n);
    });

    it("Should have correct initial allocations calculated", async function () {
      const { geekToken, MAX_SUPPLY } = await loadFixture(deployGeekTokenFixture);
      const expectedTeamAllocation = (MAX_SUPPLY * 20n) / 100n;
      const expectedMarketingAllocation = (MAX_SUPPLY * 10n) / 100n;
      const expectedCommunityAllocation = (MAX_SUPPLY * 10n) / 100n;

      expect(await geekToken.teamAllocation()).to.equal(expectedTeamAllocation);
      expect(await geekToken.marketingAllocation()).to.equal(expectedMarketingAllocation);
      expect(await geekToken.communityAllocation()).to.equal(expectedCommunityAllocation);
    });

    it("Should have initialDistributionDone as false initially", async function () {
      const { geekToken } = await loadFixture(deployGeekTokenFixture);
      expect(await geekToken.initialDistributionDone()).to.be.false;
    });
  });

  describe("distributeInitialTokens", function () {
    it("Should allow owner to distribute initial tokens", async function () {
      const { geekToken, owner, teamWallet, marketingWallet, communityWallet } = await loadFixture(deployGeekTokenFixture);
      
      const teamAllocation = await geekToken.teamAllocation();
      const marketingAllocation = await geekToken.marketingAllocation();
      const communityAllocation = await geekToken.communityAllocation();

      await expect(geekToken.connect(owner).distributeInitialTokens(teamWallet.address, marketingWallet.address, communityWallet.address))
        .to.emit(geekToken, "InitialDistributionCompleted")
        .withArgs(teamWallet.address, marketingWallet.address, communityWallet.address);

      expect(await geekToken.balanceOf(teamWallet.address)).to.equal(teamAllocation);
      expect(await geekToken.balanceOf(marketingWallet.address)).to.equal(marketingAllocation);
      expect(await geekToken.balanceOf(communityWallet.address)).to.equal(communityAllocation);
      expect(await geekToken.initialDistributionDone()).to.be.true;
    });

    it("Should prevent non-owner from distributing initial tokens", async function () {
      const { geekToken, account1, teamWallet, marketingWallet, communityWallet } = await loadFixture(deployGeekTokenFixture);
      await expect(
        geekToken.connect(account1).distributeInitialTokens(teamWallet.address, marketingWallet.address, communityWallet.address)
      ).to.be.revertedWithCustomError(geekToken, "OwnableUnauthorizedAccount").withArgs(account1.address);
    });

    it("Should prevent distributing initial tokens more than once", async function () {
      const { geekToken, owner, teamWallet, marketingWallet, communityWallet } = await loadFixture(deployGeekTokenFixture);
      await geekToken.connect(owner).distributeInitialTokens(teamWallet.address, marketingWallet.address, communityWallet.address);
      await expect(
        geekToken.connect(owner).distributeInitialTokens(teamWallet.address, marketingWallet.address, communityWallet.address)
      ).to.be.revertedWith("Initial distribution already done");
    });
  });

  describe("buyWithETH", function () {
    it("Should allow users to buy tokens with ETH", async function () {
      const { geekToken, account1, TOKENS_PER_ETH } = await loadFixture(deployGeekTokenFixture);
      const ethAmount = parseEther("1");
      const expectedTokenAmount = (ethAmount * TOKENS_PER_ETH) / parseEther("1");

      await expect(geekToken.connect(account1).buyWithETH({ value: ethAmount }))
        .to.emit(geekToken, "TokensPurchased")
        .withArgs(account1.address, ethAmount, expectedTokenAmount);

      expect(await geekToken.balanceOf(account1.address)).to.equal(expectedTokenAmount);
      expect(await hre.ethers.provider.getBalance(await geekToken.getAddress())).to.equal(ethAmount);
    });

    it("Should revert if no ETH is sent", async function () {
      const { geekToken, account1 } = await loadFixture(deployGeekTokenFixture);
      await expect(geekToken.connect(account1).buyWithETH({ value: 0 })).to.be.revertedWith("Must send ETH");
    });

    it("Should revert if buying tokens exceeds MAX_SUPPLY", async function () {
      const { geekToken, owner, account1, TOKENS_PER_ETH, teamWallet, marketingWallet, communityWallet } = await loadFixture(deployGeekTokenFixture);
      await geekToken.connect(owner).distributeInitialTokens(teamWallet.address, marketingWallet.address, communityWallet.address);
      
      const remainingSupply: bigint = await geekToken.remainingMintableSupply();
      const tokens_per_eth_val: bigint = await geekToken.TOKENS_PER_ETH();
      
      const tokensToAttemptToBuy = remainingSupply + 1n;
      const ethForTokensToExceed: bigint = (tokensToAttemptToBuy * parseEther("1")) / tokens_per_eth_val;

      const minEthRequiredForOneToken = parseEther("1") / tokens_per_eth_val;
      const finalEthToSend = ethForTokensToExceed > 0n ? ethForTokensToExceed : (minEthRequiredForOneToken > 0n ? minEthRequiredForOneToken : parseEther("0.000000000000000001")); // Ensure some ETH is sent

      await expect(geekToken.connect(account1).buyWithETH({ value: finalEthToSend })).to.be.revertedWith("Would exceed max supply");
    });
  });

  describe("sellTokens", function () {
    async function setupStateForSellTokens() {
      const fixtureData = await loadFixture(deployGeekTokenFixture);
      const { geekToken, owner, account1, teamWallet, marketingWallet, communityWallet, TOKENS_PER_ETH } = fixtureData;

      await geekToken.connect(owner).distributeInitialTokens(teamWallet.address, marketingWallet.address, communityWallet.address);
      
      const ethToBuyForAccount1 = parseEther("2");
      await geekToken.connect(account1).buyWithETH({ value: ethToBuyForAccount1 });

      const ethForContractLiquidity = parseEther("5");
      await geekToken.connect(owner).buyWithETH({ value: ethForContractLiquidity });
      
      return fixtureData;
    }
    
    it("Should allow users to sell tokens for ETH", async function () {
      const { geekToken, account1, TOKENS_PER_ETH } = await loadFixture(setupStateForSellTokens);
      
      const initialContractETHBalance = await hre.ethers.provider.getBalance(await geekToken.getAddress());
      const initialAccount1ETHBalance = await hre.ethers.provider.getBalance(account1.address);
      const initialAccount1TokenBalance = await geekToken.balanceOf(account1.address);

      const tokensToSell = 500n; 
      expect(initialAccount1TokenBalance >= tokensToSell, "Account1 must have enough tokens to sell for this test case").to.be.true;
      const expectedEthAmount: bigint = (tokensToSell * parseEther("1")) / TOKENS_PER_ETH;

      const tx = await geekToken.connect(account1).sellTokens(tokensToSell);
      const receipt = await tx.wait();
      const gasUsedOnTx: bigint = BigInt(receipt!.gasUsed) * BigInt(receipt!.effectiveGasPrice); // Corrected gas calculation

      await expect(tx)
        .to.emit(geekToken, "TokensSold")
        .withArgs(account1.address, tokensToSell, expectedEthAmount);

      expect(await geekToken.balanceOf(account1.address)).to.equal( initialAccount1TokenBalance - tokensToSell );
      expect(await hre.ethers.provider.getBalance(await geekToken.getAddress())).to.equal(initialContractETHBalance - expectedEthAmount);
      expect(await hre.ethers.provider.getBalance(account1.address)).to.equal(initialAccount1ETHBalance + expectedEthAmount - gasUsedOnTx);
    });

    it("Should revert if selling 0 tokens", async function () {
      const { geekToken, account1 } = await loadFixture(setupStateForSellTokens);
      await expect(geekToken.connect(account1).sellTokens(0)).to.be.revertedWith("Amount must be greater than 0");
    });

    it("Should revert if user has insufficient token balance", async function () {
      const { geekToken, account2 } = await loadFixture(setupStateForSellTokens);
      expect(await geekToken.balanceOf(account2.address)).to.equal(0n);
      await expect(geekToken.connect(account2).sellTokens(100)).to.be.revertedWith("Insufficient balance");
    });

    it("Should revert if contract has insufficient ETH balance", async function () {
      const { geekToken, owner, account1, TOKENS_PER_ETH } = await loadFixture(setupStateForSellTokens);
      
      const contractEthBalance = await hre.ethers.provider.getBalance(await geekToken.getAddress());
      if (contractEthBalance > 0) {
        await geekToken.connect(owner).withdrawETH();
      }
      expect(await hre.ethers.provider.getBalance(await geekToken.getAddress())).to.equal(0);

      const tokensToSell = 100n; 
      const account1Balance = await geekToken.balanceOf(account1.address);
      if (account1Balance < tokensToSell) { 
         const ethToBuy = (tokensToSell * parseEther("1")) / TOKENS_PER_ETH; // Calculate ETH needed for tokensToSell
         if (ethToBuy > 0) { // Ensure we are buying with some ETH
            await geekToken.connect(account1).buyWithETH({value: ethToBuy > parseEther("0.000001") ? ethToBuy : parseEther("0.000001")});
         } else { // If tokensToSell is very small, buy a minimum amount
            await geekToken.connect(account1).buyWithETH({value: parseEther("0.001")}); 
         }
      }
      // Re-check balance after potential buy
      const currentAccount1Balance = await geekToken.balanceOf(account1.address);
      expect(currentAccount1Balance >= tokensToSell, "Account1 should have enough tokens after attempting to buy.").to.be.true;

      await expect(geekToken.connect(account1).sellTokens(tokensToSell)).to.be.revertedWith("Insufficient ETH in contract");
    });
  });

  describe("remainingMintableSupply", function () {
    it("Should return correct remaining mintable supply", async function () {
      const { geekToken, owner, account1, MAX_SUPPLY, TOKENS_PER_ETH, teamWallet, marketingWallet, communityWallet } = await loadFixture(deployGeekTokenFixture);
      let expectedRemaining = MAX_SUPPLY;
      expect(await geekToken.remainingMintableSupply()).to.equal(expectedRemaining);

      await geekToken.connect(owner).distributeInitialTokens(teamWallet.address, marketingWallet.address, communityWallet.address);
      const teamAllocation = await geekToken.teamAllocation();
      const marketingAllocation = await geekToken.marketingAllocation();
      const communityAllocation = await geekToken.communityAllocation();
      expectedRemaining = MAX_SUPPLY - teamAllocation - marketingAllocation - communityAllocation;
      expect(await geekToken.remainingMintableSupply()).to.equal(expectedRemaining);

      const ethToBuy = parseEther("1");
      const tokensBought = (ethToBuy * TOKENS_PER_ETH) / parseEther("1");
      await geekToken.connect(account1).buyWithETH({ value: ethToBuy });
      expectedRemaining -= tokensBought;
      expect(await geekToken.remainingMintableSupply()).to.equal(expectedRemaining);
    });
  });

  describe("withdrawETH", function () {
    it("Should allow owner to withdraw ETH from contract", async function () {
      const { geekToken, owner, account1 } = await loadFixture(deployGeekTokenFixture);
      const ethAmount = parseEther("2");
      await geekToken.connect(account1).buyWithETH({ value: ethAmount });
      
      const contractBalanceBefore = await hre.ethers.provider.getBalance(await geekToken.getAddress());
      expect(contractBalanceBefore).to.equal(ethAmount);

      const ownerBalanceBefore = await hre.ethers.provider.getBalance(owner.address);
      
      const tx = await geekToken.connect(owner).withdrawETH();
      const receipt = await tx.wait();
      const gasUsedOnTx: bigint = BigInt(receipt!.gasUsed) * BigInt(receipt!.effectiveGasPrice); // Corrected gas calculation

      expect(await hre.ethers.provider.getBalance(await geekToken.getAddress())).to.equal(0);
      expect(await hre.ethers.provider.getBalance(owner.address)).to.equal(ownerBalanceBefore + contractBalanceBefore - gasUsedOnTx);
    });

    it("Should prevent non-owner from withdrawing ETH", async function () {
      const { geekToken, account1, account2 } = await loadFixture(deployGeekTokenFixture);
      const ethAmount = parseEther("1");
      await geekToken.connect(account2).buyWithETH({ value: ethAmount });

      await expect(geekToken.connect(account1).withdrawETH())
        .to.be.revertedWithCustomError(geekToken, "OwnableUnauthorizedAccount").withArgs(account1.address);
    });
  });

  describe("Receive and Fallback", function () {
    it("Should allow contract to receive ETH via receive()", async function () {
      const { geekToken, owner } = await loadFixture(deployGeekTokenFixture);
      const ethToSend = parseEther("0.5");
      const initialBalance = await hre.ethers.provider.getBalance(await geekToken.getAddress());
      
      await owner.sendTransaction({
        to: await geekToken.getAddress(),
        value: ethToSend,
      });
      
      expect(await hre.ethers.provider.getBalance(await geekToken.getAddress())).to.equal(initialBalance + ethToSend);
    });

    it("Should allow contract to receive ETH via fallback()", async function () {
      const { geekToken, owner } = await loadFixture(deployGeekTokenFixture);
      const ethToSend = parseEther("0.5");
      const initialBalance = await hre.ethers.provider.getBalance(await geekToken.getAddress());

      await owner.sendTransaction({
        to: await geekToken.getAddress(),
        value: ethToSend,
        data: "0x12345678" 
      });
      
      expect(await hre.ethers.provider.getBalance(await geekToken.getAddress())).to.equal(initialBalance + ethToSend);
    });
  });
});
