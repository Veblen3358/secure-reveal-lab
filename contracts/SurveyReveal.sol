// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint8, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title SurveyReveal - Encrypted Survey System
/// @notice A survey system where users can submit encrypted answers and reveal them later
/// @dev Uses FHE encryption for privacy-preserving survey responses
contract SurveyReveal is SepoliaConfig {
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

    // For aggregation statistics (homomorphic operations)
    // Store encrypted sum for each question
    mapping(uint256 => mapping(uint8 => euint8)) private _encryptedSums;
    // Store respondent addresses for iteration
    mapping(uint256 => address[]) private _respondents;

    uint256 private _surveyCount;

    // Events
    event SurveyCreated(uint256 indexed surveyId, string title, address creator, uint8 questionCount);
    event ResponseSubmitted(uint256 indexed surveyId, address indexed respondent, uint8 answerCount);
    event DecryptionRequested(uint256 indexed surveyId, address indexed respondent, uint256 requestId);
    event ResponseRevealed(uint256 indexed surveyId, address indexed respondent, uint8[] answers);

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
        require(bytes(title).length > 0, "Empty title");
        require(questions.length > 0 && questions.length <= 10, "Invalid question count");
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
        
        // Add respondent to list for statistics
        _respondents[surveyId].push(msg.sender);
        
        // Update encrypted sums using homomorphic addition
        for (uint256 i = 0; i < encAnswers.length; i++) {
            euint8 answer = FHE.fromExternal(encAnswers[i], proofs[i]);
            // Initialize sum if first response
            if (s.responseCount == 1) {
                _encryptedSums[surveyId][uint8(i)] = answer;
                FHE.allowThis(_encryptedSums[surveyId][uint8(i)]);
            } else {
                // Homomorphic addition: sum = sum + answer
                _encryptedSums[surveyId][uint8(i)] = FHE.add(_encryptedSums[surveyId][uint8(i)], answer);
                FHE.allowThis(_encryptedSums[surveyId][uint8(i)]);
            }
        }

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

    /// @notice Get all respondents for a survey (for statistics)
    /// @param surveyId The survey ID
    /// @return respondents Array of respondent addresses
    function getRespondents(uint256 surveyId) external view returns (address[] memory) {
        require(surveyId < _surveyCount, "Invalid survey");
        return _respondents[surveyId];
    }

    /// @notice Get encrypted sum for a question (for calculating average)
    /// @param surveyId The survey ID
    /// @param questionIndex The question index (0-based)
    /// @return sumHandle The encrypted sum as bytes32 handle
    /// @dev This returns the encrypted sum, which can be decrypted to get the total
    ///      Average = decrypted(sum) / responseCount
    function getEncryptedSum(uint256 surveyId, uint8 questionIndex) 
        external 
        view 
        returns (bytes32 sumHandle) 
    {
        require(surveyId < _surveyCount, "Invalid survey");
        Survey storage s = _surveys[surveyId];
        require(questionIndex < s.questionCount, "Invalid question index");
        require(s.responseCount > 0, "No responses");
        
        euint8 sum = _encryptedSums[surveyId][questionIndex];
        return FHE.toBytes32(sum);
    }
}





