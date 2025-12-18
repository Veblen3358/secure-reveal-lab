import { useAccount } from 'wagmi'
import { Wallet, CheckCircle, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface WalletStatusProps {
  className?: string
  showAddress?: boolean
}

export function WalletStatus({ className, showAddress = true }: WalletStatusProps) {
  const { address, isConnected } = useAccount()

  // Format address to show first 6 and last 4 characters
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {isConnected ? (
        <>
          <Badge variant="success" className="flex items-center gap-1.5">
            <CheckCircle className="h-3 w-3" />
            Connected
          </Badge>
          {showAddress && address && (
            <Badge variant="outline" className="flex items-center gap-1.5 font-mono">
              <Wallet className="h-3 w-3" />
              {formatAddress(address)}
            </Badge>
          )}
        </>
      ) : (
        <Badge variant="destructive" className="flex items-center gap-1.5">
          <XCircle className="h-3 w-3" />
          Not Connected
        </Badge>
      )}
    </div>
  )
}
