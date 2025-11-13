# FHE Survey & Reveal System

A privacy-preserving survey platform built with Fully Homomorphic Encryption (FHE) using Zama's fhEVM technology, enabling encrypted response submission with selective decryption.

## 🚀 Live Demo

**Deployed Application**: [https://secure-reveal.vercel.app/](https://secure-reveal.vercel.app/)

📹 **Demo Video**: [Watch the demo](https://github.com/Veblen3358/secure-reveal-lab/raw/main/secure-reveal.mp4)

## Features

- **Encrypted Survey Responses**: All answers are encrypted on-chain using FHE technology
- **Dynamic Surveys**: Create surveys with custom questions (1-10 questions) with gas optimization
- **Batch Survey Creation**: Create multiple surveys in a single transaction for efficiency
- **Survey Statistics**: Real-time response count and survey status tracking
- **Emergency Controls**: Survey creators can pause surveys for security reasons
- **Survey Filtering**: Advanced filtering system for better survey management
- **Selective Decryption**: Survey creators can request decryption of individual responses
- **Privacy-Preserving**: Individual answers remain encrypted until explicitly revealed
- **Time-Bounded**: Surveys have defined start and end times
- **Transparent Verification**: KMS-verified decryption ensures authenticity

## 🔐 Core Smart Contract

### SurveyReveal.sol

The main contract implements fully encrypted surveys using Zama's FHEVM:

```solidity
contract SurveyReveal is SepoliaConfig {
    struct Survey {
        string title;
        string[] questions;
        address creator;
        uint64 startTime;
        uint64 endTime;
        uint256 responseCount;
        uint8 questionCount;
    }

    struct Response {
        euint8[] answers;     // Encrypted answers
        address respondent;
        uint64 timestamp;
        bool submitted;
    }

    struct RevealedResponse {
        uint8[] answers;      // Decrypted answers
        address respondent;
    }
    
    // Create a new encrypted survey
    function createSurvey(
        string memory title,
        string[] memory questions,
        uint64 startTime,
        uint64 endTime
    ) external returns (uint256 surveyId);
    
    // Submit encrypted responses
    function submitResponse(
        uint256 surveyId,
        externalEuint8[] calldata encAnswers,
        bytes[] calldata proofs
    ) external;
    
    // Request response decryption
    function requestDecryption(
        uint256 surveyId,
        address respondent
    ) external;
    
    // KMS callback for decryption
    function decryptionCallback(
        uint256 requestId,
        bytes memory cleartexts,
        bytes[] memory signatures
    ) public returns (bool);
}
```

**Key Privacy Features:**
- ✅ Answers stored as `euint8[]` (encrypted integers)
- ✅ Responses remain encrypted during survey period
- ✅ Only authorized users can request decryption
- ✅ KMS-verified selective reveal after survey ends

## 🔒 Encryption & Decryption Flow

### Client-Side Encryption

Before submitting a response, the frontend encrypts each answer:

```typescript
// 1. Initialize FHEVM instance
const fhevmInstance = await createInstance({
  chainId: sepoliaChainId,
  publicKey: await contract.getPublicKey()
});

// 2. Encrypt each answer (0-255 range for euint8)
const encryptedInput = await fhevmInstance.createEncryptedInput(
  contractAddress,
  userAddress
);

// Add each answer
for (const answer of answers) {
  encryptedInput.add8(answer);  // Encrypt as euint8
}

const encryptedData = await encryptedInput.encrypt();

// 3. Submit with zero-knowledge proofs
await contract.submitResponse(
  surveyId,
  encryptedData.handles,    // Encrypted handles
  encryptedData.inputProof  // ZK proof
);
```

### On-Chain Encrypted Storage

The smart contract stores and processes encrypted data without decryption:

```solidity
// Convert external encrypted inputs to internal encrypted values
for (uint256 i = 0; i < encAnswers.length; i++) {
    euint8 answer = FHE.fromExternal(encAnswers[i], proofs[i]);
    r.answers.push(answer);
    
    // Grant permissions for encrypted data access
    FHE.allowThis(answer);          // Contract can read
    FHE.allow(answer, msg.sender);  // User can read their own
    FHE.allow(answer, s.creator);   // Creator can read
}

// Answers are stored as euint8[] - fully encrypted on-chain
```

### Selective Decryption

Only authorized users can request decryption via the KMS oracle:

```solidity
function requestDecryption(uint256 surveyId, address respondent) external {
    require(msg.sender == s.creator || msg.sender == respondent, "Not authorized");
    
    // Prepare ciphertexts for decryption
    Response storage r = _responses[surveyId][respondent];
    bytes32[] memory cts = new bytes32[](r.answers.length);
    for (uint256 i = 0; i < r.answers.length; i++) {
        cts[i] = FHE.toBytes32(r.answers[i]);
    }
    
    // Request batch decryption from KMS
    uint256 requestId = FHE.requestDecryption(
        cts,
        this.decryptionCallback.selector
    );
}

// KMS callback with decrypted values
function decryptionCallback(
    uint256 requestId,
    bytes memory cleartexts,
    bytes[] memory signatures
) public returns (bool) {
    // Decode decrypted answers
    uint8[] memory answers = abi.decode(cleartexts, (uint8[]));
    
    // Store revealed answers
    RevealedResponse storage revealed = _revealedResponses[surveyId][respondent];
    revealed.answers = answers;
    revealed.respondent = respondent;
    
    emit ResponseRevealed(surveyId, respondent, answers);
}
```

### Privacy Guarantees

| Data | During Survey | After Decryption Request |
|------|---------------|-------------------------|
| **Individual Answers** | ✅ Encrypted (`euint8[]`) | ✅ Selectively revealed |
| **Response Count** | ❌ Public (`uint256`) | ❌ Public |
| **Respondent Address** | ⚠️ Public (on-chain) | ⚠️ Public |
| **Survey Questions** | ❌ Public (`string[]`) | ❌ Public |
| **Answer Values** | ✅ Fully encrypted | ❌ Decrypted to `uint8[]` |

### Key Homomorphic Operations

While not performing computations on encrypted data in this contract, the FHEVM enables:

```solidity
// Encrypted comparison (if needed)
ebool isEqual = FHE.eq(encryptedAnswer1, encryptedAnswer2);

// Encrypted addition (for aggregation)
euint8 sum = FHE.add(encryptedAnswer1, encryptedAnswer2);

// Conditional selection
euint8 result = FHE.select(condition, valueIfTrue, valueIfFalse);

// Range checks
ebool isValid = FHE.lt(encryptedAnswer, FHE.asEuint8(10));
```

## Tech Stack

### Backend
- **Solidity**: Smart contracts using fhEVM
- **Hardhat**: Development environment
- **TypeScript**: Testing and deployment scripts
- **FHEVM**: Zama's Fully Homomorphic Encryption library

### Frontend
- **Vite + React**: Modern frontend framework
- **TypeScript**: Type-safe development
- **Wagmi + RainbowKit**: Wallet connection
- **Tailwind CSS**: Styling
- **fhevmjs**: Client-side encryption

## Project Structure

```
secure-reveal/
├── contracts/               # Solidity smart contracts
│   └── SurveyReveal.sol
├── test/                   # Test files
│   ├── SurveyReveal.ts
│   └── SurveyRevealSepolia.ts
├── deploy/                 # Deployment scripts
│   └── deploy.ts
├── tasks/                  # Hardhat tasks
│   ├── accounts.ts
│   ├── SurveyReveal.ts
│   └── submitResponse.ts
├── scripts/                # Helper scripts
│   └── submit-test-response.ts
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   │   ├── Header.tsx
│   │   │   ├── SurveyApp.tsx
│   │   │   └── survey/
│   │   │       ├── CreateSurvey.tsx
│   │   │       ├── SurveyList.tsx
│   │   │       ├── SubmitResponse.tsx
│   │   │       └── ViewResponses.tsx
│   │   ├── config/        # Configuration
│   │   │   ├── wagmi.ts
│   │   │   └── contract.ts
│   │   ├── hooks/         # Custom hooks
│   │   │   └── useFhevm.ts
│   │   ├── abi/           # Contract ABIs
│   │   └── App.tsx
│   └── vite.config.ts
└── hardhat.config.ts      # Hardhat configuration
```

## Getting Started

### Prerequisites

- Node.js >= 20
- npm >= 7.0.0
- MetaMask or compatible Web3 wallet

### Installation

1. **Install backend dependencies:**
```bash
cd secure-reveal
npm install
```

2. **Install frontend dependencies:**
```bash
cd frontend
npm install
```

### Setup

1. **Configure Hardhat:**
```bash
npx hardhat vars setup
```

Set the following variables:
- `MNEMONIC`: Your wallet mnemonic
- `INFURA_API_KEY`: Infura API key for Sepolia

2. **Update WalletConnect Project ID:**

Edit `frontend/src/config/wagmi.ts` and add your WalletConnect project ID:
```typescript
projectId: "YOUR_PROJECT_ID", // Get from https://cloud.walletconnect.com
```

### Local Development

1. **Start local Hardhat node:**
```bash
npx hardhat node
```

2. **Deploy contracts (in another terminal):**
```bash
npx hardhat deploy --network localhost
```

3. **Generate ABI and start frontend:**
```bash
cd frontend
npm run dev
```

4. **Open browser:**
Navigate to `http://localhost:5173`

### Testing

**Run local tests:**
```bash
npm test
```

**Run Sepolia tests:**
```bash
npm run test:sepolia
```

### Deployment

**Deploy to Sepolia:**
```bash
npx hardhat deploy --network sepolia
```

After deployment, the frontend will automatically use the deployed contract address.

## Usage

### Creating a Survey

1. Connect your wallet using the button in the header
2. Navigate to "Create Survey"
3. Enter survey title and add questions
4. Set start and end times
5. Submit transaction to create the survey

### Submitting a Response

1. Browse available surveys
2. Click on a survey to view details
3. Answer all questions (values 0-255)
4. Click "Submit Response" to encrypt and submit
5. Your answers are encrypted locally before submission

### Viewing Responses

1. Survey creators can view the list of respondents
2. Click "Request Decryption" to reveal a response
3. Wait for KMS oracle to process the request
4. Decrypted answers will be displayed

## Hardhat Tasks

```bash
# Create a survey
npx hardhat task:createSurvey --title "Test Survey" --questions "Q1,Q2,Q3" --duration 3600 --network localhost

# Get survey info
npx hardhat task:getSurvey --surveyid 0 --network localhost

# Get survey count
npx hardhat task:getSurveyCount --network localhost

# Submit a response (test)
npx hardhat task:submitResponse --surveyid 0 --answers "1,2,3" --network localhost

# Request decryption
npx hardhat task:requestDecryption --surveyid 0 --respondent 0x... --network localhost
```

## Security Features

- **FHE Encryption**: Responses are encrypted on-chain using Zama's fhEVM
- **Zero-Knowledge Proofs**: Response submissions include ZK proofs
- **Access Control**: Only authorized users can request decryption
- **KMS Verification**: Decrypted results are cryptographically verified
- **Time-Locked**: Surveys have enforced time boundaries

## Development Notes

- Frontend uses RainbowKit for wallet connections
- All code and documentation in English
- Custom logo and branding included
- Supports both localhost and Sepolia testnet
- Full MVP with survey creation, submission, and selective reveal

## License

BSD-3-Clause-Clear

## Resources

- [Zama fhEVM Documentation](https://docs.zama.ai/fhevm)
- [RainbowKit Documentation](https://www.rainbowkit.com/)
- [Hardhat Documentation](https://hardhat.org/)
- [Vite Documentation](https://vitejs.dev/)

## Support

For issues and questions, please open an issue on GitHub.


