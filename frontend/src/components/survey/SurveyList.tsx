import { useState, useEffect } from 'react';
import { useReadContract, usePublicClient, useBlockNumber, useChainId } from 'wagmi';
import { getContractAddress } from '../../config/contract';
import { SURVEY_REVEAL_ABI } from '../../abi/SurveyReveal';

interface SurveyListProps {
  onSurveySelect: (surveyId: number) => void;
}

interface Survey {
  id: number;
  title: string;
  creator: string;
  startTime: bigint;
  endTime: bigint;
  responseCount: bigint;
  questionCount: number;
}

type FilterType = "all" | "active" | "ended" | "my-surveys";

export function SurveyList({ onSurveySelect }: SurveyListProps) {
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [isLoading, setIsLoading] = useState(false);
  const publicClient = usePublicClient();
  const { data: blockNumber } = useBlockNumber({ watch: true }); // Watch for new blocks

  const { data: surveyCount, refetch } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: SURVEY_REVEAL_ABI,
    functionName: 'getSurveyCount',
    query: {
      refetchInterval: 3000, // Refetch every 3 seconds
    }
  });

  // Refetch survey count when new block is mined
  useEffect(() => {
    if (blockNumber) {
      console.log('[SurveyList] New block detected, refetching survey count...');
      refetch();
    }
  }, [blockNumber, refetch]);

  // Log survey count changes
  useEffect(() => {
    console.log('[SurveyList] Survey count:', surveyCount?.toString());
  }, [surveyCount]);

  useEffect(() => {
    const fetchSurveys = async () => {
      console.log('[SurveyList] useEffect triggered');
      console.log('[SurveyList] surveyCount:', surveyCount?.toString());
      console.log('[SurveyList] publicClient:', !!publicClient);
      console.log('[SurveyList] contractAddress:', contractAddress);
      
      if (!surveyCount || surveyCount === 0n) {
        console.log('[SurveyList] No surveys to fetch (count is 0 or undefined)');
        setSurveys([]);
        return;
      }

      if (!publicClient) {
        console.log('[SurveyList] Public client not ready');
        return;
      }

      console.log(`[SurveyList] Starting to fetch ${surveyCount} surveys...`);
      setIsLoading(true);
      try {
        const fetchedSurveys: Survey[] = [];
        
        // Fetch each survey's details from the contract
        for (let i = 0; i < Number(surveyCount); i++) {
          try {
            console.log(`[SurveyList] Fetching survey ${i}...`);
            const surveyData = await publicClient.readContract({
              address: contractAddress as `0x${string}`,
              abi: SURVEY_REVEAL_ABI,
              functionName: 'getSurvey',
              args: [BigInt(i)],
            }) as any;

            console.log(`[SurveyList] Survey ${i} data:`, surveyData);

            fetchedSurveys.push({
              id: i,
              title: surveyData[0] as string,
              creator: surveyData[2] as string,
              startTime: surveyData[3] as bigint,
              endTime: surveyData[4] as bigint,
              responseCount: surveyData[5] as bigint,
              questionCount: Number(surveyData[6]),
            });
          } catch (err) {
            console.error(`[SurveyList] Error fetching survey ${i}:`, err);
          }
        }
        
        console.log('[SurveyList] All surveys fetched:', fetchedSurveys);
        setSurveys(fetchedSurveys);
      } catch (error) {
        console.error('[SurveyList] Error fetching surveys:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSurveys();
  }, [surveyCount, publicClient, contractAddress]);

  const getSurveyStatus = (startTime: bigint, endTime: bigint): string => {
    const now = Math.floor(Date.now() / 1000);
    if (now < Number(startTime)) return '🕐 Not Started';
    if (now > Number(endTime)) return '⏱️ Ended';
    return '✅ Active';
  };

  const formatDate = (timestamp: bigint): string => {
    return new Date(Number(timestamp) * 1000).toLocaleDateString();
  };

  const containerStyle: React.CSSProperties = {
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '32px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
    maxWidth: '900px',
    margin: '0 auto'
  };

  const headerStyle: React.CSSProperties = {
    fontSize: '28px',
    fontWeight: '700',
    color: '#6366f1',
    marginBottom: '8px',
    textAlign: 'center'
  };

  const subHeaderStyle: React.CSSProperties = {
    fontSize: '16px',
    color: '#6b7280',
    marginBottom: '32px',
    textAlign: 'center'
  };

  const surveyGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '20px',
    marginTop: '24px'
  };

  const loadingStyle: React.CSSProperties = {
    textAlign: 'center',
    padding: '40px',
    color: '#6b7280',
    fontSize: '16px'
  };

  const emptyStateStyle: React.CSSProperties = {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#6b7280'
  };

  if (isLoading) {
    return (
      <div style={containerStyle}>
        <div style={loadingStyle}>⏳ Loading surveys...</div>
      </div>
    );
  }

  if (!surveyCount || surveyCount === 0n) {
    return (
      <div style={containerStyle}>
        <h2 style={headerStyle}>Survey List</h2>
        <div style={emptyStateStyle}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
          <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: '#374151' }}>
            No surveys yet
          </div>
          <div style={{ fontSize: '14px' }}>
            Create your first survey to get started!
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <h2 style={headerStyle}>Survey List</h2>
      <p style={subHeaderStyle}>
        Total surveys: <strong>{surveyCount.toString()}</strong>
      </p>
      
      <div style={surveyGridStyle}>
        {surveys.map((survey) => {
          const status = getSurveyStatus(survey.startTime, survey.endTime);
          
          return (
            <SurveyCard
              key={survey.id}
              survey={survey}
              status={status}
              onSelect={() => onSurveySelect(survey.id)}
              formatDate={formatDate}
            />
          );
        })}
      </div>
    </div>
  );
}

