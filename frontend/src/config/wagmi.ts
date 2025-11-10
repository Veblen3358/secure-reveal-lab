import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';
import { http } from 'wagmi';
import { defineChain } from 'viem';

// Define custom localhost chain with Hardhat's chainId (31337)
const localhost = defineChain({
  id: 31337,
  name: 'Localhost',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8545'] },
  },
});

const SEPOLIA_RPC_URL = 'https://1rpc.io/sepolia';

export const config = getDefaultConfig({
  appName: 'SecureReveal',
  projectId: 'YOUR_PROJECT_ID', // Get from https://cloud.walletconnect.com
  chains: [localhost, sepolia],
  transports: {
    [localhost.id]: http('http://127.0.0.1:8545'),
    [sepolia.id]: http(SEPOLIA_RPC_URL),
  },
  ssr: false,
});





