import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HeaderProps {
  showNav?: boolean
  className?: string
}

export function Header({ className }: HeaderProps) {
  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50',
        'bg-background/80 backdrop-blur-md',
        'border-b border-border/50',
        'px-4 sm:px-6 lg:px-8',
        className
      )}
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex h-16 items-center justify-between">
          {/* Logo Section */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-hero shadow-campaign">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              SecureReveal
            </h1>
          </div>

          {/* Wallet Connection Section */}
          <div className="flex items-center gap-4">
            <ConnectButton />
          </div>
        </div>
      </div>
    </header>
  )
}





