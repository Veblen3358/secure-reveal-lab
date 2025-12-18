import { Shield, Github, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface FooterProps {
  className?: string
}

const technologies = [
  { name: 'Zama FHE', variant: 'default' as const },
  { name: 'React', variant: 'secondary' as const },
  { name: 'Vite', variant: 'outline' as const },
  { name: 'Tailwind CSS', variant: 'outline' as const },
  { name: 'Ethereum', variant: 'default' as const },
]

const links = [
  { name: 'Documentation', href: '#' },
  { name: 'GitHub', href: '#', icon: Github },
  { name: 'Zama', href: 'https://www.zama.ai/', icon: ExternalLink },
]

export function Footer({ className }: FooterProps) {
  const currentYear = new Date().getFullYear()

  return (
    <footer
      className={cn(
        'bg-foreground text-background',
        'py-12 px-4 sm:px-6 lg:px-8',
        className
      )}
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Branding Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-hero">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold">SecureReveal</span>
            </div>
            <p className="text-sm text-background/70 max-w-xs">
              Privacy-preserving surveys powered by Fully Homomorphic Encryption. 
              Your responses, your privacy.
            </p>
          </div>

          {/* Technology Badges */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-background/80">
              Built With
            </h3>
            <div className="flex flex-wrap gap-2">
              {technologies.map((tech) => (
                <Badge
                  key={tech.name}
                  variant={tech.variant}
                  className="text-xs"
                >
                  {tech.name}
                </Badge>
              ))}
            </div>
          </div>

          {/* Links Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-background/80">
              Resources
            </h3>
            <ul className="space-y-2">
              {links.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    className="inline-flex items-center gap-2 text-sm text-background/70 hover:text-background transition-colors"
                    target={link.href.startsWith('http') ? '_blank' : undefined}
                    rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  >
                    {link.icon && <link.icon className="h-4 w-4" />}
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-background/10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-background/60">
              © {currentYear} SecureReveal. All rights reserved.
            </p>
            <div className="flex items-center gap-2 text-sm text-background/60">
              <span className="privacy-badge">
                <Shield className="h-3 w-3" />
                FHE Protected
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
