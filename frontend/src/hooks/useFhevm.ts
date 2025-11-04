import { useState, useEffect } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { JsonRpcProvider, isAddress } from 'ethers';

// Fetch FHEVM contract addresses from Hardhat node
async function getFhevmMetadata(rpcUrl: string) {
  const provider = new JsonRpcProvider(rpcUrl);
  try {
    const metadata = await provider.send('fhevm_relayer_metadata', []);
    
    // Validate addresses
    if (!metadata || typeof metadata !== 'object') {
      console.error('[FHEVM] Invalid metadata:', metadata);
      return null;
    }
    
    const acl = metadata.ACLAddress || metadata.aclAddress;
    const inputVerifier = metadata.InputVerifierAddress || metadata.inputVerifierAddress;
    const kms = metadata.KMSVerifierAddress || metadata.kmsVerifierAddress;
    
    if (!acl || !inputVerifier || !kms) {
      console.error('[FHEVM] Missing addresses in metadata:', metadata);
      return null;
    }
    
    // Ensure addresses are strings and valid
    const aclStr = String(acl);
    const inputVerifierStr = String(inputVerifier);
    const kmsStr = String(kms);
    
    if (!isAddress(aclStr) || !isAddress(inputVerifierStr) || !isAddress(kmsStr)) {
      console.error('[FHEVM] Invalid addresses:', { acl: aclStr, inputVerifier: inputVerifierStr, kms: kmsStr });
      return null;
    }
    
    return {
      ACLAddress: aclStr as `0x${string}`,
      InputVerifierAddress: inputVerifierStr as `0x${string}`,
      KMSVerifierAddress: kmsStr as `0x${string}`,
    };
  } catch (e) {
    console.error('[FHEVM] Failed to get metadata:', e);
    return null;
  } finally {
    provider.destroy();
  }
}

export function useFhevm() {
  const [fhevmInstance, setFhevmInstance] = useState<any | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  useEffect(() => {
    const initFhevm = async () => {
      if (!isConnected || !address) {
        setFhevmInstance(null);
        return;
      }

      setIsInitializing(true);
      
      try {
        if (!window.ethereum) {
          setFhevmInstance(null);
          setIsInitializing(false);
          return;
        }

        if (chainId === 31337) {
          console.log('[FHEVM] Localhost - fetching FHEVM metadata...');
          
          // Get FHEVM contract addresses from Hardhat node
          const metadata = await getFhevmMetadata('http://127.0.0.1:8545');
          
          if (!metadata) {
            console.error('[FHEVM] Failed to get valid FHEVM metadata');
            setFhevmInstance(null);
            setIsInitializing(false);
            return;
          }
          
          console.log('[FHEVM] Valid metadata received:');
          console.log('  ACL:', metadata.ACLAddress);
          console.log('  InputVerifier:', metadata.InputVerifierAddress);
          console.log('  KMS:', metadata.KMSVerifierAddress);
          
          // Dynamic import to avoid bundling mock-utils in production
          const { MockFhevmInstance } = await import('@fhevm/mock-utils');
          
          const provider = new JsonRpcProvider('http://127.0.0.1:8545');
          
          // Create MockFhevmInstance with 3 parameters (like lucky project)
          const instance = await MockFhevmInstance.create(provider, provider, {
            aclContractAddress: metadata.ACLAddress,
            chainId: chainId,
            gatewayChainId: 55815,
            inputVerifierContractAddress: metadata.InputVerifierAddress,
            kmsContractAddress: metadata.KMSVerifierAddress,
            verifyingContractAddressDecryption: '0x5ffdaAB0373E62E2ea2944776209aEf29E631A64',
            verifyingContractAddressInputVerification: '0x812b06e1CDCE800494b79fFE4f925A504a9A9810',
          });
          
          console.log('[FHEVM] ✅ Mock instance created successfully!');
          setFhevmInstance(instance);
        } else if (chainId === 11155111) {
          console.log('[FHEVM] Sepolia - initializing Relayer SDK (like lucky project)...');
          
          try {
            // Import from /bundle like lucky project
            const { createInstance, SepoliaConfig, initSDK } = await import('@zama-fhe/relayer-sdk/bundle');
            
            // Initialize SDK first (like lucky project)
            console.log('[FHEVM] Calling initSDK()...');
            await initSDK();
            console.log('[FHEVM] initSDK() completed');
            
            // Use built-in SepoliaConfig with network provider (like lucky project)
            const config = {
              ...SepoliaConfig,
              network: window.ethereum
            };
            
            console.log('[FHEVM] Creating instance with config:', config);
            const instance = await createInstance(config);
            
            console.log('[FHEVM] ✅ Sepolia instance created successfully!');
            console.log('[FHEVM] Instance details:', {
              hasCreateEncryptedInput: typeof instance?.createEncryptedInput === 'function',
              hasGetPublicKey: typeof instance?.getPublicKey === 'function',
            });
            setFhevmInstance(instance);
          } catch (relayerError: any) {
            console.error('[FHEVM] ❌ Relayer SDK error:', relayerError?.message || relayerError);
            console.error('[FHEVM] ❌ Error stack:', relayerError?.stack);
            console.error('[FHEVM] ⚠️ FHEVM initialization failed for Sepolia');
            console.error('[FHEVM] Possible reasons: Relayer service unavailable, network issues, or invalid configuration');
            setFhevmInstance(null);
          }
        } else {
          console.warn('[FHEVM] Unsupported network:', chainId);
          setFhevmInstance(null);
        }
      } catch (error: any) {
        console.error('[FHEVM] ❌ Error:', error?.message || error);
        console.error('[FHEVM] ❌ Stack:', error?.stack);
        setFhevmInstance(null);
      } finally {
        setIsInitializing(false);
      }
    };

    initFhevm();
  }, [address, isConnected, chainId]);

  return { fhevmInstance, isInitializing };
}
