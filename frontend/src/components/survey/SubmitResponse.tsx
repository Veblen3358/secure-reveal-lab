import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useChainId } from 'wagmi';
import { getContractAddress } from '../../config/contract';
import { SURVEY_REVEAL_ABI } from '../../abi/SurveyReveal';
import { useFhevm } from '../../hooks/useFhevm';

interface SubmitResponseProps {
  selectedSurveyId: number | null;
}

// Detect question type
function detectQuestionType(question: string): 'yesno' | 'rating' | 'scale' | 'text' {
  const lowerQ = question.toLowerCase();
  
  // Yes/No question
  if (lowerQ.includes('yes') || lowerQ.includes('no') ||
      lowerQ.includes('do you') || lowerQ.includes('are you') ||
      lowerQ.includes('would you')) {
    return 'yesno';
  }
  
  // Rating question (1-5, 1-10, etc.)
  if (lowerQ.match(/\(?\d+\s*-\s*\d+\)?/) ||
      lowerQ.includes('rate') ||
      lowerQ.includes('rating') ||
      lowerQ.includes('scale')) {
    return 'rating';
  }
  
  // Range question
  if (lowerQ.includes('how many') ||
      lowerQ.includes('how much')) {
    return 'scale';
  }
  
  return 'text';
}

// Extract rating range from question
function extractRatingRange(question: string): { min: number; max: number } {
  const match = question.match(/(\d+)\s*-\s*(\d+)/);
  if (match) {
    return { min: parseInt(match[1]), max: parseInt(match[2]) };
  }
  
  // Default 1-5
  return { min: 1, max: 5 };
}