interface SurveyCardProps {
  survey: Survey;
  status: string;
  onSelect: () => void;
  formatDate: (timestamp: bigint) => string;
}

function SurveyCard({ survey, status, onSelect, formatDate }: SurveyCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const surveyCardStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
    padding: '24px',
    borderRadius: '12px',
    border: '2px solid #e5e7eb',
    cursor: 'pointer',
    transition: 'all 0.2s',
  };

  const surveyCardHoverStyle: React.CSSProperties = {
    ...surveyCardStyle,
    transform: 'translateY(-4px)',
    boxShadow: '0 8px 24px rgba(99, 102, 241, 0.2)',
    borderColor: '#6366f1'
  };

  const surveyTitleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: '12px',
    lineHeight: '1.4'
  };

  const surveyInfoStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#6b7280',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  };

  const statusBadgeStyle = (status: string): React.CSSProperties => ({
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '600',
    marginTop: '8px',
    background: status === '✅ Active' ? '#dcfce7' : 
                status === '🕐 Not Started' ? '#dbeafe' : '#fee2e2',
    color: status === '✅ Active' ? '#166534' : 
           status === '🕐 Not Started' ? '#1e40af' : '#991b1b'
  });

  return (
    <div 
      style={isHovered ? surveyCardHoverStyle : surveyCardStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onSelect}
    >
      <div style={surveyTitleStyle}>
        {survey.title || `Survey #${survey.id}`}
      </div>
      
      <div style={surveyInfoStyle}>
        <span>🆔</span>
        <span>ID: {survey.id}</span>
      </div>
      
      <div style={surveyInfoStyle}>
        <span>❓</span>
        <span>Questions: {survey.questionCount}</span>
      </div>
      
      <div style={surveyInfoStyle}>
        <span>📊</span>
        <span>Responses: {survey.responseCount.toString()}</span>
      </div>
      
      <div style={surveyInfoStyle}>
        <span>👤</span>
        <span>Creator: {survey.creator.slice(0, 6)}...{survey.creator.slice(-4)}</span>
      </div>
      
      <div style={surveyInfoStyle}>
        <span>📅</span>
        <span>Until: {formatDate(survey.endTime)}</span>
      </div>
      
      <div style={statusBadgeStyle(status)}>
        {status}
      </div>

      {status === 'Active' && (
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          width: '8px',
          height: '8px',
          backgroundColor: '#10b981',
          borderRadius: '50%',
          animation: 'pulse 2s infinite'
        }} />
      )}
    </div>
  );
}
