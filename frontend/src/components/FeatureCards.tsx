import {
  Shield,
  Lock,
  Eye,
  Database,
  Zap,
  Users,
  CheckCircle,
  Key,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface FeatureCardsProps {
  className?: string
}

const features = [
  {
    icon: Shield,
    title: 'FHE Encryption',
    description:
      'Fully Homomorphic Encryption allows computations on encrypted data without ever decrypting it.',
    gradient: 'bg-gradient-hero',
  },
  {
    icon: Lock,
    title: 'Private Responses',
    description:
      'Individual survey responses remain encrypted and private throughout the entire process.',
    gradient: 'bg-gradient-privacy',
  },
  {
    icon: Eye,
    title: 'Selective Reveal',
    description:
      'Only survey creators can reveal aggregated results, individual responses stay hidden.',
    gradient: 'bg-gradient-encrypted',
  },
  {
    icon: Database,
    title: 'On-Chain Storage',
    description:
      'All encrypted data is stored securely on the blockchain for transparency and immutability.',
    gradient: 'bg-gradient-hero',
  },
  {
    icon: Zap,
    title: 'Fast Processing',
    description:
      'Optimized FHE operations ensure quick response submission and result computation.',
    gradient: 'bg-gradient-privacy',
  },
  {
    icon: Users,
    title: 'Anonymous Participation',
    description:
      'Participate in surveys without revealing your identity or individual choices.',
    gradient: 'bg-gradient-encrypted',
  },
  {
    icon: CheckCircle,
    title: 'Verifiable Results',
    description:
      'Cryptographic proofs ensure that revealed results accurately reflect encrypted submissions.',
    gradient: 'bg-gradient-hero',
  },
  {
    icon: Key,
    title: 'Wallet Integration',
    description:
      'Seamless connection with your Web3 wallet for secure authentication and transactions.',
    gradient: 'bg-gradient-privacy',
  },
]

export function FeatureCards({ className }: FeatureCardsProps) {
  return (
    <section className={cn('py-16 px-4 sm:px-6 lg:px-8', className)}>
      <div className="mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Why Choose <span className="text-gradient-hero">SecureReveal</span>?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Built on cutting-edge Fully Homomorphic Encryption technology to ensure 
            your survey data remains private and secure.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <FeatureCard key={index} {...feature} />
          ))}
        </div>
      </div>
    </section>
  )
}

interface FeatureCardProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  gradient: string
}

function FeatureCard({ icon: Icon, title, description, gradient }: FeatureCardProps) {
  return (
    <Card className="group relative overflow-hidden transition-all duration-300 hover:shadow-campaign hover:-translate-y-1 border-border/50">
      <CardHeader className="pb-2">
        <div
          className={cn(
            'mb-3 flex h-12 w-12 items-center justify-center rounded-lg',
            gradient,
            'shadow-lg transition-transform duration-300 group-hover:scale-110'
          )}
        >
          <Icon className="h-6 w-6 text-white" />
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-sm">{description}</CardDescription>
      </CardContent>
      {/* Hover gradient overlay */}
      <div className="absolute inset-0 bg-gradient-hero opacity-0 transition-opacity duration-300 group-hover:opacity-5" />
    </Card>
  )
}
