import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

task("submit-response", "Submit an encrypted response to a survey")
  .addParam("survey", "Survey ID")
  .addOptionalParam("answer1", "Answer 1 (default: 1)", "1")
  .addOptionalParam("answer2", "Answer 2 (default: 1)", "1")
  .addOptionalParam("answer3", "Answer 3 (default: 5)", "5")
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { ethers, fhevm } = hre;
    
    const CONTRACT_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
    const surveyId = parseInt(taskArgs.survey);
    const answer1 = parseInt(taskArgs.answer1);
    const answer2 = parseInt(taskArgs.answer2);
    const answer3 = parseInt(taskArgs.answer3);

    // Get signers
    const [deployer, alice, bob] = await ethers.getSigners();
    const respondent = alice; // Use Alice as the respondent

    console.log("\n📝 Submitting Response");
    console.log("━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Survey ID:", surveyId);
    console.log("Respondent:", respondent.address);
    console.log("Answers:", answer1, answer2, answer3);

    // Get contract
    const surveyContract = await ethers.getContractAt("SurveyReveal", CONTRACT_ADDRESS);

    // Check if already responded
    const hasResponded = await surveyContract.hasResponded(surveyId, respondent.address);
    if (hasResponded) {
      console.log("\n❌ This address has already responded to this survey");
      return;
    }

    // Get survey details
    const survey = await surveyContract.getSurvey(surveyId);
    const questionCount = Number(survey.questionCount);
    console.log("\nSurvey:", survey.title);
    console.log("Questions:", questionCount);

    // Create encrypted input
    console.log("\n🔐 Encrypting responses...");
    const input = fhevm.createEncryptedInput(CONTRACT_ADDRESS, respondent.address);
    
    // Add all answers (pad with 0s if needed)
    const answers = [answer1, answer2, answer3];
    for (let i = 0; i < questionCount; i++) {
      input.add8(answers[i] || 0);
    }
    
    const encryptedInput = await input.encrypt();

    // Prepare handles and proofs
    const handles = [];
    const proofs = [];
    for (let i = 0; i < questionCount; i++) {
      handles.push(encryptedInput.handles[i]);
      proofs.push(encryptedInput.inputProof);
    }

    // Submit response
    console.log("📤 Submitting to contract...");
    const tx = await surveyContract.connect(respondent).submitResponse(
      surveyId,
      handles,
      proofs
    );
    await tx.wait();

    console.log("\n✅ Response submitted successfully!");
    console.log("\n📋 Use these values in 'View Responses':");
    console.log("   Survey ID:", surveyId);
    console.log("   Respondent Address:", respondent.address);
    console.log("\n💡 Go to the frontend and click 'View Responses' to decrypt!");
  });

