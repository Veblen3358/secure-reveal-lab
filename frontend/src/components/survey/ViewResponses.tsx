import { useState, useEffect } from 'react'
import { useAccount, useReadContract, useWriteContract, useChainId } from 'wagmi'
import { ethers } from 'ethers'
import { getContractAddress } from '../../config/contract'
import { SURVEY_REVEAL_ABI } from '../../abi/SurveyReveal'
import { useFhevm } from '../../hooks/useFhevm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Eye, AlertCircle, CheckCircle2, Lock, Unlock, Loader2, Info } from 'lucide-react'

// Detect question type (same logic as SubmitResponse)
function detectQuestionType(question: string): 'yesno' | 'rating' | 'scale' | 'text' {
  const lowerQ = question.toLowerCase()
  
  if (lowerQ.includes('yes') || lowerQ.includes('no') ||
      lowerQ.includes('do you') || lowerQ.includes('are you') ||
      lowerQ.includes('would you')) {
    return 'yesno'
  }
  
  if (lowerQ.match(/\(?\d+\s*-\s*\d+\)?/) ||
      lowerQ.includes('rate') ||
      lowerQ.includes('rating') ||
      lowerQ.includes('scale')) {
    return 'rating'
  }
  
  if (lowerQ.includes('how many') ||
      lowerQ.includes('how much')) {
    return 'scale'
  }
  
  return 'text'
}

