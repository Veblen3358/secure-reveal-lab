import { ConnectButton } from '@rainbow-me/rainbowkit';

export function Header() {
  return (
    <header className="header">
      <div className="logo-section">
        <img src="/logo.svg" alt="SecureReveal Logo" className="logo" />
        <h1 className="app-title">SecureReveal</h1>
      </div>
      <div className="wallet-section">
        <ConnectButton />
      </div>
    </header>
  );
}





