import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useChainId } from 'wagmi'
import { getContractAddress } from '../../config/contract'
import { SURVEY_REVEAL_ABI } from '../../abi/SurveyReveal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Sparkles, Plus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react'

interface CreateSurveyProps {
  onSurveyCreated?: () => void
}

export function CreateSurvey({ onSurveyCreated }: CreateSurveyProps) {
  const { address } = useAccount()
  const chainId = useChainId()
  const contractAddress = getContractAddress(chainId)
  const [title, setTitle] = useState('')
  const [durationDays, setDurationDays] = useState(7)
  const [questions, setQuestions] = useState<string[]>(['', '', ''])
  
  const { data: hash, writeContract, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  // Debug logging
  useEffect(() => {
    if (hash) {
      console.log('[CreateSurvey] Transaction hash:', hash)
    }
    if (error) {
      console.error('[CreateSurvey] Transaction error:', error)
    }
    if (isSuccess) {
      console.log('[CreateSurvey] ✅ Transaction successful!')
    }
  }, [hash, error, isSuccess])

  // When survey is created successfully, reset form and switch to list view
  useEffect(() => {
    if (isSuccess) {
      setTitle('')
      setQuestions(['', '', ''])
      setDurationDays(7)
      if (onSurveyCreated) {
        onSurveyCreated()
      }
    }
  }, [isSuccess, onSurveyCreated])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!address) {
      console.error('[CreateSurvey] Please connect your wallet')
      return
    }

    const validQuestions = questions.filter(q => q.trim().length > 0)
    if (validQuestions.length === 0) {
      console.error('[CreateSurvey] Please add at least one question')
      return
    }


    const currentTime = Math.floor(Date.now() / 1000)
    const startTime = currentTime
    const endTime = currentTime + (durationDays * 24 * 60 * 60)

    try {
      console.log('[CreateSurvey] Creating survey with:', {
        title,
        questions: validQuestions,
        startTime,
        endTime,
        contractAddress
      })
      
      writeContract({
        address: contractAddress as `0x${string}`,
        abi: SURVEY_REVEAL_ABI,
        functionName: 'createSurvey',
        args: [
          title,
          validQuestions,
          BigInt(startTime),
          BigInt(endTime),
        ],
        gas: BigInt(3000000),
      })
      
      console.log('[CreateSurvey] Write contract called, waiting for transaction...')
    } catch (err) {
      console.error('[CreateSurvey] Error creating survey:', err)
    }
  }

  const addQuestion = () => {
    if (questions.length < 10) {
      setQuestions([...questions, ''])
    }
  }

  const removeQuestion = (index: number) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index))
    }
  }

  const updateQuestion = (index: number, value: string) => {
    const newQuestions = [...questions]
    newQuestions[index] = value
    setQuestions(newQuestions)
  }

  const isSubmitting = isPending || isConfirming
  const validQuestionCount = questions.filter(q => q.trim()).length

  return (
    <Card className="max-w-[600px] mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-bold">
          <Sparkles className="h-5 w-5 text-primary" />
          Create New Survey
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Error: {error.message}
            </AlertDescription>
          </Alert>
        )}
        
        {isSuccess && (
          <Alert variant="success" className="mb-6">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Survey created successfully!
              <div className="mt-2 text-xs opacity-80">
                Transaction: {hash?.slice(0, 10)}...{hash?.slice(-8)}
              </div>
            </AlertDescription>
          </Alert>
        )}


        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title" className="flex items-center gap-2">
              📝 Survey Title
            </Label>
            <Input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Game Feedback Survey 2024"
              required
            />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <Label className="flex items-center gap-2">
                ❓ Questions ({validQuestionCount}/10)
              </Label>
              <Button
                type="button"
                onClick={addQuestion}
                disabled={questions.length >= 10}
                size="sm"
                variant={questions.length >= 10 ? 'secondary' : 'default'}
                className="gap-1"
              >
                <Plus className="h-4 w-4" />
                Add Question
              </Button>
            </div>
            
            {questions.map((question, index) => (
              <div key={index} className="flex gap-2 items-start">
                <div className="flex-1">
                  <Textarea
                    value={question}
                    onChange={(e) => updateQuestion(index, e.target.value)}
                    placeholder={`Question ${index + 1}: e.g., Rate the game experience (1-5)`}
                    rows={2}
                    className="resize-y"
                  />
                </div>
                {questions.length > 1 && (
                  <Button
                    type="button"
                    onClick={() => removeQuestion(index)}
                    variant="destructive"
                    size="icon"
                    className="h-12 w-12 shrink-0"
                    title="Remove question"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            
            <p className="text-xs text-muted-foreground">
              💡 Tip: Use numerical scales for responses (e.g., 0/1 for Yes/No, 1-5 for ratings)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration" className="flex items-center gap-2">
              ⏱️ Duration (days)
            </Label>
            <Input
              id="duration"
              type="number"
              min="1"
              max="365"
              value={durationDays}
              onChange={(e) => setDurationDays(Number(e.target.value))}
              required
            />
            <p className="text-xs text-muted-foreground">
              Survey will end in {durationDays} day{durationDays > 1 ? 's' : ''}
            </p>
          </div>

          <Button 
            type="submit" 
            className="w-full"
            variant="campaign"
            size="lg"
            disabled={isSubmitting}
          >
            {isSubmitting ? '⏳ Creating...' : '🚀 Create Survey'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