export function ViewResponses() {
  const { address } = useAccount()
  const chainId = useChainId()
  const contractAddress = getContractAddress(chainId)
  const { fhevmInstance } = useFhevm()
  const [surveyId, setSurveyId] = useState('')
  const [decryptedAnswers, setDecryptedAnswers] = useState<number[] | null>(null)
  const [isDecrypting, setIsDecrypting] = useState(false)

  const { data: surveyData } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SURVEY_REVEAL_ABI,
    functionName: 'getSurvey',
    args: [BigInt(surveyId || 0)],
    query: {
      enabled: !!surveyId && surveyId !== '',
    }
  })

  const { data: isRevealed } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SURVEY_REVEAL_ABI,
    functionName: 'isResponseRevealed',
    args: [BigInt(surveyId || 0), address as `0x${string}`],
    query: {
      enabled: !!surveyId && !!address,
      refetchInterval: 2000,
    }
  })

  const { data: revealedResponse } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SURVEY_REVEAL_ABI,
    functionName: 'getRevealedResponse',
    args: [BigInt(surveyId || 0), address as `0x${string}`],
    query: {
      enabled: !!surveyId && !!address && !!isRevealed,
      refetchInterval: 2000,
    }
  })


  const { data: encryptedResponse } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SURVEY_REVEAL_ABI,
    functionName: 'getEncryptedResponse',
    args: [BigInt(surveyId || 0), address as `0x${string}`],
    query: {
      enabled: !!surveyId && !!address,
    }
  })

  const { data: isDecryptionPending } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SURVEY_REVEAL_ABI,
    functionName: 'isDecryptionPending',
    args: [BigInt(surveyId || 0), address as `0x${string}`],
    query: {
      enabled: !!surveyId && !!address,
      refetchInterval: 2000,
    }
  })

  const { error: decryptError } = useWriteContract()

  const isCreator = surveyData && address && (surveyData[2] as string).toLowerCase() === address.toLowerCase()

  useEffect(() => {
    if (surveyId && address) {
      console.log('[ViewResponses] 🔍 Checking status - Survey:', surveyId, 'Address:', address?.slice(0, 10) + '...')
      console.log('[ViewResponses] isRevealed:', isRevealed)
      console.log('[ViewResponses] isDecryptionPending:', isDecryptionPending)
    }
  }, [surveyId, address, isRevealed, isDecryptionPending, encryptedResponse, revealedResponse])
  
  useEffect(() => {
    if (isRevealed) {
      console.log('[ViewResponses] ✅✅✅ DECRYPTION COMPLETE! ✅✅✅')
      console.log('[ViewResponses] Revealed response data:', revealedResponse)
    }
  }, [isRevealed, revealedResponse])

  const handleRequestDecryption = async () => {
    if (!address || !fhevmInstance) {
      console.error('[ViewResponses] Please connect your wallet and wait for FHEVM initialization!')
      return
    }

    if (!encryptedResponse || (encryptedResponse as string[]).length === 0) {
      console.error('[ViewResponses] No encrypted response found!')
      return
    }

    if (!window.ethereum) {
      console.error('[ViewResponses] Please install MetaMask!')
      return
    }

    setIsDecrypting(true)
    
    try {
      console.log('[ViewResponses] 🔓 Starting CLIENT-SIDE decryption...')

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()

      const keypair = fhevmInstance.generateKeypair()

      // Ensure handles are in the correct format (with 0x prefix and proper padding)
      const normalizedHandles = (encryptedResponse as string[]).map(handle => {
        // Handle might be bytes32 from contract, ensure it's a proper hex string
        let normalized = handle
        if (!normalized.startsWith('0x')) {
          normalized = `0x${normalized}`
        }
        // Ensure it's 66 characters (0x + 64 hex chars for bytes32)
        if (normalized.length < 66) {
          normalized = normalized.padEnd(66, '0')
        }
        return normalized.toLowerCase() // Use lowercase for consistency
      })

      console.log('[ViewResponses] Original encryptedResponse:', encryptedResponse)
      console.log('[ViewResponses] Normalized handles:', normalizedHandles)

      const handleContractPairs = normalizedHandles.map(handle => ({
        handle: handle as `0x${string}`,
        contractAddress: contractAddress as `0x${string}`
      }))

      const startTimeStamp = Math.floor(Date.now() / 1000).toString()
      const durationDays = '7'
      const contractAddresses = [contractAddress as `0x${string}`]

      const eip712 = fhevmInstance.createEIP712(
        keypair.publicKey,
        contractAddresses,
        startTimeStamp,
        durationDays
      )

      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message
      )

      console.log('[ViewResponses] 🔓 Starting decryption...')
      console.log('[ViewResponses] Original encryptedResponse:', encryptedResponse)
      console.log('[ViewResponses] Normalized handles:', normalizedHandles)
      console.log('[ViewResponses] HandleContractPairs:', handleContractPairs.map(p => ({
        handle: String(p.handle),
        handleLength: String(p.handle).length,
        contractAddress: p.contractAddress
      })))

      const result = await fhevmInstance.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays
      )

      console.log('[ViewResponses] Decryption result:', result)
      console.log('[ViewResponses] Result keys:', Object.keys(result))
      console.log('[ViewResponses] Result keys (lowercase):', Object.keys(result).map(k => k.toLowerCase()))
      console.log('[ViewResponses] Result entries:', Object.entries(result).map(([k, v]) => [k.toLowerCase(), v]))
      console.log('[ViewResponses] Result type:', typeof result)
      
      // Log detailed comparison
      console.log('[ViewResponses] 🔍 Detailed handle comparison:')
      handleContractPairs.forEach((pair, idx) => {
        const handle = String(pair.handle).toLowerCase()
        const resultKey = Object.keys(result).find(k => k.toLowerCase() === handle)
        console.log(`  Handle ${idx}: ${handle} (length: ${handle.length})`)
        console.log(`    Matched result key: ${resultKey || 'NOT FOUND'}`)
        console.log(`    Value: ${resultKey ? result[resultKey] : 'N/A'}`)
      })

      const decrypted: number[] = []
      
      // Get all result values in order
      const resultKeys = Object.keys(result)
      const resultValues = Object.values(result)
      
      console.log('[ViewResponses] Result keys count:', resultKeys.length)
      console.log('[ViewResponses] Result values count:', resultValues.length)
      console.log('[ViewResponses] HandleContractPairs count:', handleContractPairs.length)
      
      // The result object keys should match the handles we passed in
      // userDecrypt returns an object where keys are the handle strings
      // We need to match handles exactly as they appear in result keys
      for (let i = 0; i < handleContractPairs.length; i++) {
        const pair = handleContractPairs[i]
        const handle = String(pair.handle).toLowerCase() // Use lowercase for matching
        
        // Try to find the value by matching the handle
        let value: any = undefined
        let matchedKey: string | undefined = undefined
        
        // Method 1: Direct key lookup with lowercase
        if (result[handle] !== undefined) {
          value = result[handle]
          matchedKey = handle
        }
        
        // Method 2: Try all result keys with case-insensitive match
        if (value === undefined) {
          for (const key of resultKeys) {
            if (key.toLowerCase() === handle) {
              value = result[key]
              matchedKey = key
              break
            }
          }
        }
        
        // Method 3: Try exact match with original handle (before normalization)
        if (value === undefined) {
          const originalHandle = (encryptedResponse as string[])[i]
          const originalNormalized = originalHandle.startsWith('0x') 
            ? originalHandle.toLowerCase() 
            : `0x${originalHandle}`.toLowerCase()
          
          if (result[originalNormalized] !== undefined) {
            value = result[originalNormalized]
            matchedKey = originalNormalized
          } else {
            // Try case-insensitive match with original
            for (const key of resultKeys) {
              if (key.toLowerCase() === originalNormalized) {
                value = result[key]
                matchedKey = key
                break
              }
            }
          }
        }
        
        // Method 4: If still not found, try by index (last resort)
        // This assumes result preserves the order of handles
        if (value === undefined && i < resultValues.length) {
          // Only use index if we haven't matched any keys yet
          const unmatchedKeys = resultKeys.filter(key => {
            const keyLower = key.toLowerCase()
            return !handleContractPairs.some((p, idx) => 
              idx < i && String(p.handle).toLowerCase() === keyLower
            )
          })
          
          if (unmatchedKeys.length > 0) {
            const firstUnmatchedKey = unmatchedKeys[0]
            value = result[firstUnmatchedKey]
            matchedKey = firstUnmatchedKey
            console.log(`[ViewResponses] ⚠️ Using fallback index-based lookup for handle ${i}, matched key: ${firstUnmatchedKey}`)
          }
        }
        
        console.log(`[ViewResponses] Handle ${i}: ${handle}`)
        console.log(`[ViewResponses] Looking for handle in result keys...`)
        console.log(`[ViewResponses] Result keys:`, resultKeys.map(k => k.toLowerCase()))
        console.log(`[ViewResponses] Matched key: ${matchedKey || 'NONE'}`)
        console.log(`[ViewResponses] Found value: ${value} (type: ${typeof value})`)
        
        if (value !== undefined && value !== null) {
          const numValue = typeof value === 'bigint' ? Number(value) : Number(value)
          console.log(`[ViewResponses] ✅ Decrypted value ${i}: ${numValue}`)
          decrypted.push(numValue)
        } else {
          console.error(`[ViewResponses] ❌ Could not decrypt handle ${i}: ${handle}`)
          console.error(`[ViewResponses] All result keys:`, resultKeys)
          console.error(`[ViewResponses] All result values:`, resultValues)
          console.error(`[ViewResponses] HandleContractPairs:`, handleContractPairs.map(p => String(p.handle).toLowerCase()))
        }
      }

      console.log('[ViewResponses] ✅✅✅ DECRYPTION COMPLETE! ✅✅✅')
      console.log('[ViewResponses] Decrypted answers:', decrypted)
      
      if (decrypted.length !== normalizedHandles.length) {
        console.error(`[ViewResponses] ⚠️ Warning: Decrypted ${decrypted.length} values but expected ${normalizedHandles.length}`)
      }
      
      setDecryptedAnswers(decrypted)
      setIsDecrypting(false)

    } catch (err) {
      console.error('[ViewResponses] ❌ Decryption error:', err)
      setIsDecrypting(false)
    }
  }

  const answersToDisplay = decryptedAnswers || (revealedResponse ? (revealedResponse[0] as number[]) : null)


  return (
    <Card className="max-w-[900px] mx-auto shadow-lg">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-3 text-2xl font-bold">
          <Eye className="h-8 w-8 text-primary" />
          View Survey Responses
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8 space-y-6">
        {decryptError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Error: {decryptError.message}
            </AlertDescription>
          </Alert>
        )}

        {isDecrypting && (
          <Alert className="bg-blue-50 border-blue-200">
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription className="text-blue-800">
              <div className="font-semibold mb-1">Decrypting...</div>
              <div className="text-sm">
                🔓 Client-side decryption in progress...<br />
                ⚡ This should only take a few seconds!<br />
                💡 Please approve the signature request in MetaMask.
              </div>
            </AlertDescription>
          </Alert>
        )}
        
        {isRevealed && (
          <Alert variant="success">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              <strong>Decryption Complete!</strong> Your response has been successfully decrypted by KMS.
            </AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={(e) => e.preventDefault()} className="space-y-2">
          <Label htmlFor="viewSurveyId" className="flex items-center gap-2">
            🆔 Survey ID
          </Label>
          <Input
            id="viewSurveyId"
            type="number"
            min="0"
            value={surveyId}
            onChange={(e) => setSurveyId(e.target.value)}
            placeholder="Enter survey ID"
          />
          <p className="text-xs text-muted-foreground">
            💡 Will decrypt your response for this survey
          </p>
        </form>

        {surveyId && surveyData && (
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              📋 Survey: <strong>{surveyData[0] as string}</strong>
              <div className="mt-1 text-sm">
                Creator: {(surveyData[2] as string).slice(0, 10)}...{(surveyData[2] as string).slice(-8)}
                {isCreator && <Badge variant="secondary" className="ml-2">👑 You are the creator</Badge>}
              </div>
              <div className="text-sm">
                Questions: {Number(surveyData[6])} | Responses: {Number(surveyData[5])}
              </div>
            </AlertDescription>
          </Alert>
        )}


        {surveyId && encryptedResponse && (
          <>
            {(isRevealed || answersToDisplay) ? (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-8 rounded-xl border-2 border-green-400 shadow-lg">
                <h3 className="flex items-center gap-3 text-xl font-bold text-green-800 mb-6">
                  <Unlock className="h-7 w-7" />
                  Decrypted Response
                </h3>
                {answersToDisplay && surveyData && (
                  <>
                    {(surveyData[1] as string[]).map((question, index) => {
                      const questionType = detectQuestionType(question)
                      const answerValue = answersToDisplay[index]
                      const isTextAnswer = questionType === 'text'
                      
                      return (
                        <div key={index} className="bg-white p-5 rounded-lg border-2 border-slate-100 mb-4 shadow-sm">
                          <div className="flex items-center gap-2 font-semibold text-foreground mb-2">
                            <Badge variant="default" className="text-xs">Q{index + 1}</Badge>
                            {question}
                          </div>
                          {isTextAnswer ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-2xl font-bold text-green-600 ml-2">
                                <span className="text-base text-muted-foreground font-semibold">Encoded Value:</span>
                                {answerValue}
                              </div>
                              <Alert className="bg-amber-50 border-amber-200">
                                <AlertDescription className="text-amber-800 text-sm">
                                  <strong>ℹ️ Text Input Note:</strong> This question was answered with text input. 
                                  Due to FHE encryption limitations, text is converted to a numeric encoding (sum of character codes mod 256). 
                                  The original text cannot be recovered from the encrypted value.
                                </AlertDescription>
                              </Alert>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-2xl font-bold text-green-600 ml-2">
                              <span className="text-base text-muted-foreground font-semibold">Answer:</span>
                              {answerValue}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {revealedResponse && (
                      <div className="text-sm text-muted-foreground mt-6 pt-5 border-t-2 border-slate-200 flex items-center gap-2">
                        <span className="font-semibold">👤 Respondent:</span>
                        <code className="bg-slate-100 px-2 py-1 rounded text-xs">
                          {revealedResponse[1] as string}
                        </code>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="bg-gradient-to-br from-amber-50 to-yellow-50 p-8 rounded-xl border-2 border-amber-400 shadow-lg">
                <h3 className="flex items-center gap-3 text-xl font-bold text-amber-800 mb-6">
                  <Lock className="h-7 w-7" />
                  Encrypted Response
                </h3>
                <Alert className="bg-amber-100 border-amber-300 mb-5">
                  <AlertDescription className="text-amber-800 font-semibold">
                    ⚠️ This response is encrypted on-chain. Click below to decrypt instantly!
                  </AlertDescription>
                </Alert>
                
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-xl border-2 border-slate-600 shadow-inner">
                  <div className="text-xs text-slate-400 mb-4 font-mono font-semibold tracking-wider">
                    🔐 ENCRYPTED HANDLES (FIRST 40 CHARS):
                  </div>
                  {(encryptedResponse as string[]).map((handle, index) => (
                    <div key={index} className="text-xs font-mono text-emerald-400 break-all mb-3 p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                      <span className="text-amber-400 font-semibold">Answer {index + 1}:</span> {handle.toString().substring(0, 40)}...
                    </div>
                  ))}
                </div>
                
                <Button 
                  onClick={handleRequestDecryption}
                  className="w-full mt-5"
                  variant="campaign"
                  size="lg"
                  disabled={isDecrypting || !fhevmInstance}
                >
                  {isDecrypting ? '🔄 Decrypting...' : 
                   !fhevmInstance ? '⏳ Initializing FHEVM...' :
                   '⚡ Decrypt Now (Instant)'}
                </Button>
                
                {!fhevmInstance && (
                  <Alert className="mt-3 bg-amber-100 border-amber-300">
                    <AlertDescription className="text-amber-800 text-sm">
                      ⏰ <strong>Initializing FHEVM SDK...</strong><br />
                      Please wait a moment for the encryption system to load.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </>
        )}

        {surveyId && !encryptedResponse && !surveyData && (
          <Alert className="bg-amber-50 border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              No response found for this survey and address, or survey does not exist.
            </AlertDescription>
          </Alert>
        )}

        <div className="mt-10 p-7 bg-gradient-to-br from-sky-50 to-blue-50 rounded-xl border-2 border-sky-200">
          <h4 className="mb-3 text-base font-semibold flex items-center gap-2">
            <Info className="h-5 w-5 text-sky-600" />
            How Decryption Works
          </h4>
          <div className="text-sm text-muted-foreground space-y-1">
            <div><strong>🔒 Encryption:</strong> All responses are encrypted with FHE before being stored on-chain</div>
            <div><strong>⚡ Client-Side Decryption:</strong> Decryption happens instantly in your browser using your wallet signature</div>
            <div><strong>🔐 Security:</strong> Only authorized users (with wallet signature) can decrypt the data</div>
            <div><strong>⏱️ Speed:</strong> Decryption completes in just a few seconds!</div>
            <div><strong>🌐 Works on all networks:</strong> Localhost, Sepolia, and any FHEVM-compatible network</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
