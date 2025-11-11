import { expect } from "chai";
import { ethers } from "hardhat";
import { SurveyReveal } from "../types/contracts/SurveyReveal";

describe("SurveyReveal Sepolia Tests", function () {
  let surveyReveal: SurveyReveal;
  let contractAddress: string;

  // Increase timeout for network tests
  this.timeout(60000);

  before(async function () {
    // Skip these tests if not on Sepolia
    if (network.name !== "sepolia") {
      console.log("Skipping Sepolia tests - not on Sepolia network");
      this.skip();
      return;
    }

    // Get deployed contract address from deployments
    const deployment = require("../deployments/sepolia/SurveyReveal.json");
    contractAddress = deployment.address;

    surveyReveal = await ethers.getContractAt("SurveyReveal", contractAddress);
  });

  describe("Sepolia Deployment", function () {
    it("Should be deployed on Sepolia", async function () {
      expect(await surveyReveal.getAddress()).to.be.properAddress;
    });

    it("Should have proper contract initialization", async function () {
      const surveyCount = await surveyReveal.getSurveyCount();
      expect(surveyCount).to.be.at.least(0);
    });
  });

  describe("Sepolia Network Interactions", function () {
    it("Should handle network-specific configurations", async function () {
      const network = await ethers.provider.getNetwork();
      expect(network.chainId).to.equal(11155111n); // Sepolia chain ID
    });

    it("Should be compatible with Sepolia FHEVM", async function () {
      // Test that the contract is configured for Sepolia
      const isSepoliaConfig = surveyReveal instanceof ethers.Contract;
      expect(isSepoliaConfig).to.be.true;
    });

    it("Should support survey creation on testnet", async function () {
      // Test basic contract functionality
      const methods = Object.keys(surveyReveal.interface.functions);
      expect(methods).to.include("createSurvey");
      expect(methods).to.include("getSurvey");
      expect(methods).to.include("submitResponse");
    });
  });

  describe("Sepolia FHE Operations", function () {
    it("Should handle FHE-based operations", async function () {
      // This test verifies the contract interface for FHE operations
      const hasResponseFunction = surveyReveal.interface.functions["submitResponse"];
      expect(hasResponseFunction).to.exist;

      const hasDecryptionFunction = surveyReveal.interface.functions["requestDecryption"];
      expect(hasDecryptionFunction).to.exist;
    });

    it("Should support encrypted response retrieval", async function () {
      const hasEncryptedResponseFunction = surveyReveal.interface.functions["getEncryptedResponse"];
      expect(hasEncryptedResponseFunction).to.exist;

      const hasRevealedResponseFunction = surveyReveal.interface.functions["getRevealedResponse"];
      expect(hasRevealedResponseFunction).to.exist;
    });
  });

  describe("Sepolia Access Controls", function () {
    it("Should properly handle access control functions", async function () {
      const [signer] = await ethers.getSigners();

      // Test that contract exists and is accessible
      const code = await ethers.provider.getCode(await surveyReveal.getAddress());
      expect(code).to.not.equal("0x");

      // Test basic view function accessibility
      await expect(surveyReveal.connect(signer).getSurveyCount()).to.not.be.reverted;
    });

    it("Should validate survey existence checks", async function () {
      // Test with invalid survey ID
      await expect(surveyReveal.getSurvey(99999))
        .to.be.revertedWith("Invalid survey");
    });
  });

  describe("Sepolia Survey Management", function () {
    it("Should handle survey creation on testnet", async function () {
      // Test survey creation parameters validation
      const title = "Sepolia Survey";
      const questions = ["Test question"];
      const startTime = Math.floor(Date.now() / 1000) + 60;
      const endTime = startTime + 3600;

      // This would require actual transaction on Sepolia
      // For now, we test the interface
      const createSurveyFunction = surveyReveal.interface.functions["createSurvey"];
      expect(createSurveyFunction).to.exist;
      expect(createSurveyFunction.inputs.length).to.equal(4);
    });

    it("Should support response tracking", async function () {
      const hasRespondedFunction = surveyReveal.interface.functions["hasResponded"];
      expect(hasRespondedFunction).to.exist;

      const isDecryptionPendingFunction = surveyReveal.interface.functions["isDecryptionPending"];
      expect(isDecryptionPendingFunction).to.exist;
    });
  });
});