export function SubmitResponse({ selectedSurveyId }: SubmitResponseProps) {
  const { address } = useAccount();
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);
  const { fhevmInstance, isInitializing } = useFhevm();
  const [surveyId, setSurveyId] = useState(selectedSurveyId?.toString() || '');
  const [answers, setAnswers] = useState<number[]>([]);
  const [textInputs, setTextInputs] = useState<string[]>([]);

  const { data: hash, writeContract, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Fetch survey details
  const { data: surveyData } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SURVEY_REVEAL_ABI,
    functionName: 'getSurvey',
    args: [BigInt(surveyId || 0)],
    query: {
      enabled: !!surveyId && surveyId !== '',
    }
  });

  // Check if user has already responded
  const { data: hasResponded } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SURVEY_REVEAL_ABI,
    functionName: 'hasResponded',
    args: [BigInt(surveyId || 0), address as `0x${string}`],
    query: {
      enabled: !!surveyId && !!address,
    }
  });

  // Initialize answers array when survey data is loaded
  useEffect(() => {
    if (surveyData) {
      const questionCount = Number(surveyData[6]);
      setAnswers(new Array(questionCount).fill(0));
      setTextInputs(new Array(questionCount).fill(''));
    }
  }, [surveyData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!address || !fhevmInstance) {
      console.error('[Submit] Please connect your wallet and wait for initialization');
      return;
    }

    if (hasResponded) {
      console.error('[Submit] You have already responded to this survey');
      return;
    }

    if (!surveyData) {
      console.error('[Submit] Please enter a valid survey ID');
      return;
    }

    try {
      console.log('[Submit] Starting encryption...');
      console.log('[Submit] Contract:', contractAddress);
      console.log('[Submit] User:', address);
      console.log('[Submit] Answers:', answers);
      
      // Create encrypted input using builder pattern (like lucky project)
      const builder = fhevmInstance.createEncryptedInput(
        contractAddress as `0x${string}`,
        address as `0x${string}`
      );
      
      // Add all answers - build the chain
      let chain = builder;
      for (const answer of answers) {
        chain = chain.add8(answer);
      }
      
      // Encrypt to get handles
      console.log('[Submit] Calling encrypt...');
      const encrypted = await chain.encrypt();
      console.log('[Submit] Encryption complete!');
      console.log('[Submit] Raw handles:', encrypted.handles);
      console.log('[Submit] Raw inputProof:', encrypted.inputProof);

      // Helper function to convert Uint8Array to hex string
      const toHexString = (bytes: Uint8Array): `0x${string}` => {
        return ('0x' + Array.from(bytes)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('')) as `0x${string}`;
      };

      // Prepare arguments for submitResponse - convert handles to hex strings
      const encryptedAnswers: `0x${string}`[] = [];
      const proofs: `0x${string}`[] = [];
      
      for (let i = 0; i < answers.length; i++) {
        const handle = encrypted.handles[i];
        const hexHandle = toHexString(handle);
        encryptedAnswers.push(hexHandle);
        console.log(`[Submit] Handle ${i}: ${hexHandle}`);
      }
      
      const hexProof = toHexString(encrypted.inputProof);
      console.log('[Submit] Hex proof:', hexProof);
      
      for (let i = 0; i < answers.length; i++) {
        proofs.push(hexProof);
      }

      console.log('[Submit] Final encryptedAnswers:', encryptedAnswers);
      console.log('[Submit] Final proofs:', proofs);
      console.log('[Submit] Submitting to contract...');
      
      // Submit to contract
      writeContract({
        address: contractAddress as `0x${string}`,
        abi: SURVEY_REVEAL_ABI,
        functionName: 'submitResponse',
        args: [
          BigInt(surveyId),
          encryptedAnswers,
          proofs,
        ],
        gas: BigInt(5000000), // Set reasonable gas limit (5M)
      });
    } catch (err) {
      console.error('[Submit] Error:', err);
      console.error('[Submit] Error stack:', err instanceof Error ? err.stack : 'No stack');
      console.error('[Submit] Failed to submit:', err instanceof Error ? err.message : String(err));
    }
  };

  const updateAnswer = (index: number, value: number) => {
    const newAnswers = [...answers];
    newAnswers[index] = value;
    setAnswers(newAnswers);
  };

  const updateTextInput = (index: number, text: string) => {
    const newTextInputs = [...textInputs];
    newTextInputs[index] = text;
    setTextInputs(newTextInputs);
    
    // Convert text to number (using text length or hash modulo)
    // Using simple character code summation modulo 255
    let numValue = 0;
    for (let i = 0; i < text.length; i++) {
      numValue += text.charCodeAt(i);
    }
    numValue = numValue % 256; // Limit to 0-255 range
    
    updateAnswer(index, numValue || 0);
  };

  const renderQuestionInput = (question: string, index: number) => {
    const questionType = detectQuestionType(question);
    
    switch (questionType) {
      case 'yesno':
        return (
          <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
            <button
              type="button"
              onClick={() => updateAnswer(index, 1)}
              style={{
                flex: 1,
                padding: '14px',
                borderRadius: '8px',
                border: answers[index] === 1 ? '2px solid #10b981' : '2px solid #e5e7eb',
                background: answers[index] === 1 ? '#d1fae5' : 'white',
                color: answers[index] === 1 ? '#065f46' : '#6b7280',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontSize: '15px'
              }}
            >
              ✅ Yes
            </button>
            <button
              type="button"
              onClick={() => updateAnswer(index, 0)}
              style={{
                flex: 1,
                padding: '14px',
                borderRadius: '8px',
                border: answers[index] === 0 ? '2px solid #ef4444' : '2px solid #e5e7eb',
                background: answers[index] === 0 ? '#fee2e2' : 'white',
                color: answers[index] === 0 ? '#991b1b' : '#6b7280',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontSize: '15px'
              }}
            >
              ❌ No
            </button>
          </div>
        );
      
      case 'rating':
        const range = extractRatingRange(question);
        const stars = [];
        for (let i = range.min; i <= range.max; i++) {
          stars.push(
            <button
              key={i}
              type="button"
              onClick={() => updateAnswer(index, i)}
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                border: answers[index] === i ? '2px solid #6366f1' : '2px solid #e5e7eb',
                background: answers[index] === i ? '#eef2ff' : 'white',
                color: answers[index] === i ? '#4f46e5' : '#6b7280',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontSize: '15px',
                minWidth: '50px'
              }}
            >
              {i}
            </button>
          );
        }
        return (
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
            {stars}
          </div>
        );
      
      case 'scale':
        return (
          <div style={{ marginTop: '12px' }}>
            <input
              type="range"
              min="0"
              max="100"
              value={answers[index]}
              onChange={(e) => updateAnswer(index, parseInt(e.target.value))}
              style={{
                width: '100%',
                height: '8px',
                borderRadius: '4px',
                outline: 'none',
                cursor: 'pointer'
              }}
            />
            <div style={{ 
              textAlign: 'center', 
              marginTop: '8px', 
              fontSize: '20px', 
              fontWeight: '700',
              color: '#6366f1'
            }}>
              {answers[index]}
            </div>
          </div>
        );
      
      case 'text':
      default:
        return (
          <div style={{ marginTop: '12px' }}>
            <textarea
              value={textInputs[index]}
              onChange={(e) => updateTextInput(index, e.target.value)}
              placeholder="Enter your answer here..."
              rows={3}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '2px solid #e5e7eb',
                fontSize: '15px',
                transition: 'all 0.2s',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit'
              }}
              onFocus={(e) => e.target.style.borderColor = '#6366f1'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
              💡 Your text will be encrypted and stored securely (encoded value: {answers[index]})
            </div>
          </div>
        );
    }
  };

  const containerStyle: React.CSSProperties = {
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '32px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
    maxWidth: '700px',
    margin: '0 auto'
  };

  const headerStyle: React.CSSProperties = {
    fontSize: '24px',
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  };

  const formGroupStyle: React.CSSProperties = {
    marginBottom: '24px'
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '8px',
    fontWeight: '600',
    color: '#374151',
    fontSize: '14px'
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '15px',
    transition: 'all 0.2s',
    outline: 'none'
  };

  const buttonStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: (isPending || isConfirming || !surveyData || hasResponded) ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s',
    opacity: (isPending || isConfirming || !surveyData || hasResponded) ? 0.7 : 1,
    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
  };

  const alertStyle = (type: 'error' | 'success' | 'warning' | 'info'): React.CSSProperties => ({
    padding: '16px',
    borderRadius: '8px',
    marginBottom: '24px',
    background: type === 'error' ? '#fef2f2' : 
                type === 'success' ? '#f0fdf4' : 
                type === 'warning' ? '#fef3c7' : '#dbeafe',
    border: `1px solid ${
      type === 'error' ? '#fecaca' : 
      type === 'success' ? '#bbf7d0' :
      type === 'warning' ? '#fde68a' : '#bfdbfe'
    }`,
    color: type === 'error' ? '#991b1b' : 
           type === 'success' ? '#166534' :
           type === 'warning' ? '#92400e' : '#1e40af'
  });

  const questionBoxStyle: React.CSSProperties = {
    background: '#f9fafb',
    padding: '20px',
    borderRadius: '10px',
    border: '1px solid #e5e7eb',
    marginBottom: '16px'
  };

  const questionTitleStyle: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '4px',
    lineHeight: '1.5'
  };

  return (
    <div style={containerStyle}>
      <h2 style={headerStyle}>
        📮 Submit Survey Response
      </h2>
      
      {isInitializing && (
        <div style={alertStyle('info')}>
          ⏳ Initializing FHEVM encryption...
        </div>
      )}

      {error && (
        <div style={alertStyle('error')}>
          ❌ Error: {error.message}
        </div>
      )}
      
      {isSuccess && (
        <div style={alertStyle('success')}>
          ✅ Response submitted successfully!
          <div style={{ marginTop: '8px', fontSize: '13px', opacity: 0.8 }}>
            Transaction: {hash?.slice(0, 10)}...{hash?.slice(-8)}
          </div>
          <div style={{ marginTop: '4px', fontSize: '13px' }}>
            🔒 Your answers are encrypted and stored securely on-chain.
          </div>
        </div>
      )}

      {hasResponded && (
        <div style={alertStyle('warning')}>
          ⚠️ You have already responded to this survey.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={formGroupStyle}>
          <label htmlFor="surveyId" style={labelStyle}>
            🆔 Survey ID
          </label>
          <input
            id="surveyId"
            type="number"
            min="0"
            value={surveyId}
            onChange={(e) => setSurveyId(e.target.value)}
            placeholder="Enter survey ID"
            required
            style={inputStyle}
          />
        </div>

        {surveyData && (
          <div style={{ marginBottom: '24px' }}>
            <div style={alertStyle('info')}>
              📋 Survey: <strong>{surveyData[0] as string}</strong>
              <div style={{ fontSize: '13px', marginTop: '4px' }}>
                Questions: {Number(surveyData[6])}
              </div>
            </div>

            {(surveyData[1] as string[]).map((question, index) => (
              <div key={index} style={questionBoxStyle}>
                <div style={questionTitleStyle}>
                  ❓ Question {index + 1}
                </div>
                <div style={{ fontSize: '15px', color: '#4b5563', marginBottom: '8px' }}>
                  {question}
                </div>
                {renderQuestionInput(question, index)}
              </div>
            ))}
          </div>
        )}

        {!surveyData && surveyId && (
          <div style={alertStyle('warning')}>
            ⚠️ Survey not found or invalid Survey ID
          </div>
        )}

        <button 
          type="submit" 
          style={buttonStyle}
          disabled={isPending || isConfirming || isInitializing || !fhevmInstance || hasResponded || !surveyData}
        >
          {isPending || isConfirming ? '⏳ Submitting...' : '🔒 Submit Response (Encrypted)'}
        </button>
      </form>
    </div>
  );
}
