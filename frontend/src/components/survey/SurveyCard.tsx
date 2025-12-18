import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Hash, HelpCircle, BarChart3, User, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Survey {
  id: number
  title: string
  creator: string
  startTime: bigint
  endTime: bigint
  responseCount: bigint
  questionCount: number
}

export type SurveyStatus = 'active' | 'pending' | 'ended'

export interface SurveyCardProps {
  survey: Survey
  onSelect: () => void
}

// Get survey status based on timestamps
export function getSurveyStatus(startTime: bigint, endTime: bigint): SurveyStatus {
  const now = Math.floor(Date.now() / 1000)
  if (now < Number(startTime)) return 'pending'
  if (now > Number(endTime)) return 'ended'
  return 'active'
}

// Get status display text
export function getStatusDisplayText(status: SurveyStatus): string {
  switch (status) {
    case 'active':
      return '✅ Active'
    case 'pending':
      return '🕐 Not Started'
    case 'ended':
      return '⏱️ Ended'
  }
}

// Map status to badge variant
export function getStatusBadgeVariant(status: SurveyStatus): 'success' | 'secondary' | 'destructive' {
  switch (status) {
    case 'active':
      return 'success'
    case 'pending':
      return 'secondary'
    case 'ended':
      return 'destructive'
  }
}


// Format timestamp to date string
export function formatDate(timestamp: bigint): string {
  return new Date(Number(timestamp) * 1000).toLocaleDateString()
}

// Format address for display
function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function SurveyCard({ survey, onSelect }: SurveyCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const status = getSurveyStatus(survey.startTime, survey.endTime)
  const badgeVariant = getStatusBadgeVariant(status)
  const statusText = getStatusDisplayText(status)

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200 bg-gradient-to-br from-slate-50 to-slate-100',
        'border-2 hover:border-primary hover:-translate-y-1',
        isHovered && 'shadow-campaign border-primary -translate-y-1'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onSelect}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-foreground leading-tight">
          {survey.title || `Survey #${survey.id}`}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Hash className="h-4 w-4" />
          <span>ID: {survey.id}</span>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <HelpCircle className="h-4 w-4" />
          <span>Questions: {survey.questionCount}</span>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BarChart3 className="h-4 w-4" />
          <span>Responses: {survey.responseCount.toString()}</span>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="h-4 w-4" />
          <span>Creator: {formatAddress(survey.creator)}</span>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>Until: {formatDate(survey.endTime)}</span>
        </div>
        
        <div className="pt-2">
          <Badge variant={badgeVariant}>
            {statusText}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}
