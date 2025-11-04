import { ethers } from "hardhat";
import { SurveyReveal } from "../types";

async function main() {
  const CONTRACT_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  
  // Import FHEVM utilities for browser environment
  const { MockFhevmInstance } = await import("@fhevm/mock-utils");
  
  const [deployer, alice] = await ethers.getSigners();
  console.log("Submitting response from Alice:", alice.address);

  // Get contract instance
  const surveyContract = await ethers.getContractAt("SurveyReveal", CONTRACT_ADDRESS) as SurveyReveal;

  // Get survey details
  const surveyCount = await surveyContract.getSurveyCount();
  console.log("Total surveys:", surveyCount.toString());

  if (surveyCount === 0n) {
    console.log("No surveys found. Creating a test survey first...");
    
    // Create a test survey
    const currentTime = Math.floor(Date.now() / 1000);
    const questions = ["Question 1", "Question 2", "Question 3"];
    const tx = await surveyContract.createSurvey(
      "Test Survey",
      questions,
      BigInt(currentTime),
      BigInt(currentTime + 86400)
    );
    await tx.wait();
    console.log("Test survey created!");
  }

  // Submit a response to survey 0
  const surveyId = 0;
  const survey = await surveyContract.getSurvey(surveyId);
  console.log("\nSurvey details:");
  console.log("- Title:", survey.title);
  console.log("- Questions:", survey.questions);
  console.log("- Question count:", survey.questionCount);

  // Check if Alice has already responded
  const hasResponded = await surveyContract.hasResponded(surveyId, alice.address);
  if (hasResponded) {
    console.log("\n❌ Alice has already responded to this survey");
    return;
  }

  // Initialize FHEVM mock instance
  console.log("\nInitializing FHEVM mock...");
  const provider = ethers.provider;
  const fhevmInstance = await MockFhevmInstance.create(provider as any);
  console.log("FHEVM mock initialized");

  // Create encrypted responses
  console.log("\nCreating encrypted responses...");
  const answer1 = 1;
  const answer2 = 1;
  const answer3 = 5;

  const input = fhevmInstance.createEncryptedInput(CONTRACT_ADDRESS, alice.address);
  input.add8(answer1);
  input.add8(answer2);
  input.add8(answer3);
  const encryptedInput = await input.encrypt();

  console.log("Encrypted handles:", encryptedInput.handles);

  // Submit response
  console.log("\nSubmitting response...");
  const submitTx = await surveyContract.connect(alice).submitResponse(
    surveyId,
    [encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.handles[2]],
    [encryptedInput.inputProof, encryptedInput.inputProof, encryptedInput.inputProof]
  );
  await submitTx.wait();

  console.log("✅ Response submitted successfully!");
  console.log("\nYou can now decrypt the response using:");
  console.log("- Survey ID:", surveyId);
  console.log("- Respondent Address:", alice.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

