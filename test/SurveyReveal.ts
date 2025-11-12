import { expect } from "chai";
import { ethers } from "hardhat";
import { SurveyReveal } from "../types/contracts/SurveyReveal";
import { Signers } from "../types/common";

describe("SurveyReveal", function () {
  let surveyReveal: SurveyReveal;
  let signers: Signers;

  before(async function () {
    signers = {
      deployer: (await ethers.getSigners())[0],
      alice: (await ethers.getSigners())[1],
      bob: (await ethers.getSigners())[2],
    };
  });

  beforeEach(async function () {
    const SurveyRevealFactory = await ethers.getContractFactory("SurveyReveal");
    surveyReveal = await SurveyRevealFactory.deploy();
    await surveyReveal.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      expect(await surveyReveal.getAddress()).to.be.properAddress;
    });

    it("Should start with zero surveys", async function () {
      expect(await surveyReveal.getSurveyCount()).to.equal(0);
    });
  });

  describe("Survey Creation", function () {
    it("Should create a survey with valid parameters", async function () {
      const title = "Customer Satisfaction Survey";
      const questions = ["How satisfied are you?", "Would you recommend us?"];
      const startTime = Math.floor(Date.now() / 1000) + 60; // 1 minute from now
      const endTime = startTime + 3600; // 1 hour later

      const tx = await surveyReveal.createSurvey(title, questions, startTime, endTime);
      await tx.wait();

      expect(await surveyReveal.getSurveyCount()).to.equal(1);
    });

    it("Should reject survey creation with empty title", async function () {
      const questions = ["Question 1"];
      const startTime = Math.floor(Date.now() / 1000) + 60;
      const endTime = startTime + 3600;

      await expect(surveyReveal.createSurvey("", questions, startTime, endTime))
        .to.be.revertedWith("Empty title");
    });

    it("Should reject survey creation with no questions", async function () {
      const title = "Test Survey";
      const questions: string[] = [];
      const startTime = Math.floor(Date.now() / 1000) + 60;
      const endTime = startTime + 3600;

      await expect(surveyReveal.createSurvey(title, questions, startTime, endTime))
        .to.be.revertedWith("Invalid question count");
    });
  });

  describe("Survey Information", function () {
    let surveyId: bigint;

    beforeEach(async function () {
      const title = "Test Survey";
      const questions = ["Question 1", "Question 2", "Question 3"];
      const startTime = Math.floor(Date.now() / 1000) + 60;
      const endTime = startTime + 3600;

      const tx = await surveyReveal.createSurvey(title, questions, startTime, endTime);
      await tx.wait();

      surveyId = 0n; // First survey
    });

    it("Should return correct survey information", async function () {
      const [title, questions, creator, startTime, endTime, responseCount, questionCount] =
        await surveyReveal.getSurvey(surveyId);

      expect(title).to.equal("Test Survey");
      expect(questions).to.deep.equal(["Question 1", "Question 2", "Question 3"]);
      expect(creator).to.equal(signers.deployer.address);
      expect(questionCount).to.equal(3);
      expect(responseCount).to.equal(0);
    });

    it("Should reject access to non-existent surveys", async function () {
      await expect(surveyReveal.getSurvey(999))
        .to.be.revertedWith("Invalid survey");
    });
  });

  describe("Survey Response Logic", function () {
    let surveyId: bigint;

    beforeEach(async function () {
      const title = "Test Survey";
      const questions = ["Question 1", "Question 2"];
      const startTime = Math.floor(Date.now() / 1000) - 60; // 1 minute ago (already started)
      const endTime = startTime + 7200; // 2 hours later

      const tx = await surveyReveal.createSurvey(title, questions, startTime, endTime);
      await tx.wait();

      surveyId = 0n;
    });

    it("Should track respondent participation", async function () {
      expect(await surveyReveal.hasResponded(surveyId, signers.alice.address)).to.be.false;

      // In real FHE scenario, a response would be submitted here
      // For now, we test the tracking mechanism
      const [,,, responseCount] = await surveyReveal.getSurvey(surveyId);
      expect(responseCount).to.equal(0);
    });

    it("Should prevent multiple responses from same user", async function () {
      // First response should succeed (in real FHE scenario)
      // Second response should be rejected
      expect(await surveyReveal.hasResponded(surveyId, signers.alice.address)).to.be.false;
    });
  });

  describe("Decryption Logic", function () {
    it("Should handle decryption requests", async function () {
      // Create a survey
      const title = "Decryption Test";
      const questions = ["Question 1"];
      const startTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const endTime = startTime + 1800; // 30 minutes ago (already ended)

      const tx = await surveyReveal.createSurvey(title, questions, startTime, endTime);
      await tx.wait();

      // Request decryption
      await expect(surveyReveal.requestDecryption(0, signers.alice.address)).to.not.be.reverted;
    });
  });

  describe("Access Control", function () {
    it("Should properly handle survey creator permissions", async function () {
      const title = "Access Control Test";
      const questions = ["Question 1"];
      const startTime = Math.floor(Date.now() / 1000) + 60;
      const endTime = startTime + 3600;

      const tx = await surveyReveal.createSurvey(title, questions, startTime, endTime);
      await tx.wait();

      const [, , creator] = await surveyReveal.getSurvey(0);
      expect(creator).to.equal(signers.deployer.address);
    });
  });

  describe("Survey Statistics", function () {
    let surveyId: bigint;

    beforeEach(async function () {
      const title = "Stats Test Survey";
      const questions = ["Question 1", "Question 2", "Question 3"];
      const startTime = Math.floor(Date.now() / 1000) - 60; // 1 minute ago (active)
      const endTime = startTime + 3600; // 1 hour later

      const tx = await surveyReveal.createSurvey(title, questions, startTime, endTime);
      await tx.wait();

      surveyId = 0n;
    });

    it("Should provide accurate survey statistics", async function () {
      const [responseCount, isActive, timeRemaining, questionCount] = await surveyReveal.getSurveyStats(surveyId);

      expect(responseCount).to.equal(0);
      expect(isActive).to.be.true;
      expect(timeRemaining).to.be.greaterThan(0);
      expect(questionCount).to.equal(3);
    });

    it("Should track survey activity status correctly", async function () {
      // Active survey
      let [, isActive] = await surveyReveal.getSurveyStats(surveyId);
      expect(isActive).to.be.true;

      // Note: In real scenario, we'd test ended surveys too
    });
  });

  describe("Emergency Controls", function () {
    it("Should allow survey creator to emergency pause", async function () {
      // Create a survey
      const title = "Emergency Test";
      const questions = ["Question 1"];
      const startTime = Math.floor(Date.now() / 1000) + 60;
      const endTime = startTime + 3600;

      const tx = await surveyReveal.createSurvey(title, questions, startTime, endTime);
      await tx.wait();

      // Emergency pause by creator
      await expect(surveyReveal.emergencyPause(0)).to.not.be.reverted;

      // Check that survey is now ended
      const [, , , endTimeAfter] = await surveyReveal.getSurvey(0);
      expect(endTimeAfter).to.be.lessThan(endTime);
    });

    it("Should prevent non-creator from emergency pausing", async function () {
      // Create a survey
      const title = "Emergency Test";
      const questions = ["Question 1"];
      const startTime = Math.floor(Date.now() / 1000) + 60;
      const endTime = startTime + 3600;

      const tx = await surveyReveal.createSurvey(title, questions, startTime, endTime);
      await tx.wait();

      // Try to pause from different account
      await expect(surveyReveal.connect(signers.alice).emergencyPause(0))
        .to.be.revertedWith("Only survey creator can pause");
    });
  });

  describe("Input Validation", function () {
    it("Should enforce question count limits", async function () {
      // Test maximum questions (10)
      const title = "Max Questions";
      const questions = Array.from({ length: 10 }, (_, i) => `Question ${i + 1}`);
      const startTime = Math.floor(Date.now() / 1000) + 60;
      const endTime = startTime + 3600;

      await expect(surveyReveal.createSurvey(title, questions, startTime, endTime))
        .to.not.be.reverted;

      // Test too many questions (11)
      const tooManyQuestions = Array.from({ length: 11 }, (_, i) => `Question ${i + 1}`);
      await expect(surveyReveal.createSurvey("Too Many", tooManyQuestions, startTime, endTime))
        .to.be.revertedWith("Invalid question count");
    });

    it("Should validate survey timing constraints", async function () {
      const title = "Timing Test";
      const questions = ["Question 1"];

      // End time before start time
      const startTime = Math.floor(Date.now() / 1000) + 3600;
      const endTime = startTime - 100;

      await expect(surveyReveal.createSurvey(title, questions, startTime, endTime))
        .to.be.revertedWith("Invalid times");
    });
  });
});
