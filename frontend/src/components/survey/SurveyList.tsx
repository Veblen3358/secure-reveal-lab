import { useState, useEffect } from 'react'
import { useReadContract, usePublicClient, useBlockNumber, useChainId } from 'wagmi'
import { getContractAddress } from '../../config/contract'
import { SURVEY_REVEAL_ABI } from '../../abi/SurveyReveal'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { SurveyCard, Survey } from './SurveyCard'
import { ClipboardList, Loader2 } from 'lucide-react'

interface SurveyListProps {
  onSurveySelect: (surveyId: number) => void
}

export function SurveyList({ onSurveySelect }: SurveyListProps) {
  const chainId = useChainId()
  const contractAddress = getContractAddress(chainId)
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const publicClient = usePublicClient()
  const { data: blockNumber } = useBlockNumber({ watch: true })

  const { data: surveyCount, refetch, error: surveyCountError } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SURVEY_REVEAL_ABI,
    functionName: 'getSurveyCount',
    query: {
      refetchInterval: 3000,
    }
  })

  // Debug logging for survey count
  useEffect(() => {
    if (surveyCountError) {
      console.error('[SurveyList] Error fetching survey count:', surveyCountError)
    }
    if (surveyCount !== undefined) {
      console.log('[SurveyList] Survey count value:', surveyCount.toString())
    }
  }, [surveyCount, surveyCountError])

  // Refetch survey count when new block is mined
  useEffect(() => {
    if (blockNumber) {
      console.log('[SurveyList] New block detected, refetching survey count...')
      refetch()
    }
  }, [blockNumber, refetch])

  // Log survey count changes
  useEffect(() => {
    console.log('[SurveyList] Survey count:', surveyCount?.toString())
  }, [surveyCount])


  useEffect(() => {
    const fetchSurveys = async () => {
      console.log('[SurveyList] useEffect triggered')
      console.log('[SurveyList] surveyCount:', surveyCount?.toString())
      console.log('[SurveyList] publicClient:', !!publicClient)
      console.log('[SurveyList] contractAddress:', contractAddress)
      
      if (!surveyCount || surveyCount === 0n) {
        console.log('[SurveyList] No surveys to fetch (count is 0 or undefined)')
        setSurveys([])
        return
      }

      if (!publicClient) {
        console.log('[SurveyList] Public client not ready')
        return
      }

      console.log(`[SurveyList] Starting to fetch ${surveyCount} surveys...`)
      setIsLoading(true)
      try {
        const fetchedSurveys: Survey[] = []
        
        for (let i = 0; i < Number(surveyCount); i++) {
          try {
            console.log(`[SurveyList] Fetching survey ${i}...`)
            const surveyData = await publicClient.readContract({
              address: contractAddress as `0x${string}`,
              abi: SURVEY_REVEAL_ABI,
              functionName: 'getSurvey',
              args: [BigInt(i)],
            }) as any

            console.log(`[SurveyList] Survey ${i} data:`, surveyData)

            fetchedSurveys.push({
              id: i,
              title: surveyData[0] as string,
              creator: surveyData[2] as string,
              startTime: surveyData[3] as bigint,
              endTime: surveyData[4] as bigint,
              responseCount: surveyData[5] as bigint,
              questionCount: Number(surveyData[6]),
            })
          } catch (err) {
            console.error(`[SurveyList] Error fetching survey ${i}:`, err)
          }
        }
        
        console.log('[SurveyList] All surveys fetched:', fetchedSurveys)
        setSurveys(fetchedSurveys)
      } catch (error) {
        console.error('[SurveyList] Error fetching surveys:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchSurveys()
  }, [surveyCount, publicClient, contractAddress])


  if (isLoading) {
    return (
      <Card className="max-w-[900px] mx-auto shadow-lg">
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
          <span className="text-muted-foreground">Loading surveys...</span>
        </CardContent>
      </Card>
    )
  }

  if (!surveyCount || surveyCount === 0n) {
    return (
      <Card className="max-w-[900px] mx-auto shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">Survey List</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-12">
          <ClipboardList className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <div className="text-lg font-semibold text-foreground mb-2">
            No surveys yet
          </div>
          <div className="text-sm text-muted-foreground">
            Create your first survey to get started!
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="max-w-[900px] mx-auto shadow-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold text-primary">Survey List</CardTitle>
        <CardDescription>
          Total surveys: <strong>{surveyCount.toString()}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {surveys.map((survey) => (
            <SurveyCard
              key={survey.id}
              survey={survey}
              onSelect={() => onSurveySelect(survey.id)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
