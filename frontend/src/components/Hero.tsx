import { Shield, Lock, Eye, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface HeroProps {
  onGetStarted?: () => void
  className?: string
}

export function Hero({ onGetStarted, className }: HeroProps) {
  return (
    <section
      className={cn(
        'relative min-h-[80vh] flex items-center justify-center overflow-hidden',
        'pt-20 pb-16 px-4 sm:px-6 lg:px-8',
        className
      )}
    >
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-hero opacity-10" />
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-accent/10 rounded-full blur-3xl animate-pulse delay-500" />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-4xl text-center">
        {/* Privacy Badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
          <Shield className="h-4 w-4" />
          <span>Powered by Zama FHE Technology</span>
        </div>

        {/* Main Headline */}
        <h1 className="mb-6 text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          <span className="block">Encrypted Surveys with</span>
          <span className="block text-gradient-hero">Complete Privacy</span>
        </h1>

        {/* Description */}
        <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground sm:text-xl">
          Create and participate in surveys where your responses remain encrypted 
          throughout the entire process. Only aggregated results are revealed, 
          ensuring individual privacy is never compromised.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            variant="campaign"
            size="lg"
            onClick={onGetStarted}
            className="w-full sm:w-auto"
          >
            <Sparkles className="mr-2 h-5 w-5" />
            Get Started
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full sm:w-auto"
          >
            Learn More
          </Button>
        </div>

        {/* Privacy Feature Highlights */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <PrivacyFeature
            icon={Lock}
            title="End-to-End Encryption"
            description="Responses encrypted from submission to reveal"
          />
          <PrivacyFeature
            icon={Eye}
            title="Zero Knowledge"
            description="Individual responses never exposed"
          />
          <PrivacyFeature
            icon={Shield}
            title="FHE Protected"
            description="Fully Homomorphic Encryption technology"
          />
        </div>
      </div>
    </section>
  )
}

interface PrivacyFeatureProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}

function PrivacyFeature({ icon: Icon, title, description }: PrivacyFeatureProps) {
  return (
    <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-card/50 backdrop-blur-sm border border-border/50">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-privacy">
        <Icon className="h-5 w-5 text-privacy-foreground" />
      </div>
      <h3 className="font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground text-center">{description}</p>
    </div>
  )
}
