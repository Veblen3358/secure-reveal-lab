import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi';
import { getContractAddress } from '../../config/contract';
import { SURVEY_REVEAL_ABI } from '../../abi/SurveyReveal';

interface CreateSurveyProps {
  onSurveyCreated?: () => void;
}

export function CreateSurvey({ onSurveyCreated }: CreateSurveyProps) {
  const { address } = useAccount();
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);
  const [title, setTitle] = useState('');
  const [durationDays, setDurationDays] = useState(7);
  const [questions, setQuestions] = useState<string[]>(['', '', '']);
  
  const { data: hash, writeContract, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // When survey is created successfully, reset form and switch to list view
  useEffect(() => {
    if (isSuccess) {
      // Reset form
      setTitle('');
      setQuestions(['', '', '']);
      setDurationDays(7);
      // Switch to list view immediately
      if (onSurveyCreated) {
        onSurveyCreated();
      }
    }
  }, [isSuccess, onSurveyCreated]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!address) {
      console.error('[CreateSurvey] Please connect your wallet');
      return;
    }

    // Validate all questions are filled
    const validQuestions = questions.filter(q => q.trim().length > 0);
    if (validQuestions.length === 0) {
      console.error('[CreateSurvey] Please add at least one question');
      return;
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const startTime = currentTime;
    const endTime = currentTime + (durationDays * 24 * 60 * 60);

    try {
      writeContract({
        address: contractAddress as `0x${string}`,
        abi: SURVEY_REVEAL_ABI,
        functionName: 'createSurvey',
        args: [
          title,
          validQuestions, // Now passing array of questions
          BigInt(startTime),
          BigInt(endTime),
        ],
        gas: BigInt(3000000), // Set reasonable gas limit (3M for create)
      });
    } catch (err) {
      console.error('Error creating survey:', err);
    }
  };

  const addQuestion = () => {
    if (questions.length < 10) {
      setQuestions([...questions, '']);
    }
  };

  const removeQuestion = (index: number) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index));
    }
  };

  const updateQuestion = (index: number, value: string) => {
    const newQuestions = [...questions];
    newQuestions[index] = value;
    setQuestions(newQuestions);
  };

  const containerStyle: React.CSSProperties = {
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '32px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
    maxWidth: '600px',
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
    cursor: (isPending || isConfirming) ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s',
    opacity: (isPending || isConfirming) ? 0.7 : 1,
    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
  };

  const alertStyle = (type: 'error' | 'success'): React.CSSProperties => ({
    padding: '16px',
    borderRadius: '8px',
    marginBottom: '24px',
    background: type === 'error' ? '#fef2f2' : '#f0fdf4',
    border: `1px solid ${type === 'error' ? '#fecaca' : '#bbf7d0'}`,
    color: type === 'error' ? '#991b1b' : '#166534'
  });


  return (
    <div style={containerStyle}>
      <h2 style={headerStyle}>
        ✨ Create New Survey
      </h2>
      
      {error && (
        <div style={alertStyle('error')}>
          ❌ Error: {error.message}
        </div>
      )}
      
      {isSuccess && (
        <div style={alertStyle('success')}>
          ✅ Survey created successfully! 
          <div style={{ marginTop: '8px', fontSize: '13px', opacity: 0.8 }}>
            Transaction: {hash?.slice(0, 10)}...{hash?.slice(-8)}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={formGroupStyle}>
          <label htmlFor="title" style={labelStyle}>
            📝 Survey Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Game Feedback Survey 2024"
            required
            style={inputStyle}
          />
        </div>

        <div style={formGroupStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>
              ❓ Questions ({questions.filter(q => q.trim()).length}/10)
            </label>
            <button
              type="button"
              onClick={addQuestion}
              disabled={questions.length >= 10}
              style={{
                padding: '6px 12px',
                background: questions.length >= 10 ? '#e5e7eb' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: questions.length >= 10 ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              ➕ Add Question
            </button>
          </div>
          
          {questions.map((question, index) => (
            <div key={index} style={{ marginBottom: '12px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <textarea
                  value={question}
                  onChange={(e) => updateQuestion(index, e.target.value)}
                  placeholder={`Question ${index + 1}: e.g., Rate the game experience (1-5)`}
                  rows={2}
                  style={{
                    ...inputStyle,
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
              {questions.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeQuestion(index)}
                  style={{
                    padding: '10px 14px',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    height: '48px'
                  }}
                  title="Remove question"
                >
                  🗑️
                </button>
              )}
            </div>
          ))}
          
          <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px' }}>
            💡 Tip: Use numerical scales for responses (e.g., 0/1 for Yes/No, 1-5 for ratings)
          </div>
        </div>

        <div style={formGroupStyle}>
          <label htmlFor="duration" style={labelStyle}>
            ⏱️ Duration (days)
          </label>
          <input
            id="duration"
            type="number"
            min="1"
            max="365"
            value={durationDays}
            onChange={(e) => setDurationDays(Number(e.target.value))}
            required
            style={inputStyle}
          />
          <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '6px' }}>
            Survey will end in {durationDays} day{durationDays > 1 ? 's' : ''}
          </div>
        </div>

        <button 
          type="submit" 
          style={buttonStyle}
          disabled={isPending || isConfirming}
        >
          {isPending || isConfirming ? '⏳ Creating...' : '🚀 Create Survey'}
        </button>
      </form>
    </div>
  );
}





