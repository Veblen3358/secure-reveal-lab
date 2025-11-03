import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { SurveyReveal } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  alice: HardhatEthersSigner;
};

describe("SurveyRevealSepolia", function () {
  let signers: Signers;
  let surveyContract: SurveyReveal;
  let surveyContractAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const SurveyRevealDeployment = await deployments.get("SurveyReveal");
      surveyContractAddress = SurveyRevealDeployment.address;
      surveyContract = await ethers.getContractAt("SurveyReveal", SurveyRevealDeployment.address);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("should create a survey and submit encrypted response on Sepolia", async function () {
    steps = 8;

    this.timeout(6 * 40000);

    progress("Getting current survey count...");
    const initialCount = await surveyContract.getSurveyCount();
    console.log(`Initial survey count: ${initialCount}`);

    progress("Creating new survey...");
    const currentTime = Math.floor(Date.now() / 1000);
    const startTime = currentTime;
    const endTime = currentTime + 7 * 24 * 60 * 60; // 7 days

    const questions = [
      "Do you like in-game ads? (Yes=1 / No=0)",
      "Are you satisfied with the current difficulty? (Satisfied=1 / Not Satisfied=0)",
      "Rate game graphics (1-5)"
    ];

    const txCreate = await surveyContract.createSurvey(
      "Sepolia Test Survey",
      questions,
      startTime,
      endTime,
    );
    await txCreate.wait();

    progress("Getting new survey ID...");
    const surveyCount = await surveyContract.getSurveyCount();
    const surveyId = surveyCount - 1n;
    console.log(`Created survey ID: ${surveyId}`);

    progress("Getting survey details...");
    const survey = await surveyContract.getSurvey(surveyId);
    console.log(`Survey title: ${survey[0]}`);
    expect(survey[0]).to.equal("Sepolia Test Survey");

    progress("Encrypting response (1, 1, 4)...");
    const encryptedInput = await fhevm
      .createEncryptedInput(surveyContractAddress, signers.alice.address)
      .add8(1) // Yes to ads
      .add8(1) // Satisfied with difficulty
      .add8(4) // Rating 4/5
      .encrypt();

    progress(
      `Submitting response for survey ${surveyId} with handle=${ethers.hexlify(encryptedInput.handles[0])} signer=${signers.alice.address}...`,
    );
    const txSubmit = await surveyContract
      .connect(signers.alice)
      .submitResponse(
        surveyId,
        [encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.handles[2]],
        [encryptedInput.inputProof, encryptedInput.inputProof, encryptedInput.inputProof],
      );
    await txSubmit.wait();

    progress("Verifying response submission...");
    const hasResponded = await surveyContract.hasResponded(surveyId, signers.alice.address);
    expect(hasResponded).to.be.true;

    progress("Getting encrypted response handles...");
    const encryptedResponse = await surveyContract.getEncryptedResponse(surveyId, signers.alice.address);
    console.log(`Encrypted answer 1: ${encryptedResponse[0]}`);
    console.log(`Encrypted answer 2: ${encryptedResponse[1]}`);
    console.log(`Encrypted answer 3: ${encryptedResponse[2]}`);
    expect(encryptedResponse[0]).to.not.equal(ethers.ZeroHash);

    progress("Test completed successfully!");
  });

  it("should decrypt response on Sepolia (if supported)", async function () {
    steps = 6;

    this.timeout(6 * 40000);

    progress("Finding a survey with responses...");
    const surveyCount = await surveyContract.getSurveyCount();
    expect(surveyCount).to.be.greaterThan(0);

    const surveyId = surveyCount - 1n;
    const hasResponded = await surveyContract.hasResponded(surveyId, signers.alice.address);

    if (!hasResponded) {
      console.log("No response found for Alice in the latest survey. Skipping decryption test.");
      this.skip();
    }

    progress(`Checking if response for survey ${surveyId} is already revealed...`);
    const isRevealed = await surveyContract.isResponseRevealed(surveyId, signers.alice.address);

    if (isRevealed) {
      progress("Response already revealed. Getting revealed data...");
      const revealed = await surveyContract.getRevealedResponse(surveyId, signers.alice.address);
      const answers = revealed[0]; // answers array
      console.log(`Revealed answer 1: ${answers[0]}`);
      console.log(`Revealed answer 2: ${answers[1]}`);
      console.log(`Revealed answer 3: ${answers[2]}`);
      progress("Decryption test completed (using existing revealed data)!");
      return;
    }

    progress(`Requesting decryption for survey ${surveyId}...`);
    const txDecrypt = await surveyContract.connect(signers.alice).requestDecryption(surveyId, signers.alice.address);
    const receipt = await txDecrypt.wait();
    console.log(`Decryption requested. Tx hash: ${receipt?.hash}`);

    progress("Waiting for KMS decryption callback...");
    console.log(
      "Note: On Sepolia, decryption happens asynchronously via KMS. The callback may take some time.",
    );

    progress("Test completed. Check later with isResponseRevealed() to see if decryption completed.");
  });
});





