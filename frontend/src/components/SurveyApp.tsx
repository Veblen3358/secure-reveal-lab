import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { CreateSurvey } from './survey/CreateSurvey';
import { SurveyList } from './survey/SurveyList';
import { SubmitResponse } from './survey/SubmitResponse';
import { ViewResponses } from './survey/ViewResponses';

type Tab = 'list' | 'create' | 'submit' | 'view';

export function SurveyApp() {
  const { isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<Tab>('list');
  const [selectedSurveyId, setSelectedSurveyId] = useState<number | null>(null);

  const handleSurveySelect = (surveyId: number) => {
    setSelectedSurveyId(surveyId);
    setActiveTab('submit');
  };

  const handleSurveyCreated = () => {
    // Switch to list view after survey is created
    setActiveTab('list');
  };

  const headerStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '32px 0',
    marginBottom: '40px',
    borderRadius: '0 0 24px 24px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
  };

  const containerStyle: React.CSSProperties = {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 24px'
  };

  const headerContentStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    color: 'white'
  };

  const titleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '32px',
    fontWeight: '700',
    letterSpacing: '-0.5px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  };

  const navStyle: React.CSSProperties = {
    display: 'flex',
    gap: '4px',
    marginBottom: '32px',
    background: 'white',
    padding: '8px',
    borderRadius: '12px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
    border: '1px solid #e5e7eb'
  };

  const getTabStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '12px 24px',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: isConnected || activeTab === 'list' ? 'pointer' : 'not-allowed',
    transition: 'all 0.2s ease',
    background: isActive
      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      : 'transparent',
    color: isActive ? 'white' : '#6b7280',
    opacity: (!isConnected && activeTab !== 'list' && !isActive) ? 0.5 : 1,
    transform: isActive ? 'translateY(-1px)' : 'none',
    boxShadow: isActive ? '0 4px 12px rgba(102, 126, 234, 0.3)' : 'none'
  });

  const welcomeCardStyle: React.CSSProperties = {
    background: 'white',
    borderRadius: '16px',
    padding: '48px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
    textAlign: 'center',
    maxWidth: '600px',
    margin: '0 auto'
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(to bottom, #f8fafc, #e2e8f0)' }}>
      <header style={headerStyle}>
        <div style={containerStyle}>
          <div style={headerContentStyle}>
            <div>
              <h1 style={titleStyle}>
                🔒 SecureReveal
              </h1>
              <p style={{ margin: '8px 0 0 0', opacity: 0.9, fontSize: '18px' }}>
                Encrypted Survey System with Zama FHE
              </p>
            </div>
            <ConnectButton />
          </div>
        </div>
      </header>

      <div style={containerStyle}>
        {!isConnected ? (
          <div style={welcomeCardStyle}>
            <div style={{ fontSize: '64px', marginBottom: '24px' }}>🔐</div>
            <h2 style={{ fontSize: '28px', marginBottom: '16px', color: '#1f2937' }}>
              Welcome to SecureReveal
            </h2>
            <p style={{ fontSize: '16px', color: '#6b7280', lineHeight: '1.6', marginBottom: '24px' }}>
              An encrypted survey system built with FHE (Fully Homomorphic Encryption).
              Create surveys, submit encrypted responses, and reveal results securely.
            </p>
            <div style={{
              background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)',
              padding: '20px',
              borderRadius: '12px',
              marginTop: '24px'
            }}>
              <p style={{ margin: 0, color: '#667eea', fontWeight: '600' }}>
                👆 Connect your wallet to get started
              </p>
            </div>
          </div>
        ) : (
          <>
            <nav style={navStyle}>
              <button
                onClick={() => setActiveTab('list')}
                style={getTabStyle(activeTab === 'list')}
              >
                📋 Survey List
              </button>
              <button
                onClick={() => setActiveTab('create')}
                style={getTabStyle(activeTab === 'create')}
                disabled={!isConnected}
              >
                ✨ Create Survey
              </button>
              <button
                onClick={() => setActiveTab('submit')}
                style={getTabStyle(activeTab === 'submit')}
                disabled={!isConnected}
              >
                ✍️ Submit Response
              </button>
              <button
                onClick={() => setActiveTab('view')}
                style={getTabStyle(activeTab === 'view')}
                disabled={!isConnected}
              >
                👁️ View Responses
              </button>
            </nav>

            <div style={{ minHeight: '400px' }}>
              {activeTab === 'list' && <SurveyList onSurveySelect={handleSurveySelect} />}
              {activeTab === 'create' && <CreateSurvey onSurveyCreated={handleSurveyCreated} />}
              {activeTab === 'submit' && <SubmitResponse selectedSurveyId={selectedSurveyId} />}
              {activeTab === 'view' && <ViewResponses />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}





