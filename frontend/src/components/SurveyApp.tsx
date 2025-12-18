import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { CreateSurvey } from './survey/CreateSurvey';
import { SurveyList } from './survey/SurveyList';
import { SubmitResponse } from './survey/SubmitResponse';
import { ViewResponses } from './survey/ViewResponses';
import { ViewStatistics } from './survey/ViewStatistics';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Lock, ClipboardList, Sparkles, PenLine, Eye, BarChart3 } from 'lucide-react';

type Tab = 'list' | 'create' | 'submit' | 'view' | 'statistics';

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

  const handleTabChange = (value: string) => {
    setActiveTab(value as Tab);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/50">
      {/* Header */}
      <header className="bg-gradient-hero py-8 mb-10 rounded-b-3xl shadow-campaign">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between text-white">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                <Lock className="h-8 w-8" />
                SecureReveal
              </h1>
              <p className="mt-2 text-lg opacity-90">
                Encrypted Survey System with Zama FHE
              </p>
            </div>
            <ConnectButton />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6">
        {!isConnected ? (
          /* Welcome Card for Disconnected State */
          <Card className="max-w-xl mx-auto text-center shadow-lg border-0 bg-gradient-to-br from-card to-muted/30">
            <CardHeader className="pb-4">
              <div className="text-6xl mb-4">🔐</div>
              <CardTitle className="text-2xl">Welcome to SecureReveal</CardTitle>
              <CardDescription className="text-base leading-relaxed">
                An encrypted survey system built with FHE (Fully Homomorphic Encryption).
                Create surveys, submit encrypted responses, and reveal results securely.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gradient-to-r from-primary/10 to-secondary/10 p-5 rounded-xl">
                <p className="text-primary font-semibold flex items-center justify-center gap-2">
                  <span>👆</span> Connect your wallet to get started
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Navigation Tabs */}
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
              <TabsList className="w-full h-auto p-2 mb-8 grid grid-cols-5 gap-2">
                <TabsTrigger 
                  value="list" 
                  className="flex items-center gap-2 py-3.5 px-5 text-base font-semibold transition-all duration-300 data-[state=active]:scale-105"
                >
                  <ClipboardList className="h-4 w-4 transition-transform duration-300 data-[state=active]:scale-110" />
                  Survey List
                </TabsTrigger>
                <TabsTrigger 
                  value="create" 
                  disabled={!isConnected}
                  className="flex items-center gap-2 py-3.5 px-5 text-base font-semibold transition-all duration-300 data-[state=active]:scale-105 disabled:opacity-40"
                >
                  <Sparkles className="h-4 w-4 transition-transform duration-300 data-[state=active]:scale-110" />
                  Create Survey
                </TabsTrigger>
                <TabsTrigger 
                  value="submit" 
                  disabled={!isConnected}
                  className="flex items-center gap-2 py-3.5 px-5 text-base font-semibold transition-all duration-300 data-[state=active]:scale-105 disabled:opacity-40"
                >
                  <PenLine className="h-4 w-4 transition-transform duration-300 data-[state=active]:scale-110" />
                  Submit Response
                </TabsTrigger>
                <TabsTrigger 
                  value="view" 
                  disabled={!isConnected}
                  className="flex items-center gap-2 py-3.5 px-5 text-base font-semibold transition-all duration-300 data-[state=active]:scale-105 disabled:opacity-40"
                >
                  <Eye className="h-4 w-4 transition-transform duration-300 data-[state=active]:scale-110" />
                  View Responses
                </TabsTrigger>
                <TabsTrigger 
                  value="statistics" 
                  disabled={!isConnected}
                  className="flex items-center gap-2 py-3.5 px-5 text-base font-semibold transition-all duration-300 data-[state=active]:scale-105 disabled:opacity-40"
                >
                  <BarChart3 className="h-4 w-4 transition-transform duration-300 data-[state=active]:scale-110" />
                  Statistics
                </TabsTrigger>
              </TabsList>

              <div className="min-h-[400px]">
                <TabsContent value="list" className="mt-0">
                  <SurveyList onSurveySelect={handleSurveySelect} />
                </TabsContent>
                <TabsContent value="create" className="mt-0">
                  <CreateSurvey onSurveyCreated={handleSurveyCreated} />
                </TabsContent>
                <TabsContent value="submit" className="mt-0">
                  <SubmitResponse selectedSurveyId={selectedSurveyId} />
                </TabsContent>
                <TabsContent value="view" className="mt-0">
                  <ViewResponses />
                </TabsContent>
                <TabsContent value="statistics" className="mt-0">
                  <ViewStatistics />
                </TabsContent>
              </div>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
