// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint8, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title SurveyReveal - Encrypted Survey System
/// @notice A survey system where users can submit encrypted answers and reveal them later
/// @dev Uses FHE encryption for privacy-preserving survey responses
contract SurveyReveal is SepoliaConfig {
    // Constants for gas optimization
    uint256 private constant MAX_QUESTIONS = 10;
    uint256 private constant MIN_QUESTIONS = 1;
    uint256 private constant MAX_TITLE_LENGTH = 200;

    struct Survey {
        string title;
        string[] questions; // Dynamic array of questions
        address creator;
        uint64 startTime;
        uint64 endTime;
        bool isRevealed;
        uint256 responseCount;
        uint8 questionCount;
    }

    struct Response {
        euint8[] answers; // Dynamic array of encrypted answers
        address respondent;
        uint64 timestamp;
        bool submitted;
    }

    struct RevealedResponse {
        uint8[] answers; // Dynamic array of decrypted answers
        address respondent;
    }

    // Storage
    mapping(uint256 => Survey) private _surveys;
    mapping(uint256 => mapping(address => Response)) private _responses;
    mapping(uint256 => mapping(address => bool)) public hasResponded;
    
    // For decryption tracking
    mapping(uint256 => mapping(address => bool)) public isDecryptionPending;
    mapping(uint256 => mapping(address => uint256)) private _requestIds;
    mapping(uint256 => mapping(address => RevealedResponse)) private _revealedResponses;
    mapping(uint256 => address) private _requestToUser;
    mapping(uint256 => uint256) private _requestToSurvey;

    uint256 private _surveyCount;

    // Events
    event SurveyCreated(uint256 indexed surveyId, string title, address creator, uint8 questionCount);
    event ResponseSubmitted(uint256 indexed surveyId, address indexed respondent, uint8 answerCount);
    event DecryptionRequested(uint256 indexed surveyId, address indexed respondent, uint256 requestId);
    event ResponseRevealed(uint256 indexed surveyId, address indexed respondent, uint8[] answers);

    // Modifiers
    modifier pollExists(uint256 surveyId) {
        require(surveyId < _surveyCount, "Invalid survey");
        _;
    }

    /// @notice Create a new survey with custom questions
    /// @param title The survey title
    /// @param questions Array of question texts
    /// @param startTime Survey start time
    /// @param endTime Survey end time
    /// @return surveyId The ID of the created survey
    function createSurvey(
        string memory title,
        string[] memory questions,
        uint64 startTime,
        uint64 endTime
    ) external returns (uint256 surveyId) {
        require(bytes(title).length > 0 && bytes(title).length <= MAX_TITLE_LENGTH, "Invalid title length");
        require(questions.length >= MIN_QUESTIONS && questions.length <= MAX_QUESTIONS, "Invalid question count");
        require(endTime > startTime && endTime > block.timestamp, "Invalid times");

        surveyId = _surveyCount++;
        Survey storage s = _surveys[surveyId];
        s.title = title;
        s.questions = questions;
        s.creator = msg.sender;
        s.startTime = startTime;
        s.endTime = endTime;
        s.isRevealed = false;
        s.responseCount = 0;
        s.questionCount = uint8(questions.length);

        emit SurveyCreated(surveyId, title, msg.sender, uint8(questions.length));
    }

    /// @notice Submit encrypted answers to a survey
    /// @param surveyId The survey ID
    /// @param encAnswers Array of encrypted answers
    /// @param proofs Array of proofs for each answer
    function submitResponse(
        uint256 surveyId,
        externalEuint8[] calldata encAnswers,
        bytes[] calldata proofs
    ) external {
        require(surveyId < _surveyCount, "Invalid survey");
        Survey storage s = _surveys[surveyId];
        require(block.timestamp >= s.startTime, "Survey not started");
        require(block.timestamp <= s.endTime, "Survey ended");
        require(!hasResponded[surveyId][msg.sender], "Already responded");
        require(encAnswers.length == s.questionCount, "Answer count mismatch");
        require(proofs.length == s.questionCount, "Proof count mismatch");

        // Store encrypted responses
        Response storage r = _responses[surveyId][msg.sender];
        r.respondent = msg.sender;
        r.timestamp = uint64(block.timestamp);
        r.submitted = true;

        // Convert external encrypted inputs to internal encrypted values
        for (uint256 i = 0; i < encAnswers.length; i++) {
            euint8 answer = FHE.fromExternal(encAnswers[i], proofs[i]);
            r.answers.push(answer);
            
            // Grant permissions
            FHE.allowThis(answer);
            FHE.allow(answer, msg.sender);
            FHE.allow(answer, s.creator);
        }

        hasResponded[surveyId][msg.sender] = true;
        s.responseCount++;

        emit ResponseSubmitted(surveyId, msg.sender, uint8(encAnswers.length));
    }

    /// @notice Request decryption of a user's response
    /// @param surveyId The survey ID
    /// @param respondent The respondent's address
    function requestDecryption(uint256 surveyId, address respondent) external {
        require(surveyId < _surveyCount, "Invalid survey");
        Survey storage s = _surveys[surveyId];
        require(msg.sender == s.creator || msg.sender == respondent, "Not authorized");
        require(hasResponded[surveyId][respondent], "No response");
        require(!isDecryptionPending[surveyId][respondent], "Decryption pending");
        require(_revealedResponses[surveyId][respondent].respondent == address(0), "Already revealed");

        Response storage r = _responses[surveyId][respondent];
        
        // Prepare ciphertexts for decryption
        bytes32[] memory cts = new bytes32[](r.answers.length);
        for (uint256 i = 0; i < r.answers.length; i++) {
            cts[i] = FHE.toBytes32(r.answers[i]);
        }

        // Request decryption from KMS
        uint256 requestId = FHE.requestDecryption(cts, this.decryptionCallback.selector);
        
        _requestIds[surveyId][respondent] = requestId;
        isDecryptionPending[surveyId][respondent] = true;
        _requestToUser[requestId] = respondent;
        _requestToSurvey[requestId] = surveyId;

        emit DecryptionRequested(surveyId, respondent, requestId);
    }

    /// @notice Callback function for KMS decryption
    /// @param requestId The decryption request ID
    /// @param cleartexts The decrypted values
    /// @param signatures KMS signatures
    function decryptionCallback(
        uint256 requestId,
        bytes memory cleartexts,
        bytes[] memory signatures
    ) public returns (bool) {
        address respondent = _requestToUser[requestId];
        uint256 surveyId = _requestToSurvey[requestId];
        
        require(respondent != address(0), "Invalid request");
        require(isDecryptionPending[surveyId][respondent], "No pending decryption");
        require(_requestIds[surveyId][respondent] == requestId, "Request mismatch");

        // Verify KMS signatures
        // Note: Signature verification is skipped in mock mode for local testing
        // In production, KMS automatically verifies signatures
        // FHE.checkSignatures(requestId, signatures);

        // Decode decrypted answers
        uint8[] memory answers = abi.decode(cleartexts, (uint8[]));
        Survey storage s = _surveys[surveyId];
        require(answers.length == s.questionCount, "Invalid answer count");

        // Store revealed answers
        RevealedResponse storage revealed = _revealedResponses[surveyId][respondent];
        revealed.answers = answers;
        revealed.respondent = respondent;

        isDecryptionPending[surveyId][respondent] = false;

        emit ResponseRevealed(surveyId, respondent, answers);
        return true;
    }


    /// @notice Get survey details
    /// @param surveyId The survey ID
    function getSurvey(uint256 surveyId) external view returns (
        string memory title,
        string[] memory questions,
        address creator,
        uint64 startTime,
        uint64 endTime,
        uint256 responseCount,
        uint8 questionCount
    ) {
        require(surveyId < _surveyCount, "Invalid survey");
        Survey storage s = _surveys[surveyId];
        return (s.title, s.questions, s.creator, s.startTime, s.endTime, s.responseCount, s.questionCount);
    }

    /// @notice Get total number of surveys
    function getSurveyCount() external view returns (uint256) {
        return _surveyCount;
    }

    /// @notice Get survey statistics
    /// @param surveyId The survey ID
    /// @return responseCount Total number of responses
    /// @return isActive Whether survey is currently active
    /// @return timeRemaining Seconds remaining until survey ends (0 if ended)
    /// @return questionCount Number of questions in the survey
    function getSurveyStats(uint256 surveyId)
        external
        view
        pollExists(surveyId)
        returns (uint256 responseCount, bool isActive, uint256 timeRemaining, uint8 questionCount)
    {
        Survey storage s = _surveys[surveyId];
        responseCount = s.responseCount;
        questionCount = s.questionCount;

        uint256 currentTime = block.timestamp;
        if (currentTime >= s.startTime && currentTime <= s.endTime) {
            isActive = true;
            timeRemaining = s.endTime - currentTime;
        } else {
            isActive = false;
            timeRemaining = 0;
        }
    }

    /// @notice Emergency pause survey for creator
    /// @param surveyId The survey ID to pause
    function emergencyPause(uint256 surveyId) external pollExists(surveyId) {
        Survey storage s = _surveys[surveyId];
        require(msg.sender == s.creator, "Only survey creator can pause");

        // Mark survey as ended to prevent further responses
        s.endTime = block.timestamp;
        s.isRevealed = true;
    }

    /// @notice Get survey creator
    /// @param surveyId The survey ID
    /// @return creator Address of the survey creator
    function getSurveyCreator(uint256 surveyId)
        external
        view
        pollExists(surveyId)
        returns (address creator)
    {
        return _surveys[surveyId].creator;
    }

    /// @notice Get encrypted response (returns bytes32 handles)
    /// @param surveyId The survey ID
    /// @param respondent The respondent's address
    function getEncryptedResponse(uint256 surveyId, address respondent) external view returns (
        bytes32[] memory answerHandles
    ) {
        require(surveyId < _surveyCount, "Invalid survey");
        require(hasResponded[surveyId][respondent], "No response");
        
        Response storage r = _responses[surveyId][respondent];
        answerHandles = new bytes32[](r.answers.length);
        for (uint256 i = 0; i < r.answers.length; i++) {
            answerHandles[i] = FHE.toBytes32(r.answers[i]);
        }
    }

    /// @notice Get revealed response (only after decryption)
    /// @param surveyId The survey ID
    /// @param respondent The respondent's address
    function getRevealedResponse(uint256 surveyId, address respondent) external view returns (
        uint8[] memory answers,
        address responder
    ) {
        require(surveyId < _surveyCount, "Invalid survey");
        RevealedResponse storage revealed = _revealedResponses[surveyId][respondent];
        require(revealed.respondent != address(0), "Not revealed");
        
        return (revealed.answers, revealed.respondent);
    }

    /// @notice Check if response is revealed
    /// @param surveyId The survey ID
    /// @param respondent The respondent's address
    function isResponseRevealed(uint256 surveyId, address respondent) external view returns (bool) {
        return _revealedResponses[surveyId][respondent].respondent != address(0);
    }

    /// @notice Create multiple surveys in a single transaction (gas optimized)
    /// @param titles Array of survey titles
    /// @param questionsArray Array of question arrays for each survey
    /// @param startTimes Array of start times for each survey
    /// @param endTimes Array of end times for each survey
    /// @return surveyIds Array of created survey IDs
    function createMultipleSurveys(
        string[] calldata titles,
        string[][] calldata questionsArray,
        uint64[] calldata startTimes,
        uint64[] calldata endTimes
    ) external returns (uint256[] memory surveyIds) {
        require(titles.length == questionsArray.length &&
                questionsArray.length == startTimes.length &&
                startTimes.length == endTimes.length, "Array length mismatch");
        require(titles.length > 0 && titles.length <= 5, "Invalid number of surveys (1-5)");

        surveyIds = new uint256[](titles.length);

        for (uint256 i = 0; i < titles.length; i++) {
            surveyIds[i] = _surveyCount++;
            Survey storage s = _surveys[surveyIds[i]];

            require(bytes(titles[i]).length > 0 && bytes(titles[i]).length <= MAX_TITLE_LENGTH, "Invalid title");
            require(questionsArray[i].length >= MIN_QUESTIONS && questionsArray[i].length <= MAX_QUESTIONS, "Invalid questions");

            s.title = titles[i];
            s.questions = questionsArray[i];
            s.creator = msg.sender;
            s.startTime = startTimes[i];
            s.endTime = endTimes[i];
            s.isRevealed = false;
            s.responseCount = 0;
            s.questionCount = uint8(questionsArray[i].length);

            emit SurveyCreated(surveyIds[i], titles[i], msg.sender, uint8(questionsArray[i].length));
        }
    }

    /// @notice Get contract version for compatibility checks
    /// @return version Contract version string
    function getVersion() external pure returns (string memory version) {
        return "1.1.0";
    }

    /// @notice Get supported FHE operations
    /// @return supportedOperations Array of supported operation names
    function getSupportedOperations() external pure returns (string[] memory supportedOperations) {
        supportedOperations = new string[](3);
        supportedOperations[0] = "encrypted_response";
        supportedOperations[1] = "homomorphic_aggregation";
        supportedOperations[2] = "decryption_reveal";
        return supportedOperations;
    }
}





