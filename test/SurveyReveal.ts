import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { SurveyReveal, SurveyReveal__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("SurveyReveal")) as SurveyReveal__factory;
  const surveyContract = (await factory.deploy()) as SurveyReveal;
  const surveyContractAddress = await surveyContract.getAddress();

  return { surveyContract, surveyContractAddress };
}

describe("SurveyReveal", function () {
  let signers: Signers;
  let surveyContract: SurveyReveal;
  let surveyContractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ surveyContract, surveyContractAddress } = await deployFixture());
  });

  it("should create a survey successfully", async function () {
    const currentTime = Math.floor(Date.now() / 1000);
    const startTime = currentTime;
    const endTime = currentTime + 86400; // 1 day later

    const questions = [
      "Do you like in-game ads? (Yes=1 / No=0)",
      "Are you satisfied with the current difficulty? (Satisfied=1 / Not Satisfied=0)",
      "Rate game graphics (1-5)"
    ];

    const tx = await surveyContract.createSurvey(
      "Game Feedback Survey",
      questions,
      startTime,
      endTime,
    );

    await tx.wait();

    const surveyCount = await surveyContract.getSurveyCount();
    expect(surveyCount).to.equal(1);

    const survey = await surveyContract.getSurvey(0);
    expect(survey[0]).to.equal("Game Feedback Survey");
    expect(survey[1]).to.deep.equal(questions); // questions array
    expect(survey[2]).to.equal(signers.deployer.address); // creator
    expect(survey[6]).to.equal(3); // questionCount
  });

  it("should submit encrypted response successfully", async function () {
    // Create a survey first
    const currentTime = Math.floor(Date.now() / 1000);
    const startTime = currentTime;
    const endTime = currentTime + 86400;

    const questions = [
      "Do you like in-game ads?",
      "Are you satisfied with the difficulty?",
      "Rate game graphics (1-5)"
    ];

    await surveyContract.createSurvey(
      "Game Feedback Survey",
      questions,
      startTime,
      endTime,
    );

    // Alice submits response
    const answer1 = 1; // Yes
    const answer2 = 1; // Satisfied
    const answer3 = 5; // 5 stars

    const input = fhevm.createEncryptedInput(surveyContractAddress, signers.alice.address);
    input.add8(answer1);
    input.add8(answer2);
    input.add8(answer3);
    const encryptedInput = await input.encrypt();

    const tx = await surveyContract.connect(signers.alice).submitResponse(
      0,
      [encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.handles[2]],
      [encryptedInput.inputProof, encryptedInput.inputProof, encryptedInput.inputProof],
    );

    await tx.wait();

    // Check that Alice has responded
    const hasResponded = await surveyContract.hasResponded(0, signers.alice.address);
    expect(hasResponded).to.be.true;

    // Check response count
    const survey = await surveyContract.getSurvey(0);
    expect(survey[5]).to.equal(1); // responseCount
  });

  it("should prevent double submission", async function () {
    // Create a survey
    const currentTime = Math.floor(Date.now() / 1000);
    const startTime = currentTime;
    const endTime = currentTime + 86400;

    const questions = ["Q1", "Q2", "Q3"];

    await surveyContract.createSurvey(
      "Test Survey",
      questions,
      startTime,
      endTime,
    );

    // Alice submits first response
    const input1 = fhevm.createEncryptedInput(surveyContractAddress, signers.alice.address);
    input1.add8(1);
    input1.add8(1);
    input1.add8(3);
    const encryptedInput1 = await input1.encrypt();

    await surveyContract.connect(signers.alice).submitResponse(
      0,
      [encryptedInput1.handles[0], encryptedInput1.handles[1], encryptedInput1.handles[2]],
      [encryptedInput1.inputProof, encryptedInput1.inputProof, encryptedInput1.inputProof],
    );

    // Try to submit again (should fail)
    const input2 = fhevm.createEncryptedInput(surveyContractAddress, signers.alice.address);
    input2.add8(0);
    input2.add8(0);
    input2.add8(2);
    const encryptedInput2 = await input2.encrypt();

    await expect(
      surveyContract.connect(signers.alice).submitResponse(
        0,
        [encryptedInput2.handles[0], encryptedInput2.handles[1], encryptedInput2.handles[2]],
        [encryptedInput2.inputProof, encryptedInput2.inputProof, encryptedInput2.inputProof],
      ),
    ).to.be.revertedWith("Already responded");
  });

  it("should decrypt response using userDecrypt", async function () {
    // Create a survey
    const currentTime = Math.floor(Date.now() / 1000);
    const startTime = currentTime;
    const endTime = currentTime + 86400;

    const questions = ["Q1", "Q2", "Q3"];

    await surveyContract.createSurvey(
      "Test Survey",
      questions,
      startTime,
      endTime,
    );

    // Alice submits response
    const answer1 = 1;
    const answer2 = 0;
    const answer3 = 4;

    const input = fhevm.createEncryptedInput(surveyContractAddress, signers.alice.address);
    input.add8(answer1);
    input.add8(answer2);
    input.add8(answer3);
    const encryptedInput = await input.encrypt();

    await surveyContract.connect(signers.alice).submitResponse(
      0,
      [encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.handles[2]],
      [encryptedInput.inputProof, encryptedInput.inputProof, encryptedInput.inputProof],
    );

    // Get encrypted response handles
    const encryptedResponse = await surveyContract.getEncryptedResponse(0, signers.alice.address);

    // Decrypt each answer using userDecrypt
    const decrypted1 = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      encryptedResponse[0],
      surveyContractAddress,
      signers.alice,
    );
    const decrypted2 = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      encryptedResponse[1],
      surveyContractAddress,
      signers.alice,
    );
    const decrypted3 = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      encryptedResponse[2],
      surveyContractAddress,
      signers.alice,
    );

    // Verify decrypted values match original answers
    expect(decrypted1).to.equal(answer1);
    expect(decrypted2).to.equal(answer2);
    expect(decrypted3).to.equal(answer3);
  });

  it("should get encrypted response handles", async function () {
    // Create a survey
    const currentTime = Math.floor(Date.now() / 1000);
    const startTime = currentTime;
    const endTime = currentTime + 86400;

    const questions = ["Q1", "Q2", "Q3"];

    await surveyContract.createSurvey(
      "Test Survey",
      questions,
      startTime,
      endTime,
    );

    // Alice submits response
    const input = fhevm.createEncryptedInput(surveyContractAddress, signers.alice.address);
    input.add8(1);
    input.add8(1);
    input.add8(3);
    const encryptedInput = await input.encrypt();

    await surveyContract.connect(signers.alice).submitResponse(
      0,
      [encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.handles[2]],
      [encryptedInput.inputProof, encryptedInput.inputProof, encryptedInput.inputProof],
    );

    // Get encrypted response handles
    const encryptedResponse = await surveyContract.getEncryptedResponse(0, signers.alice.address);

    // Verify we got 3 handles
    expect(encryptedResponse.length).to.equal(3);
    expect(encryptedResponse[0]).to.not.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
    expect(encryptedResponse[1]).to.not.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
    expect(encryptedResponse[2]).to.not.equal("0x0000000000000000000000000000000000000000000000000000000000000000");
  });

  it("should allow multiple users to submit responses", async function () {
    // Create a survey
    const currentTime = Math.floor(Date.now() / 1000);
    const startTime = currentTime;
    const endTime = currentTime + 86400;

    const questions = ["Q1", "Q2", "Q3"];

    await surveyContract.createSurvey(
      "Multi-User Survey",
      questions,
      startTime,
      endTime,
    );

    // Alice submits
    const inputAlice = fhevm.createEncryptedInput(surveyContractAddress, signers.alice.address);
    inputAlice.add8(1);
    inputAlice.add8(0);
    inputAlice.add8(5);
    const encryptedInputAlice = await inputAlice.encrypt();

    await surveyContract.connect(signers.alice).submitResponse(
      0,
      [encryptedInputAlice.handles[0], encryptedInputAlice.handles[1], encryptedInputAlice.handles[2]],
      [encryptedInputAlice.inputProof, encryptedInputAlice.inputProof, encryptedInputAlice.inputProof],
    );

    // Bob submits
    const inputBob = fhevm.createEncryptedInput(surveyContractAddress, signers.bob.address);
    inputBob.add8(0);
    inputBob.add8(1);
    inputBob.add8(3);
    const encryptedInputBob = await inputBob.encrypt();

    await surveyContract.connect(signers.bob).submitResponse(
      0,
      [encryptedInputBob.handles[0], encryptedInputBob.handles[1], encryptedInputBob.handles[2]],
      [encryptedInputBob.inputProof, encryptedInputBob.inputProof, encryptedInputBob.inputProof],
    );

    // Check both responded
    expect(await surveyContract.hasResponded(0, signers.alice.address)).to.be.true;
    expect(await surveyContract.hasResponded(0, signers.bob.address)).to.be.true;

    // Check response count
    const survey = await surveyContract.getSurvey(0);
    expect(survey[5]).to.equal(2); // responseCount
  });
});
