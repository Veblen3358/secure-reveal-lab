import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useChainId } from 'wagmi'
import { getContractAddress } from '../../config/contract'
import { SURVEY_REVEAL_ABI } from '../../abi/SurveyReveal'
import { useFhevm } from '../../hooks/useFhevm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Send, AlertCircle, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SubmitResponseProps {
  selectedSurveyId: number | null
}

// Detect question type
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

// Extract rating range from question
function extractRatingRange(question: string): { min: number; max: number } {
  const match = question.match(/(\d+)\s*-\s*(\d+)/)
  if (match) {
    return { min: parseInt(match[1]), max: parseInt(match[2]) }
  }
  return { min: 1, max: 5 }
}


export function SubmitResponse({ selectedSurveyId }: SubmitResponseProps) {
  const { address } = useAccount()
  const chainId = useChainId()
  const contractAddress = getContractAddress(chainId)
  const { fhevmInstance, isInitializing } = useFhevm()
  const [surveyId, setSurveyId] = useState(selectedSurveyId?.toString() || '')
  const [answers, setAnswers] = useState<number[]>([])
  const [textInputs, setTextInputs] = useState<string[]>([])

  const { data: hash, writeContract, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const { data: surveyData } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SURVEY_REVEAL_ABI,
    functionName: 'getSurvey',
    args: [BigInt(surveyId || 0)],
    query: {
      enabled: !!surveyId && surveyId !== '',
    }
  })

  const { data: hasResponded } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SURVEY_REVEAL_ABI,
    functionName: 'hasResponded',
    args: [BigInt(surveyId || 0), address as `0x${string}`],
    query: {
      enabled: !!surveyId && !!address,
    }
  })

  useEffect(() => {
    if (surveyData) {
      const questionCount = Number(surveyData[6])
      setAnswers(new Array(questionCount).fill(0))
      setTextInputs(new Array(questionCount).fill(''))
    }
  }, [surveyData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!address || !fhevmInstance) {
      console.error('[Submit] Please connect your wallet and wait for initialization')
      return
    }

    if (hasResponded) {
      console.error('[Submit] You have already responded to this survey')
      return
    }

    if (!surveyData) {
      console.error('[Submit] Please enter a valid survey ID')
      return
    }

    try {
      console.log('[Submit] Starting encryption...')
      console.log('[Submit] Contract:', contractAddress)
      console.log('[Submit] User:', address)
      console.log('[Submit] Answers:', answers)
      
      const builder = fhevmInstance.createEncryptedInput(
        contractAddress as `0x${string}`,
        address as `0x${string}`
      )
      
      let chain = builder
      for (const answer of answers) {
        chain = chain.add8(answer)
      }
      
      console.log('[Submit] Calling encrypt...')
      const encrypted = await chain.encrypt()
      console.log('[Submit] Encryption complete!')

      const toHexString = (bytes: Uint8Array): `0x${string}` => {
        return ('0x' + Array.from(bytes)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('')) as `0x${string}`
      }

      const encryptedAnswers: `0x${string}`[] = []
      const proofs: `0x${string}`[] = []
      
      for (let i = 0; i < answers.length; i++) {
        const handle = encrypted.handles[i]
        const hexHandle = toHexString(handle)
        encryptedAnswers.push(hexHandle)
      }
      
      const hexProof = toHexString(encrypted.inputProof)
      
      for (let i = 0; i < answers.length; i++) {
        proofs.push(hexProof)
      }

      writeContract({
        address: contractAddress as `0x${string}`,
        abi: SURVEY_REVEAL_ABI,
        functionName: 'submitResponse',
        args: [
          BigInt(surveyId),
          encryptedAnswers,
          proofs,
        ],
        gas: BigInt(5000000),
      })
    } catch (err) {
      console.error('[Submit] Error:', err)
    }
  }


  const updateAnswer = (index: number, value: number) => {
    const newAnswers = [...answers]
    newAnswers[index] = value
    setAnswers(newAnswers)
  }

  const updateTextInput = (index: number, text: string) => {
    const newTextInputs = [...textInputs]
    newTextInputs[index] = text
    setTextInputs(newTextInputs)
    
    // If input is a pure number (integer), use it directly
    // Otherwise, convert text to character code sum
    const trimmedText = text.trim()
    const isPureNumber = /^-?\d+$/.test(trimmedText)
    
    let numValue = 0
    if (isPureNumber && trimmedText !== '') {
      // Use the number directly, but clamp to 0-255 range for FHE compatibility
      numValue = Math.max(0, Math.min(255, parseInt(trimmedText, 10)))
      console.log(`[Submit] Text input "${text}" is a number, using value: ${numValue}`)
    } else {
      // Convert text to character code sum (for non-numeric text)
      for (let i = 0; i < text.length; i++) {
        numValue += text.charCodeAt(i)
      }
      numValue = numValue % 256
      console.log(`[Submit] Text input "${text}" converted to character code sum: ${numValue}`)
    }
    
    updateAnswer(index, numValue || 0)
  }

  const renderQuestionInput = (question: string, index: number) => {
    const questionType = detectQuestionType(question)
    
    switch (questionType) {
      case 'yesno':
        return (
          <div className="flex gap-3 mt-3">
            <Button
              type="button"
              onClick={() => updateAnswer(index, 1)}
              variant={answers[index] === 1 ? 'default' : 'outline'}
              className={cn(
                'flex-1 py-3',
                answers[index] === 1 && 'bg-green-500 hover:bg-green-600 border-green-500'
              )}
            >
              ✅ Yes
            </Button>
            <Button
              type="button"
              onClick={() => updateAnswer(index, 0)}
              variant={answers[index] === 0 ? 'destructive' : 'outline'}
              className="flex-1 py-3"
            >
              ❌ No
            </Button>
          </div>
        )
      
      case 'rating':
        const range = extractRatingRange(question)
        return (
          <div className="flex gap-2 mt-3 flex-wrap">
            {Array.from({ length: range.max - range.min + 1 }, (_, i) => range.min + i).map((value) => (
              <Button
                key={value}
                type="button"
                onClick={() => updateAnswer(index, value)}
                variant={answers[index] === value ? 'default' : 'outline'}
                className={cn(
                  'min-w-[50px] py-3',
                  answers[index] === value && 'bg-primary'
                )}
              >
                {value}
              </Button>
            ))}
          </div>
        )
      
      case 'scale':
        return (
          <div className="mt-3">
            <input
              type="range"
              min="0"
              max="100"
              value={answers[index]}
              onChange={(e) => updateAnswer(index, parseInt(e.target.value))}
              className="w-full h-2 rounded-lg cursor-pointer accent-primary"
            />
            <div className="text-center mt-2 text-xl font-bold text-primary">
              {answers[index]}
            </div>
          </div>
        )
      
      case 'text':
      default:
        return (
          <div className="mt-3">
            <Textarea
              value={textInputs[index]}
              onChange={(e) => updateTextInput(index, e.target.value)}
              placeholder="Enter your answer here..."
              rows={3}
              className="resize-y"
            />
            <p className="text-xs text-muted-foreground mt-1">
              💡 Your text will be encrypted and stored securely (encoded value: {answers[index]})
            </p>
          </div>
        )
    }
  }

  const isSubmitting = isPending || isConfirming
  const isDisabled = isSubmitting || isInitializing || !fhevmInstance || hasResponded || !surveyData


  return (
    <Card className="max-w-[700px] mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-bold">
          <Send className="h-5 w-5 text-primary" />
          Submit Survey Response
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {isInitializing && (
          <Alert className="bg-blue-50 border-blue-200">
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>
              Initializing FHEVM encryption...
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Error: {error.message}
            </AlertDescription>
          </Alert>
        )}
        
        {isSuccess && (
          <Alert variant="success">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Response submitted successfully!
              <div className="mt-2 text-xs opacity-80">
                Transaction: {hash?.slice(0, 10)}...{hash?.slice(-8)}
              </div>
              <div className="mt-1 text-xs">
                🔒 Your answers are encrypted and stored securely on-chain.
              </div>
            </AlertDescription>
          </Alert>
        )}

        {hasResponded && (
          <Alert className="bg-amber-50 border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              You have already responded to this survey.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="surveyId" className="flex items-center gap-2">
              🆔 Survey ID
            </Label>
            <Input
              id="surveyId"
              type="number"
              min="0"
              value={surveyId}
              onChange={(e) => setSurveyId(e.target.value)}
              placeholder="Enter survey ID"
              required
            />
          </div>

          {surveyData && (
            <div className="space-y-4">
              <Alert className="bg-blue-50 border-blue-200">
                <AlertDescription className="text-blue-800">
                  📋 Survey: <strong>{surveyData[0] as string}</strong>
                  <div className="text-xs mt-1">
                    Questions: {Number(surveyData[6])}
                  </div>
                </AlertDescription>
              </Alert>

              {(surveyData[1] as string[]).map((question, index) => (
                <div key={index} className="bg-slate-50 p-5 rounded-lg border border-slate-200">
                  <div className="font-semibold text-foreground mb-1">
                    ❓ Question {index + 1}
                  </div>
                  <div className="text-sm text-muted-foreground mb-2">
                    {question}
                  </div>
                  {renderQuestionInput(question, index)}
                </div>
              ))}
            </div>
          )}

          {!surveyData && surveyId && (
            <Alert className="bg-amber-50 border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                Survey not found or invalid Survey ID
              </AlertDescription>
            </Alert>
          )}

          <Button 
            type="submit" 
            className="w-full"
            variant="campaign"
            size="lg"
            disabled={isDisabled}
          >
            {isSubmitting ? '⏳ Submitting...' : '🔒 Submit Response (Encrypted)'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
