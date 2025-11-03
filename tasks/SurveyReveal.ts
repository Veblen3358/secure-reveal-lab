import { task } from "hardhat/config";
import type { HardhatRuntimeEnvironment } from "hardhat/types";

task("survey:create", "Create a new survey")
  .addParam("title", "Survey title")
  .setAction(async function (taskArguments: { title: string }, hre: HardhatRuntimeEnvironment) {
    const { ethers, deployments } = hre;
    const SurveyReveal = await deployments.get("SurveyReveal");
    const surveyContract = await ethers.getContractAt("SurveyReveal", SurveyReveal.address);

    const currentTime = Math.floor(Date.now() / 1000);
    const startTime = currentTime;
    const endTime = currentTime + 7 * 24 * 60 * 60; // 7 days from now

    const tx = await surveyContract.createSurvey(
      taskArguments.title,
      "Do you like in-game ads? (Yes=1 / No=0)",
      "Are you satisfied with the current difficulty? (Satisfied=1 / Not Satisfied=0)",
      "Rate game graphics (1-5)",
      startTime,
      endTime,
    );

    const receipt = await tx.wait();
    console.log(`Survey created! Transaction hash: ${receipt?.hash}`);

    const surveyCount = await surveyContract.getSurveyCount();
    console.log(`Total surveys: ${surveyCount}`);
    console.log(`New survey ID: ${surveyCount - 1n}`);
  });

task("survey:get", "Get survey details")
  .addParam("id", "Survey ID")
  .setAction(async function (taskArguments: { id: string }, hre: HardhatRuntimeEnvironment) {
    const { ethers, deployments } = hre;
    const SurveyReveal = await deployments.get("SurveyReveal");
    const surveyContract = await ethers.getContractAt("SurveyReveal", SurveyReveal.address);

    const surveyId = parseInt(taskArguments.id);
    const survey = await surveyContract.getSurvey(surveyId);

    console.log(`\nSurvey #${surveyId}:`);
    console.log(`Title: ${survey[0]}`);
    console.log(`Question 1: ${survey[1]}`);
    console.log(`Question 2: ${survey[2]}`);
    console.log(`Question 3: ${survey[3]}`);
    console.log(`Creator: ${survey[4]}`);
    console.log(`Start Time: ${new Date(Number(survey[5]) * 1000).toISOString()}`);
    console.log(`End Time: ${new Date(Number(survey[6]) * 1000).toISOString()}`);
    console.log(`Response Count: ${survey[7]}`);
  });

task("survey:count", "Get total survey count").setAction(
  async function (_taskArguments: unknown, hre: HardhatRuntimeEnvironment) {
    const { ethers, deployments } = hre;
    const SurveyReveal = await deployments.get("SurveyReveal");
    const surveyContract = await ethers.getContractAt("SurveyReveal", SurveyReveal.address);

    const count = await surveyContract.getSurveyCount();
    console.log(`Total surveys: ${count}`);
  },
);

task("survey:submit", "Submit a survey response (for testing)")
  .addParam("id", "Survey ID")
  .setAction(async function (taskArguments: { id: string }, hre: HardhatRuntimeEnvironment) {
    const { ethers, deployments, fhevm } = hre;
    const SurveyReveal = await deployments.get("SurveyReveal");
    const surveyContract = await ethers.getContractAt("SurveyReveal", SurveyReveal.address);
    const signers = await ethers.getSigners();
    const user = signers[1]; // Use second account

    const surveyId = parseInt(taskArguments.id);

    // Create encrypted inputs (example: answer1=1, answer2=1, answer3=4)
    const encryptedInput = await fhevm
      .createEncryptedInput(SurveyReveal.address, user.address)
      .add8(1) // answer1: Yes
      .add8(1) // answer2: Satisfied
      .add8(4) // answer3: Rating 4/5
      .encrypt();

    const tx = await surveyContract
      .connect(user)
      .submitResponse(
        surveyId,
        encryptedInput.handles[0],
        encryptedInput.inputProof,
        encryptedInput.handles[1],
        encryptedInput.inputProof,
        encryptedInput.handles[2],
        encryptedInput.inputProof,
      );

    await tx.wait();
    console.log(`Response submitted for survey #${surveyId} by ${user.address}`);
  });





