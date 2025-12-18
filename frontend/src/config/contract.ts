// Contract addresses for different networks
export const CONTRACT_ADDRESSES: Record<number, string> = {
  31337: '0x5FbDB2315678afecb367f032d93F642f64180aa3', // Localhost - Latest deployment with statistics
  11155111: '0x6a83972c779E237E7f2A1c562aa20257C7a90Ea0', // Sepolia - Latest deployment
};

// Get contract address based on chain ID
export function getContractAddress(chainId: number | undefined): string {
  if (!chainId) {
    console.warn('[Contract] ChainId is undefined, using localhost');
    return CONTRACT_ADDRESSES[31337];
  }
  
  const address = CONTRACT_ADDRESSES[chainId];
  if (!address) {
    console.warn(`[Contract] No address for chainId ${chainId}, using localhost`);
    return CONTRACT_ADDRESSES[31337];
  }
  
  console.log(`[Contract] Using address ${address} for chainId ${chainId}`);
  return address;
}

// For backwards compatibility
export const CONTRACT_ADDRESS = CONTRACT_ADDRESSES[31337];

export const NETWORK_CONFIG = {
  localhost: {
    chainId: 31337,
    name: 'Localhost',
    rpcUrl: 'http://localhost:8545',
  },
  sepolia: {
    chainId: 11155111,
    name: 'Sepolia',
    rpcUrl: 'https://1rpc.io/sepolia',
  },
};
