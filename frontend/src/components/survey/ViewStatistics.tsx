import { useState } from 'react'
import { useAccount, useReadContract, useChainId } from 'wagmi'
import { getContractAddress } from '../../config/contract'
import { SURVEY_REVEAL_ABI } from '../../abi/SurveyReveal'
import { useFhevm } from '../../hooks/useFhevm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { BarChart3, TrendingUp, Users, Calculator, Loader2, AlertCircle, Info } from 'lucide-react'
import { ethers } from 'ethers'

interface StatisticsData {
  questionIndex: number
  question: string
  average: number
  total: number
  count: number
  distribution: { range: string; count: number }[]
}

export function ViewStatistics() {
  const { address } = useAccount()
  const chainId = useChainId()
  const contractAddress = getContractAddress(chainId)
  const { fhevmInstance } = useFhevm()
  const [surveyId, setSurveyId] = useState('')
  const [statistics, setStatistics] = useState<StatisticsData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: surveyData } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SURVEY_REVEAL_ABI,
    functionName: 'getSurvey',
    args: [BigInt(surveyId || 0)],
    query: {
      enabled: !!surveyId && surveyId !== '',
    }
  })

  const { data: respondents } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SURVEY_REVEAL_ABI,
    functionName: 'getRespondents',
    args: [BigInt(surveyId || 0)],
    query: {
      enabled: !!surveyId && surveyId !== '',
    }
  })

  const handleCalculateStatistics = async () => {
    if (!surveyId || !address || !fhevmInstance || !surveyData || !respondents) {
      setError('Please connect your wallet and enter a valid survey ID')
      return
    }

    setIsLoading(true)
    setError(null)
    setStatistics([])

    try {
      const questions = surveyData[1] as string[]
      const responseCount = Number(surveyData[5])
      const stats: StatisticsData[] = []

      // Create provider and contract once, reuse for all questions
      const provider = new ethers.BrowserProvider((window as any).ethereum)
      const contract = new ethers.Contract(contractAddress, SURVEY_REVEAL_ABI, provider)
      const signer = await provider.getSigner()

      // For each question, calculate statistics
      for (let qIndex = 0; qIndex < questions.length; qIndex++) {
        // Get encrypted sum from contract
        let encryptedSumHandle: string
        try {
          encryptedSumHandle = await contract.getEncryptedSum(BigInt(surveyId), qIndex)
        } catch (err) {
          console.error(`Failed to get encrypted sum for question ${qIndex}:`, err)
          // Fallback: calculate from individual responses
          encryptedSumHandle = '0x0'
        }

        // Decrypt the sum
        const keypair = fhevmInstance.generateKeypair()

        const handleContractPairs = [{
          handle: encryptedSumHandle as `0x${string}`,
          contractAddress: contractAddress as `0x${string}`
        }]

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

        const total = Number(result[encryptedSumHandle] || result[Object.keys(result)[0]] || 0)
        const average = responseCount > 0 ? total / responseCount : 0

        // Get all individual answers for distribution
        const answers: number[] = []
        for (const respondent of respondents as string[]) {
          try {
            const encryptedResponse = await contract.getEncryptedResponse(BigInt(surveyId), respondent)

            // Decrypt individual answer
            const individualHandle = encryptedResponse[qIndex]
            const individualPairs = [{
              handle: individualHandle as `0x${string}`,
              contractAddress: contractAddress as `0x${string}`
            }]

            const individualResult = await fhevmInstance.userDecrypt(
              individualPairs,
              keypair.privateKey,
              keypair.publicKey,
              signature.replace('0x', ''),
              contractAddresses,
              address,
              startTimeStamp,
              durationDays
            )

            const answer = Number(individualResult[individualHandle] || individualResult[Object.keys(individualResult)[0]] || 0)
            answers.push(answer)
          } catch (err) {
            console.error(`Failed to decrypt answer for ${respondent}:`, err)
          }
        }

        // Calculate distribution (0-20, 21-40, 41-60, 61-80, 81-100)
        const distribution = [
          { range: '0-20', count: 0 },
          { range: '21-40', count: 0 },
          { range: '41-60', count: 0 },
          { range: '61-80', count: 0 },
          { range: '81-100', count: 0 }
        ]

        answers.forEach(answer => {
          if (answer <= 20) distribution[0].count++
          else if (answer <= 40) distribution[1].count++
          else if (answer <= 60) distribution[2].count++
          else if (answer <= 80) distribution[3].count++
          else distribution[4].count++
        })

        stats.push({
          questionIndex: qIndex,
          question: questions[qIndex],
          average: Math.round(average * 100) / 100,
          total,
          count: responseCount,
          distribution
        })
      }

      setStatistics(stats)
    } catch (err: any) {
      console.error('[ViewStatistics] Error:', err)
      setError(`Failed to calculate statistics: ${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="max-w-[1200px] mx-auto shadow-lg">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-3 text-2xl font-bold">
          <BarChart3 className="h-8 w-8 text-primary" />
          Survey Statistics & Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8 space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div>
            <Label htmlFor="statSurveyId" className="flex items-center gap-2 mb-2">
              📋 Survey ID
            </Label>
            <div className="flex gap-2">
              <Input
                id="statSurveyId"
                type="number"
                min="0"
                value={surveyId}
                onChange={(e) => setSurveyId(e.target.value)}
                placeholder="Enter Survey ID"
                className="flex-1"
              />
              <Button
                onClick={handleCalculateStatistics}
                disabled={isLoading || !surveyId || !address || !fhevmInstance}
                variant="campaign"
                className="shadow-button hover:shadow-button-hover"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  <>
                    <Calculator className="mr-2 h-4 w-4" />
                    Calculate Statistics
                  </>
                )}
              </Button>
            </div>
          </div>

          {surveyData && (
            <Alert className="bg-blue-50 border-blue-200">
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold mb-1">{surveyData[0] as string}</div>
                <div className="text-sm">
                  Questions: {Number(surveyData[6])} | Responses: {Number(surveyData[5])}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {statistics.length > 0 && (
            <div className="space-y-8 mt-8">
              {statistics.map((stat, index) => (
                <Card key={index} className="glass-card shadow-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Badge variant="default" className="text-xs">Q{stat.questionIndex + 1}</Badge>
                      {stat.question}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Summary Statistics */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border-2 border-blue-200">
                        <div className="flex items-center gap-2 text-blue-600 mb-2">
                          <TrendingUp className="h-5 w-5" />
                          <span className="font-semibold">Average Score</span>
                        </div>
                        <div className="text-3xl font-bold text-blue-700">{stat.average}</div>
                      </div>
                      <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border-2 border-green-200">
                        <div className="flex items-center gap-2 text-green-600 mb-2">
                          <Calculator className="h-5 w-5" />
                          <span className="font-semibold">Total Score</span>
                        </div>
                        <div className="text-3xl font-bold text-green-700">{stat.total}</div>
                      </div>
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border-2 border-purple-200">
                        <div className="flex items-center gap-2 text-purple-600 mb-2">
                          <Users className="h-5 w-5" />
                          <span className="font-semibold">Response Count</span>
                        </div>
                        <div className="text-3xl font-bold text-purple-700">{stat.count}</div>
                      </div>
                    </div>

                    {/* Distribution Chart */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Score Distribution</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={stat.distribution}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="range" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="count" fill="#8884d8" name="Count" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Distribution Table */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Detailed Distribution</h3>
                      <div className="space-y-2">
                        {stat.distribution.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <span className="font-medium">{item.range} points</span>
                            <Badge variant="secondary" className="text-lg px-4 py-1">
                              {item.count} responses
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

