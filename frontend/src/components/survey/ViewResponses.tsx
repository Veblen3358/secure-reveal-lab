import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useChainId } from 'wagmi';
import { ethers } from 'ethers';
import { getContractAddress } from '../../config/contract';
import { SURVEY_REVEAL_ABI } from '../../abi/SurveyReveal';
import { useFhevm } from '../../hooks/useFhevm';

export function ViewResponses() {
  const { address } = useAccount();
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);
  const { fhevmInstance } = useFhevm();
  const [surveyId, setSurveyId] = useState('');
  const [decryptedAnswers, setDecryptedAnswers] = useState<number[] | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

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

  // Check if response is revealed - with auto-refresh every 2 seconds
  const { data: isRevealed } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SURVEY_REVEAL_ABI,
    functionName: 'isResponseRevealed',
    args: [BigInt(surveyId || 0), address as `0x${string}`],
    query: {
      enabled: !!surveyId && !!address,
      refetchInterval: 2000, // Auto-refresh every 2 seconds
    }
  });

  // Get revealed response - with auto-refresh every 2 seconds
  const { data: revealedResponse } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SURVEY_REVEAL_ABI,
    functionName: 'getRevealedResponse',
    args: [BigInt(surveyId || 0), address as `0x${string}`],
    query: {
      enabled: !!surveyId && !!address && !!isRevealed,
      refetchInterval: 2000, // Auto-refresh every 2 seconds
    }
  });

  // Get encrypted response
  const { data: encryptedResponse } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SURVEY_REVEAL_ABI,
    functionName: 'getEncryptedResponse',
    args: [BigInt(surveyId || 0), address as `0x${string}`],
    query: {
      enabled: !!surveyId && !!address,
    }
  });

  // Check if decryption is pending - with auto-refresh every 2 seconds
  const { data: isDecryptionPending } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SURVEY_REVEAL_ABI,
    functionName: 'isDecryptionPending',
    args: [BigInt(surveyId || 0), address as `0x${string}`],
    query: {
      enabled: !!surveyId && !!address,
      refetchInterval: 2000, // Auto-refresh every 2 seconds
    }
  });

  // Request decryption (for Sepolia) - keeping for future use
  const { error: decryptError } = useWriteContract();

  // Check if current user is authorized (creator or respondent)
  const isCreator = surveyData && address && (surveyData[2] as string).toLowerCase() === address.toLowerCase();

  // Log isRevealed status changes
  useEffect(() => {
    if (surveyId && address) {
      console.log('[ViewResponses] 🔍 Checking status - Survey:', surveyId, 'Address:', address?.slice(0, 10) + '...');
      console.log('[ViewResponses] isRevealed:', isRevealed);
      console.log('[ViewResponses] isDecryptionPending:', isDecryptionPending);
      console.log('[ViewResponses] Has encrypted response:', !!encryptedResponse);
      console.log('[ViewResponses] Has revealed response:', !!revealedResponse);
    }
  }, [surveyId, address, isRevealed, isDecryptionPending, encryptedResponse, revealedResponse]);
  
  // Log when decryption is complete
  useEffect(() => {
    if (isRevealed) {
      console.log('[ViewResponses] ✅✅✅ DECRYPTION COMPLETE! ✅✅✅');
      console.log('[ViewResponses] Revealed response data:', revealedResponse);
      if (revealedResponse) {
        console.log('[ViewResponses] Answers:', revealedResponse[0]);
        console.log('[ViewResponses] Respondent:', revealedResponse[1]);
      }
    }
  }, [isRevealed, revealedResponse]);

  const handleRequestDecryption = async () => {
    if (!address || !fhevmInstance) {
      console.error('[ViewResponses] Please connect your wallet and wait for FHEVM initialization!');
      return;
    }

    if (!encryptedResponse || (encryptedResponse as string[]).length === 0) {
      console.error('[ViewResponses] No encrypted response found!');
      return;
    }

    if (!window.ethereum) {
      console.error('[ViewResponses] Please install MetaMask!');
      return;
    }

    setIsDecrypting(true);
    
    try {
      console.log('[ViewResponses] 🔓 Starting CLIENT-SIDE decryption (like lucky project)...');
      console.log('[ViewResponses] Encrypted handles:', encryptedResponse);

      // Get signer
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // Step 1: Generate keypair
      const keypair = fhevmInstance.generateKeypair();
      console.log('[ViewResponses] Keypair generated');

      // Step 2: Prepare handle-contract pairs
      const handleContractPairs = (encryptedResponse as string[]).map(handle => ({
        handle: handle,
        contractAddress: contractAddress
      }));
      console.log('[ViewResponses] Handle-contract pairs:', handleContractPairs);

      // Step 3: Create EIP712 signature
      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '7';
      const contractAddresses = [contractAddress];

      const eip712 = fhevmInstance.createEIP712(
        keypair.publicKey,
        contractAddresses,
        startTimeStamp,
        durationDays
      );

      console.log('[ViewResponses] Requesting signature...');
      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message
      );
      console.log('[ViewResponses] Signature obtained');

      // Step 4: User decrypt (CLIENT-SIDE - instant!)
      console.log('[ViewResponses] Calling userDecrypt...');
      const result = await fhevmInstance.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays
      );

      console.log('[ViewResponses] ✅ Decryption result:', result);

      // Extract decrypted values
      const decrypted: number[] = [];
      for (const handle of (encryptedResponse as string[])) {
        const value = result[handle];
        decrypted.push(Number(value));
      }

      console.log('[ViewResponses] ✅✅✅ DECRYPTION COMPLETE! ✅✅✅');
      console.log('[ViewResponses] Decrypted answers:', decrypted);

      // Update state
      setDecryptedAnswers(decrypted);
      setIsDecrypting(false);

    } catch (err) {
      console.error('[ViewResponses] ❌ Decryption error:', err);
      setIsDecrypting(false);
    }
  };


  const containerStyle: React.CSSProperties = {
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '16px',
    padding: '40px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
    maxWidth: '900px',
    margin: '0 auto'
  };

  const headerStyle: React.CSSProperties = {
    fontSize: '32px',
    fontWeight: '700',
    color: '#111827',
    marginBottom: '32px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    paddingBottom: '20px',
    borderBottom: '2px solid #f3f4f6'
  };

  const formGroupStyle: React.CSSProperties = {
    marginBottom: '28px'
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '10px',
    fontWeight: '600',
    color: '#111827',
    fontSize: '15px',
    letterSpacing: '0.01em'
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px 18px',
    borderRadius: '10px',
    border: '2px solid #e5e7eb',
    fontSize: '15px',
    transition: 'all 0.2s',
    outline: 'none',
    fontFamily: 'inherit'
  };

  const buttonStyle = (variant: 'primary' | 'secondary' = 'primary'): React.CSSProperties => ({
    width: '100%',
    padding: '16px 24px',
    background: variant === 'primary' 
      ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
      : '#6b7280',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '700',
    cursor: (isDecrypting || !fhevmInstance) ? 'not-allowed' : 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    opacity: (isDecrypting || !fhevmInstance) ? 0.6 : 1,
    boxShadow: (isDecrypting || !fhevmInstance) ? 'none' : '0 8px 20px rgba(99, 102, 241, 0.25)',
    marginTop: '20px',
    letterSpacing: '0.02em',
    transform: (isDecrypting || !fhevmInstance) ? 'scale(0.98)' : 'scale(1)'
  });

  const alertStyle = (type: 'error' | 'success' | 'warning' | 'info'): React.CSSProperties => ({
    padding: '20px 24px',
    borderRadius: '12px',
    marginBottom: '28px',
    background: type === 'error' ? '#fef2f2' : 
                type === 'success' ? '#f0fdf4' : 
                type === 'warning' ? '#fef3c7' : '#eff6ff',
    border: `2px solid ${
      type === 'error' ? '#fecaca' : 
      type === 'success' ? '#86efac' :
      type === 'warning' ? '#fde68a' : '#93c5fd'
    }`,
    color: type === 'error' ? '#991b1b' : 
           type === 'success' ? '#166534' :
           type === 'warning' ? '#92400e' : '#1e3a8a',
    fontSize: '14px',
    lineHeight: '1.7',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
  });

  const responseBoxStyle = (revealed: boolean): React.CSSProperties => ({
    background: revealed ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' : 'linear-gradient(135deg, #fef3c7 0%, #fef9c3 100%)',
    padding: '32px',
    borderRadius: '16px',
    border: revealed ? '2px solid #4ade80' : '2px solid #facc15',
    marginTop: '32px',
    boxShadow: revealed ? '0 8px 24px rgba(74, 222, 128, 0.15)' : '0 8px 24px rgba(250, 204, 21, 0.15)'
  });

  const answerStyle: React.CSSProperties = {
    background: 'white',
    padding: '20px 24px',
    borderRadius: '12px',
    marginBottom: '16px',
    border: '2px solid #f3f4f6',
    fontSize: '15px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    transition: 'all 0.2s'
  };

  const infoBoxStyle: React.CSSProperties = {
    marginTop: '40px',
    padding: '28px 32px',
    background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
    borderRadius: '16px',
    border: '2px solid #bae6fd',
    boxShadow: '0 4px 12px rgba(56, 189, 248, 0.1)'
  };

  // Determine which answers to display
  const answersToDisplay = decryptedAnswers || (revealedResponse ? (revealedResponse[0] as number[]) : null);

  return (
    <div style={containerStyle}>
      <h2 style={headerStyle}>
        <span style={{ fontSize: '36px' }}>👀</span>
        View Survey Responses
      </h2>

      {decryptError && (
        <div style={alertStyle('error')}>
          ❌ Error: {decryptError.message}
        </div>
      )}

      {isDecrypting && (
        <div style={alertStyle('info')}>
          <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
            ⏳ Decrypting...
          </div>
          <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
            🔓 Client-side decryption in progress...
            <br />
            ⚡ This should only take a few seconds!
            <br />
            💡 Please approve the signature request in MetaMask.
          </div>
        </div>
      )}
      
      {isRevealed && (
        <div style={alertStyle('success')}>
          ✅ <strong>Decryption Complete!</strong> Your response has been successfully decrypted by KMS.
        </div>
      )}
      
      <form onSubmit={(e) => e.preventDefault()}>
        <div style={formGroupStyle}>
          <label htmlFor="viewSurveyId" style={labelStyle}>
            🆔 Survey ID
          </label>
          <input
            id="viewSurveyId"
            type="number"
            min="0"
            value={surveyId}
            onChange={(e) => setSurveyId(e.target.value)}
            placeholder="Enter survey ID"
            style={inputStyle}
          />
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px' }}>
            💡 Will decrypt your response for this survey
          </div>
        </div>
      </form>

      {surveyId && surveyData && (
        <div style={alertStyle('info')}>
          📋 Survey: <strong>{surveyData[0] as string}</strong>
          <div style={{ marginTop: '4px', fontSize: '13px' }}>
            Creator: {(surveyData[2] as string).slice(0, 10)}...{(surveyData[2] as string).slice(-8)}
            {isCreator && <span style={{ marginLeft: '8px', fontWeight: 'bold' }}>👑 (You are the creator)</span>}
          </div>
          <div style={{ fontSize: '13px' }}>
            Questions: {Number(surveyData[6])} | Responses: {Number(surveyData[5])}
          </div>
        </div>
      )}

      {surveyId && encryptedResponse && (
        <>
          {(isRevealed || answersToDisplay) ? (
            <div style={responseBoxStyle(true)}>
              <h3 style={{ 
                marginBottom: '24px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px',
                fontSize: '22px',
                fontWeight: '700',
                color: '#166534'
              }}>
                <span style={{ fontSize: '28px' }}>✅</span>
                Decrypted Response
              </h3>
              {answersToDisplay && surveyData && (
                <>
                  {(surveyData[1] as string[]).map((question, index) => (
                    <div key={index} style={answerStyle}>
                      <div style={{ 
                        fontWeight: '600', 
                        marginBottom: '10px', 
                        color: '#374151',
                        fontSize: '15px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span style={{ 
                          background: '#6366f1',
                          color: 'white',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: '700'
                        }}>
                          Q{index + 1}
                        </span>
                        {question}
                      </div>
                      <div style={{ 
                        fontSize: '24px', 
                        fontWeight: '700', 
                        color: '#10b981',
                        marginLeft: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span style={{ fontSize: '18px', color: '#6b7280', fontWeight: '600' }}>Answer:</span>
                        {answersToDisplay[index]}
                      </div>
                    </div>
                  ))}
                  {revealedResponse && (
                    <div style={{ 
                      fontSize: '13px', 
                      color: '#6b7280', 
                      marginTop: '24px', 
                      paddingTop: '20px', 
                      borderTop: '2px solid #e5e7eb',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span style={{ fontWeight: '600' }}>👤 Respondent:</span>
                      <code style={{ 
                        background: '#f3f4f6',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}>
                        {revealedResponse[1] as string}
                      </code>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div style={responseBoxStyle(false)}>
              <h3 style={{ 
                marginBottom: '24px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px',
                fontSize: '22px',
                fontWeight: '700',
                color: '#92400e'
              }}>
                <span style={{ fontSize: '28px' }}>🔒</span>
                Encrypted Response
              </h3>
              <div style={{
                ...alertStyle('warning'),
                marginBottom: '20px',
                fontSize: '15px',
                fontWeight: '600'
              }}>
                ⚠️ This response is encrypted on-chain. Click below to decrypt instantly!
              </div>
              
              <div style={{ 
                background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)', 
                padding: '24px', 
                borderRadius: '12px', 
                marginTop: '20px',
                border: '2px solid #374151',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}>
                <div style={{ 
                  fontSize: '12px', 
                  color: '#9ca3af', 
                  marginBottom: '16px', 
                  fontFamily: 'monospace',
                  fontWeight: '600',
                  letterSpacing: '0.05em'
                }}>
                  🔐 ENCRYPTED HANDLES (FIRST 40 CHARS):
                </div>
                {(encryptedResponse as string[]).map((handle, index) => (
                  <div key={index} style={{ 
                    fontSize: '12px', 
                    fontFamily: 'monospace', 
                    color: '#34d399', 
                    wordBreak: 'break-all',
                    marginBottom: '12px',
                    padding: '12px',
                    background: 'rgba(52, 211, 153, 0.1)',
                    borderRadius: '8px',
                    border: '1px solid rgba(52, 211, 153, 0.2)'
                  }}>
                    <span style={{ color: '#fbbf24', fontWeight: '600' }}>Answer {index + 1}:</span> {handle.toString().substring(0, 40)}...
                  </div>
                ))}
              </div>
              
              <button 
                onClick={handleRequestDecryption}
                style={buttonStyle('primary')}
                disabled={isDecrypting || !fhevmInstance}
              >
                {isDecrypting ? '🔄 Decrypting...' : 
                 !fhevmInstance ? '⏳ Initializing FHEVM...' :
                 '⚡ Decrypt Now (Instant)'}
              </button>
              
              {!fhevmInstance && (
                <div style={{ marginTop: '12px', padding: '12px', background: '#fef3c7', borderRadius: '6px', fontSize: '13px', color: '#92400e' }}>
                  ⏰ <strong>Initializing FHEVM SDK...</strong>
                  <br />
                  Please wait a moment for the encryption system to load.
                </div>
              )}
            </div>
          )}
        </>
      )}

      {surveyId && !encryptedResponse && !surveyData && (
        <div style={alertStyle('warning')}>
          ⚠️ No response found for this survey and address, or survey does not exist.
        </div>
      )}

      <div style={infoBoxStyle}>
        <h4 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: '600' }}>
          ℹ️ How Decryption Works (Like Lucky Project)
        </h4>
        <div style={{ fontSize: '14px', lineHeight: '1.8', color: '#4b5563' }}>
          <div><strong>🔒 Encryption:</strong> All responses are encrypted with FHE before being stored on-chain</div>
          <div><strong>⚡ Client-Side Decryption:</strong> Decryption happens instantly in your browser using your wallet signature</div>
          <div><strong>🔐 Security:</strong> Only authorized users (with wallet signature) can decrypt the data</div>
          <div><strong>⏱️ Speed:</strong> Decryption completes in just a few seconds!</div>
          <div><strong>🌐 Works on all networks:</strong> Localhost, Sepolia, and any FHEVM-compatible network</div>
        </div>
      </div>
    </div>
  );
}
