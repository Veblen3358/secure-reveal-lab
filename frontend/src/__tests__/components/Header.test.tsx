/**
 * Unit tests for Header component
 * Tests rendering of logo, title, and wallet button
 * **Validates: Requirements 1.4**
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock the RainbowKit ConnectButton
vi.mock('@rainbow-me/rainbowkit', () => ({
  ConnectButton: () => <button data-testid="connect-button">Connect Wallet</button>,
}))

// Mock lucide-react Shield icon
vi.mock('lucide-react', () => ({
  Shield: () => <svg data-testid="shield-icon" />,
}))

import { Header } from '@/components/Header'

describe('Header Component', () => {
  it('should render the application title', () => {
    render(<Header />)
    
    expect(screen.getByText('SecureReveal')).toBeInTheDocument()
  })

  it('should render the logo icon', () => {
    render(<Header />)
    
    expect(screen.getByTestId('shield-icon')).toBeInTheDocument()
  })

  it('should render the wallet connect button', () => {
    render(<Header />)
    
    expect(screen.getByTestId('connect-button')).toBeInTheDocument()
  })

  it('should have fixed positioning with backdrop blur', () => {
    render(<Header />)
    
    const header = screen.getByRole('banner')
    expect(header).toHaveClass('fixed')
    expect(header).toHaveClass('backdrop-blur-md')
  })

  it('should accept custom className prop', () => {
    render(<Header className="custom-class" />)
    
    const header = screen.getByRole('banner')
    expect(header).toHaveClass('custom-class')
  })
})
