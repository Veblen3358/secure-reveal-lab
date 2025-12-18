import { useNavigate } from 'react-router-dom'
import { Header } from '@/components/Header'
import { Hero } from '@/components/Hero'
import { FeatureCards } from '@/components/FeatureCards'
import { Footer } from '@/components/Footer'

export function Index() {
  const navigate = useNavigate()

  const handleGetStarted = () => {
    navigate('/app')
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Fixed Header */}
      <Header />

      {/* Main Content */}
      <main className="flex-1">
        {/* Hero Section */}
        <Hero onGetStarted={handleGetStarted} />

        {/* Feature Cards Section */}
        <FeatureCards className="bg-muted/30" />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  )
}
