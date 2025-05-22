'use client';

import { useState, useEffect } from 'react';
import { useAccount, useSwitchChain, useSignTypedData, useSignMessage, useWriteContract, useWaitForTransactionReceipt, useBalance } from 'wagmi';
import { MONAD_TESTNET_ID } from '@/config';
import useMagicEdenInventory from '@/hooks/useMagicEdenInventory';
import { getRarityBadgeClass, getElementalName } from '@/lib/elementals';
import { ethers } from 'ethers';
import { parseEther, encodeFunctionData, formatEther } from "viem";

// Add type declaration for window.ethereum
declare global {
  interface Window {
    ethereum: any;
  }
}

// Placeholder address for when no wallet is connected
const PLACEHOLDER_ADDRESS = "0x0000000000000000000000000000000000000000";

// Interface for marketplace listings
interface Listing {
  id: string;
  tokenId: string;
  name: string;
  image: string;
  rarity: string;
  species?: string;
  price: string;
  seller: string;
  elementType: string;
  signature: string;
  expiration: number;
  contract?: string;
  source?: string;
  rawOrder?: string;
}

// Filter options
type FilterOptions = {
  species: string | null;
  rarity: string | null;
  priceRange: [number, number] | null;
};

export default function MagicEdenMarketplace() {
  const { address, isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const { inventory, isLoading: isInventoryLoading } = useMagicEdenInventory(address as string);
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContract, isPending: isWritePending, data: txHash, error: writeError } = useWriteContract();
  const { isLoading: isWaitingForTx, isSuccess: txSuccess, isError: txError, error: txErrorData } = useWaitForTransactionReceipt({
    hash: txHash,
  });
  const { data: balanceData, refetch: refetchBalance } = useBalance({
    address: address as `0x${string}`,
  });
  
  const [listings, setListings] = useState<Listing[]>([]);
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'all' | 'my-listings'>('all');
  const [lastTxHash, setLastTxHash] = useState<string>('');
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [currentAction, setCurrentAction] = useState<string>('');
  const [txStatus, setTxStatus] = useState<'none' | 'pending' | 'success' | 'error'>('none');
  const [currentPurchaseListing, setCurrentPurchaseListing] = useState<Listing | null>(null);
  const [useHigherGas, setUseHigherGas] = useState(false);
  const [useMuchHigherGas, setUseMuchHigherGas] = useState(false);
  const [isMonitoringTx, setIsMonitoringTx] = useState<boolean>(false);
  const [ownershipStatus, setOwnershipStatus] = useState<any>(null);
  
  // Filter states
  const [filters, setFilters] = useState<FilterOptions>({
    species: null,
    rarity: null,
    priceRange: null
  });
  const [showFilters, setShowFilters] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  // Add console log when component mounts to show wallet address
  useEffect(() => {
    console.log("MagicEdenMarketplace: Connected wallet address:", address);
    
    fetchListings();
    
    // Check for success message in URL
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const tokenId = urlParams.get('tokenId');
    const price = urlParams.get('price');
    
    if (success === 'true' && tokenId && price) {
      setLastTxHash('Listing created');
      fetchListings(); // Refresh listings
    }
  }, [address]);

  // Function to fetch listings
  const fetchListings = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Add timestamp and wallet address to prevent caching and use connected wallet
      console.log("Fetching listings with wallet address:", address);
      const response = await fetch(`/api/getListings?t=${Date.now()}&wallet=${address || ''}`);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Process listings
      if (data.listings) {
        setListings(data.listings);
        
        // Log all listings for debugging
        console.log(`Received ${data.listings.length} listings from API`);
        
        // Filter my listings
        if (address) {
          const filtered = data.listings.filter(
            (listing: Listing) => listing.seller.toLowerCase() === address.toLowerCase()
          );
          console.log(`Found ${filtered.length} listings that belong to current wallet: ${address}`);
          setMyListings(filtered);
        }
      } else {
        setListings([]);
        setMyListings([]);
      }
    } catch (err) {
      console.error('Error fetching listings:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch listings');
      
      // Set sample listings for development
      const sampleListings = getSampleListings();
      setListings(sampleListings);
      
      if (address) {
        const filtered = sampleListings.filter((listing) => 
          listing.seller.toLowerCase() === address.toLowerCase()
        );
        setMyListings(filtered);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Apply filters to listings
  const applyFilters = (listings: Listing[]): Listing[] => {
    return listings.filter(listing => {
      // Species filter
      if (filters.species && listing.species !== filters.species) {
        return false;
      }
      
      // Rarity filter
      if (filters.rarity && listing.rarity !== filters.rarity) {
        return false;
      }
      
      // Price range filter
      if (filters.priceRange) {
        const price = parseFloat(listing.price);
        if (price < filters.priceRange[0] || price > filters.priceRange[1]) {
          return false;
        }
      }
      
      return true;
    });
  };

  // Get unique species from listings
  const getUniqueSpecies = (): string[] => {
    const species = new Set<string>();
    listings.forEach(listing => {
      if (listing.species) {
        species.add(listing.species);
      }
    });
    return Array.from(species);
  };

  // Get unique rarities from listings
  const getUniqueRarities = (): string[] => {
    const rarities = new Set<string>();
    listings.forEach(listing => {
      if (listing.rarity) {
        rarities.add(listing.rarity);
      }
    });
    return Array.from(rarities);
  };

  // Apply price range filter
  const applyPriceFilter = () => {
    if (minPrice === "" && maxPrice === "") {
      setFilters({...filters, priceRange: null});
      return;
    }
    
    const min = minPrice === "" ? 0 : parseFloat(minPrice);
    const max = maxPrice === "" ? Infinity : parseFloat(maxPrice);
    
    setFilters({...filters, priceRange: [min, max]});
  };

  // Reset all filters
  const resetFilters = () => {
    setFilters({
      species: null,
      rarity: null,
      priceRange: null
    });
    setMinPrice("");
    setMaxPrice("");
  };

  // Function to check if a listing is still available
  const checkListingAvailability = async (listing: Listing): Promise<boolean> => {
    try {
      // Fetch the latest listings
      const response = await fetch(`/api/getListings?t=${Date.now()}`);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.listings || !Array.isArray(data.listings)) {
        return false;
      }
      
      // Check if the listing still exists
      const foundListing = data.listings.find(
        (l: Listing) => l.id === listing.id && l.tokenId === listing.tokenId
      );
      
      return !!foundListing;
    } catch (err) {
      console.error('Error checking listing availability:', err);
      return true; // Assume it's available if we can't check to avoid blocking the user
    }
  };
  
  // Function to verify Magic Eden contract
  const verifyMagicEdenContract = async (contractAddress: string): Promise<{isValid: boolean, message: string}> => {
    try {
      // Known Magic Eden marketplace contract addresses on Monad Testnet
      const knownContracts = [
        "0x0000000000000068f116a894984e2db1123eb395", // Magic Eden v1
        "0x0000000000000068f116a894984e2db1123eb396"  // Add other versions if needed
      ];
      
      if (!contractAddress) {
        return { isValid: false, message: "Missing contract address" };
      }
      
      // Check if the address is a known Magic Eden contract
      const isKnown = knownContracts.some(
        contract => contract.toLowerCase() === contractAddress.toLowerCase()
      );
      
      if (!isKnown) {
        console.warn(`Unknown Magic Eden contract address: ${contractAddress}`);
        return { 
          isValid: false, 
          message: `Unknown marketplace contract: ${contractAddress}. This may be risky.` 
        };
      }
      
      return { isValid: true, message: "Valid Magic Eden contract" };
    } catch (err) {
      console.error('Error verifying Magic Eden contract:', err);
      return { 
        isValid: true, // Default to true to not block the transaction
        message: "Could not verify contract, proceed with caution" 
      };
    }
  };

  // Function to estimate gas with safety margin
  const estimateGasWithSafetyMargin = async (txData: any): Promise<bigint> => {
    try {
      // Default high gas limit for Magic Eden transactions
      const defaultGasLimit = BigInt(1000000);
      
      // If we're in a retry scenario, use an even higher gas limit
      if (useMuchHigherGas) {
        return BigInt(5000000); // 5 million gas for desperate retries
      } else if (useHigherGas) {
        return BigInt(3000000); // 3 million gas for normal retries
      }
      
      // Try to get a gas estimate from the blockchain
      const provider = new ethers.BrowserProvider(window.ethereum);
      
      // Create a transaction request for estimation
      const txRequest = {
        from: address,
        to: txData.to,
        value: txData.value,
        data: txData.data
      };
      
      try {
        // Try to estimate gas
        const gasEstimate = await provider.estimateGas(txRequest);
        console.log(`Gas estimate from provider: ${gasEstimate.toString()}`);
        
        // Add 100% safety margin to the estimate (double it)
        const safeGasLimit = gasEstimate * BigInt(2);
        console.log(`Gas with safety margin: ${safeGasLimit.toString()}`);
        
        // Return the higher of our safe estimate or default
        return safeGasLimit > defaultGasLimit ? safeGasLimit : defaultGasLimit;
      } catch (estimateError) {
        console.warn('Gas estimation failed, using default high gas limit:', estimateError);
        return defaultGasLimit;
      }
    } catch (error) {
      console.error('Error in gas estimation:', error);
      return BigInt(1000000); // Fallback to default high gas
    }
  };

  // Function to check if user has enough balance for purchase and gas
  const checkSufficientBalance = (listingPrice: string, gasEstimate: bigint = BigInt(0)): boolean => {
    if (!balanceData) return false;
    
    // Convert listing price to BigInt
    const priceInWei = BigInt(parseFloat(listingPrice) * 10**18);
    
    // Calculate gas cost (use higher estimate for Magic Eden transactions)
    const gasCost = gasEstimate > BigInt(0) ? gasEstimate : BigInt(0.05 * 10**18); // Default to 0.05 MONAD for gas
    
    // Total required = price + gas
    const totalRequired = priceInWei + gasCost;
    
    // User's balance
    const userBalance = balanceData.value;
    
    // Log for debugging
    console.log(`=== BALANCE CHECK ===`);
    console.log(`User balance: ${formatEther(userBalance)} MONAD`);
    console.log(`Listing price: ${listingPrice} MONAD`);
    console.log(`Estimated gas: ${formatEther(gasCost)} MONAD`);
    console.log(`Total required: ${formatEther(totalRequired)} MONAD`);
    console.log(`Sufficient funds: ${userBalance >= totalRequired ? 'Yes' : 'No'}`);
    
    // Return true if user has enough balance
    return userBalance >= totalRequired;
  };

  // Function to handle buying an NFT
  const handleBuy = async (listing: Listing, retryWithHigherGas = false) => {
    if (!address) {
      setError('Please connect your wallet');
      return;
    }
    
    if (chainId !== MONAD_TESTNET_ID) {
      handleSwitchNetwork();
      return;
    }
    
    // Refetch balance to ensure we have the latest data
    await refetchBalance();
    
    // Estimate gas cost based on retry status
    let estimatedGasCost = BigInt(0.05 * 10**18); // Default 0.05 MONAD
    if (useMuchHigherGas) {
      estimatedGasCost = BigInt(0.2 * 10**18); // 0.2 MONAD for desperate retries
    } else if (useHigherGas || retryWithHigherGas) {
      estimatedGasCost = BigInt(0.1 * 10**18); // 0.1 MONAD for normal retries
    }
    
    // Check if user has enough balance
    if (!checkSufficientBalance(listing.price, estimatedGasCost)) {
      setError(`Insufficient funds: You need at least ${listing.price} MONAD plus ~${formatEther(estimatedGasCost)} MONAD for gas`);
      return;
    }
    
    // Check if the listing is still available
    setIsProcessingAction(true);
    setCurrentAction('Checking listing availability...');
    
    const isAvailable = await checkListingAvailability(listing);
    
    if (!isAvailable) {
      setError(`This listing is no longer available. It may have been purchased or cancelled.`);
      setIsProcessingAction(false);
      setCurrentAction('');
      return;
    }
    
    setCurrentAction('Preparing purchase...');
    setTxStatus('none');
    setCurrentPurchaseListing(listing);
    
    try {
      // Log the wallet address being used from wagmi
      console.log(`=== PURCHASE TRANSACTION DETAILS ===`);
      console.log(`Using wagmi wallet address: ${address} for purchase`);
      console.log(`Chain ID: ${chainId}`);
      console.log(`Attempting to buy Elementals #${listing.tokenId} for ${listing.price} MONAD with address ${address}`);
      console.log(`Using higher gas: ${retryWithHigherGas}`);
      
      // Step 1: Get transaction data from our API
      const response = await fetch('/api/executePurchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({
          order: {
            id: listing.id,
            contract: "0x8549FaF1d5553dB17C9c6154141e5357758006cC",
            tokenId: listing.tokenId,
            price: listing.price,
            maker: listing.seller,
            signature: listing.signature,
            expiration: listing.expiration
          },
          taker: address  // Use the address from wagmi hook
        }),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to prepare purchase transaction');
      }
      
      console.log('Transaction data prepared:', data);
      
      // Step 2: Execute the transaction using wagmi
      setCurrentAction('Confirming transaction in wallet...');
      
      // Get transaction data
      const txData = data.data.transactionData;
      const wagmiData = data.data.wagmiCompatibleData;
      
      if (!txData || !wagmiData) {
        throw new Error('Transaction data not found');
      }
      
      // Verify the Magic Eden contract
      const contractVerification = await verifyMagicEdenContract(wagmiData.address);
      if (!contractVerification.isValid) {
        console.warn(contractVerification.message);
        setError(`Warning: ${contractVerification.message}`);
        // Continue with the transaction but warn the user
      }
      
      // Verify the transaction price matches the listing price
      const expectedPrice = BigInt(parseFloat(listing.price) * 10**18);
      const txPrice = BigInt(wagmiData.value || '0');
      
      console.log(`=== PRICE VERIFICATION ===`);
      console.log(`Expected price: ${formatEther(expectedPrice)} MONAD`);
      console.log(`Transaction price: ${formatEther(txPrice)} MONAD`);
      
      if (txPrice > expectedPrice * BigInt(105) / BigInt(100)) { // Allow 5% tolerance for fees
        const warningMessage = `Warning: Transaction price (${formatEther(txPrice)} MONAD) is higher than expected (${listing.price} MONAD)`;
        console.warn(warningMessage);
        setError(warningMessage);
        
        // Ask user to confirm
        if (!confirm(`${warningMessage}\n\nDo you want to continue with the purchase?`)) {
          setIsProcessingAction(false);
          setCurrentAction('');
          return;
        }
      }
      
      // Log the transaction data for debugging
      console.log(`Connected wallet address: ${address}`);
      console.log(`Transaction from address: ${txData.from}`);
      console.log('Sending transaction with:', {
        to: wagmiData.address,
        value: wagmiData.value,
        valueEth: wagmiData.value ? (BigInt(wagmiData.value) / BigInt(10**18)).toString() : '0',
      });
      
      console.log('=== SENDING TRANSACTION ===');
      console.log(`Using wallet: ${address}`);
      console.log(`To contract: ${wagmiData.address}`);
      console.log(`Function: ${wagmiData.functionName}`);
      console.log(`Value: ${wagmiData.value} (${wagmiData.value ? (BigInt(wagmiData.value) / BigInt(10**18)).toString() : '0'} MONAD)`);
      
      // Use much higher gas for Magic Eden transactions - they need more gas than standard transactions
      let gasLimit = BigInt(1000000); // Default high gas limit
      
      if (useMuchHigherGas) {
        gasLimit = BigInt(5000000); // 5 million gas for desperate retries
      } else if (retryWithHigherGas || useHigherGas) {
        gasLimit = BigInt(3000000); // 3 million gas for normal retries
      }
      
      // Try to estimate gas if possible
      try {
        const estimatedGas = await estimateGasWithSafetyMargin(txData);
        // Only use the estimate if it's higher than our default
        if (estimatedGas > gasLimit) {
          gasLimit = estimatedGas;
        }
      } catch (gasError) {
        console.warn('Could not estimate gas, using default high limit:', gasError);
      }
      
      console.log(`Gas limit: ${gasLimit.toString()}`);
      
      // Send the transaction with current gas limit
      try {
        await writeContract({
          address: wagmiData.address as `0x${string}`,
          abi: wagmiData.abi,
          functionName: wagmiData.functionName,
          args: [],
          value: BigInt(wagmiData.value || '0'),
          gas: gasLimit
        });
        
        // If we get here without error, the transaction was submitted
        setCurrentAction('Transaction submitted, waiting for confirmation...');
        setTxStatus('pending');
        setError(null);
        
        // Note: txHash will be updated via the useEffect watching for txHash changes
      } catch (writeErr) {
        console.error('Error during writeContract:', writeErr);
        throw writeErr;
      }
      
      // Update UI
      setLastTxHash(txHash || '');
    } catch (err) {
      console.error('Error buying NFT:', err);
      setError(err instanceof Error ? err.message : 'Failed to purchase NFT');
      setTxStatus('error');
    } finally {
      if (!txHash) {
        setIsProcessingAction(false);
        setCurrentAction('');
      }
    }
  };

  // Function to handle canceling a listing
  const handleCancel = async (listing: Listing) => {
    if (!address) {
      setError('Please connect your wallet');
      return;
    }
    
    if (chainId !== MONAD_TESTNET_ID) {
      handleSwitchNetwork();
      return;
    }
    
    setIsProcessingAction(true);
    setCurrentAction('Canceling listing...');
    
    try {
      const response = await fetch('/api/cancelListing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order: {
            contract: "0x8549FaF1d5553dB17C9c6154141e5357758006cC",
            tokenId: listing.tokenId,
            price: listing.price,
            maker: listing.seller,
            signature: listing.signature,
            expiration: listing.expiration
          }
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setLastTxHash(data.data?.txHash || 'Transaction submitted');
        // Refresh listings
        fetchListings();
      } else {
        throw new Error(data.error || 'Failed to cancel listing');
      }
    } catch (err) {
      console.error('Error canceling listing:', err);
      setError(err instanceof Error ? err.message : 'Failed to cancel listing');
    } finally {
      setIsProcessingAction(false);
      setCurrentAction('');
    }
  };

  // Handle network switching
  const handleSwitchNetwork = async () => {
    if (switchChain) {
      try {
        console.log('Attempting to switch to Monad Testnet...');
        await switchChain({ chainId: MONAD_TESTNET_ID });
        console.log('Switch network request sent');
      } catch (err) {
        console.error('Failed to switch network:', err);
        setError('Failed to switch network');
      }
    } else {
      console.error('switchChain function not available');
      setError('Network switching not available');
    }
  };

  // Get rarity color class based on rarity
  const getRarityColorClass = (rarity: string): string => {
    const lowerRarity = rarity.toLowerCase();
    if (lowerRarity.includes('common')) return 'text-gray-300';
    if (lowerRarity.includes('uncommon')) return 'text-green-400';
    if (lowerRarity.includes('rare')) return 'text-blue-400';
    if (lowerRarity.includes('epic')) return 'text-purple-400';
    if (lowerRarity.includes('legendary')) return 'text-yellow-400';
    if (lowerRarity.includes('ultra')) return 'text-red-400';
    return 'text-white';
  };

  // Function to get sample listings for development
  const getSampleListings = (): Listing[] => {
    // Use connected wallet address for sample listings
    const sellerAddress = address || PLACEHOLDER_ADDRESS;
    console.log("Using wallet address for sample listings:", sellerAddress);
    
    return [
      {
        id: '1',
        tokenId: '279',
        name: 'Elementals #279',
        image: '/assets/Rhoxodon.gif',
        species: 'Rhoxodon',
        rarity: 'Uncommon',
        price: '0.05',
        seller: sellerAddress,
        elementType: 'Earth',
        signature: '',
        expiration: Math.floor(Date.now() / 1000) + 86400
      },
      {
        id: '2',
        tokenId: '3299',
        name: 'Elementals #3299',
        image: '/assets/Nactivyx.gif',
        species: 'Nactivyx',
        rarity: 'Common',
        price: '0.03',
        seller: sellerAddress,
        elementType: 'Water',
        signature: '',
        expiration: Math.floor(Date.now() / 1000) + 86400
      },
      {
        id: '3',
        tokenId: '6700',
        name: 'Elementals #6700',
        image: '/assets/Infermor.gif',
        species: 'Infermor',
        rarity: 'Epic',
        price: '0.1',
        seller: sellerAddress,
        elementType: 'Fire',
        signature: '',
        expiration: Math.floor(Date.now() / 1000) + 86400
      },
      {
        id: '4',
        tokenId: '8500',
        name: 'Elementals #8500',
        image: '/assets/Emberith.gif',
        species: 'Emberith',
        rarity: 'Legendary',
        price: '0.2',
        seller: sellerAddress,
        elementType: 'Air',
        signature: '',
        expiration: 0
      },
      {
        id: '5',
        tokenId: '9800',
        name: 'Elementals #9800',
        image: '/assets/Nyxar.gif',
        species: 'Nyxar',
        rarity: 'Ultra Rare',
        price: '0.4',
        seller: sellerAddress,
        elementType: 'Void',
        signature: '',
        expiration: 0
      }
    ];
  };

  // Filter listings based on selected tab and applied filters
  const baseListings = selectedTab === 'all' ? listings : myListings;
  const displayListings = applyFilters(baseListings);

  // Function to create a listing
  const handleCreateListing = async (tokenId: string, price: string) => {
    if (!address) {
      setError('Please connect your wallet');
      return;
    }
    
    if (chainId !== MONAD_TESTNET_ID) {
      handleSwitchNetwork();
      return;
    }
    
    setIsProcessingAction(true);
    setCurrentAction('Creating listing...');
    
    try {
      // Create the order object for signing
      const domain = {
        name: "MagicEden",
        version: "1",
        chainId: 10143,
        verifyingContract: "0x8549FaF1d5553dB17C9c6154141e5357758006cC" as `0x${string}`,
      };

      const types = {
        Order: [
          { name: "maker", type: "address" },
          { name: "contract", type: "address" },
          { name: "tokenId", type: "uint256" },
          { name: "price", type: "uint256" },
          { name: "expiration", type: "uint256" },
        ],
      };

      // Convert price from ETH to wei (multiply by 10^18)
      const priceInWei = BigInt(parseFloat(price) * 10**18);
      
      const order = {
        maker: address,
        contract: domain.verifyingContract,
        tokenId: BigInt(tokenId),
        price: priceInWei,
        expiration: Math.floor(Date.now() / 1000) + 86400, // 1 day
      };

      // Sign the order
      const signature = await signTypedDataAsync({
        domain,
        types,
        primaryType: 'Order',
        message: order,
      });

      // Format the order for the API
      const formattedOrder = {
        maker: address,
        contract: domain.verifyingContract,
        tokenId: tokenId,
        price: priceInWei.toString(),
        expiration: order.expiration,
        signature
      };

      // Send the signed order to the API
      const response = await fetch('/api/createListing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order: formattedOrder
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setLastTxHash(data.data?.txHash || 'Listing created');
        // Refresh listings
        fetchListings();
      } else {
        throw new Error(data.error || 'Failed to create listing');
      }
    } catch (err) {
      console.error('Error creating listing:', err);
      setError(err instanceof Error ? err.message : 'Failed to create listing');
    } finally {
      setIsProcessingAction(false);
      setCurrentAction('');
    }
  };

  // Add this useEffect to handle write contract errors
  useEffect(() => {
    if (writeError) {
      console.error('Write contract error:', writeError);
      const errorMessage = parseTransactionError(writeError);
      setError(`Transaction failed: ${errorMessage}`);
      setTxStatus('error');
      setIsProcessingAction(false);
      setCurrentAction('');
    }
  }, [writeError]);

  // Add this useEffect to handle transaction status changes
  useEffect(() => {
    if (txSuccess) {
      setTxStatus('success');
      setIsProcessingAction(false);
      setCurrentAction('');
      
      // Start monitoring ownership if we have a successful transaction
      if (lastTxHash && currentPurchaseListing) {
        monitorTransactionAndOwnership(lastTxHash, currentPurchaseListing);
      }
    } else if (txError) {
      setTxStatus('error');
      setIsProcessingAction(false);
      setCurrentAction('');
      const errorMessage = parseTransactionError(txErrorData);
      setError(`Transaction failed: ${errorMessage}`);
      console.error('Transaction error details:', {
        error: txErrorData,
        message: txErrorData?.message
      });
    }
  }, [txSuccess, txError, txErrorData]);

  // Function to parse transaction errors
  const parseTransactionError = (error: any): string => {
    if (!error) return 'Unknown error';
    
    // Extract error message
    let errorMessage = '';
    
    if (typeof error === 'string') {
      errorMessage = error;
    } else if (error.message) {
      errorMessage = error.message;
    } else if (error.details) {
      errorMessage = error.details;
    } else {
      errorMessage = 'Transaction failed';
    }
    
    // Check for common error patterns
    if (errorMessage.includes('insufficient funds')) {
      return 'Insufficient funds to complete this transaction. Make sure you have enough MONAD for both the NFT price and gas fees.';
    } else if (errorMessage.includes('user rejected')) {
      return 'Transaction was rejected by the user';
    } else if (errorMessage.includes('execution reverted')) {
      // More specific handling for execution reverted errors
      if (errorMessage.includes('already purchased')) {
        return 'This NFT has already been purchased by someone else.';
      } else if (errorMessage.includes('listing not active') || errorMessage.includes('not active')) {
        return 'This listing is no longer active. It may have been cancelled by the seller.';
      } else if (errorMessage.includes('gas')) {
        return 'Transaction reverted due to gas issues. Try again with a higher gas limit.';
      } else {
        return 'Transaction was reverted by the Magic Eden contract. This usually happens when the listing is no longer available or the contract requires more gas. Try again with higher gas or refresh the listings.';
      }
    } else if (errorMessage.includes('nonce too low')) {
      return 'Transaction nonce error. Please refresh the page and try again.';
    } else if (errorMessage.includes('gas required exceeds allowance')) {
      return 'Gas limit too low. Try increasing the gas limit.';
    } else if (errorMessage.includes('Magic Eden')) {
      return `Magic Eden error: ${errorMessage}`;
    } else if (errorMessage.includes('cannot estimate gas')) {
      return 'Cannot estimate gas for this transaction. Try using a higher gas limit manually.';
    } else if (errorMessage.includes('timeout')) {
      return 'Transaction timed out. The network may be congested. Please try again.';
    }
    
    return errorMessage;
  };

  // Function to retry with much higher gas
  const retryWithMuchHigherGas = () => {
    if (currentPurchaseListing) {
      // Set a very high gas limit for the retry
      setUseHigherGas(true);
      setUseMuchHigherGas(true);
      handleBuy(currentPurchaseListing, true);
    }
  };

  // New function for progressive retry with increasing gas
  const retryWithProgressiveGas = async () => {
    if (!currentPurchaseListing) return;
    
    // Define gas limit steps for progressive retries
    const gasLimits = [
      BigInt(1500000),  // Step 1: 1.5 million gas
      BigInt(3000000),  // Step 2: 3 million gas
      BigInt(5000000),  // Step 3: 5 million gas
      BigInt(8000000)   // Step 4: 8 million gas (extreme case)
    ];
    
    setIsProcessingAction(true);
    setCurrentAction('Preparing progressive retry...');
    
    // Get current balance to ensure we have enough for gas
    await refetchBalance();
    
    // Try each gas limit in sequence
    for (let i = 0; i < gasLimits.length; i++) {
      const gasLimit = gasLimits[i];
      const estimatedGasCost = BigInt(Number(gasLimit) * 2 * 10**9); // Rough estimate
      
      // Check if we have enough balance for this attempt
      if (!checkSufficientBalance(currentPurchaseListing.price, estimatedGasCost)) {
        setError(`Insufficient funds for retry with ${formatEther(estimatedGasCost)} MONAD gas cost`);
        setIsProcessingAction(false);
        return;
      }
      
      setCurrentAction(`Retry attempt ${i+1}/${gasLimits.length} with ${gasLimit.toString()} gas...`);
      console.log(`Progressive retry attempt ${i+1} with gas limit: ${gasLimit.toString()}`);
      
      try {
        // Get fresh transaction data for each attempt
        const response = await fetch('/api/executePurchase', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
          },
          body: JSON.stringify({
            order: {
              id: currentPurchaseListing.id,
              contract: "0x8549FaF1d5553dB17C9c6154141e5357758006cC",
              tokenId: currentPurchaseListing.tokenId,
              price: currentPurchaseListing.price,
              maker: currentPurchaseListing.seller,
              signature: currentPurchaseListing.signature,
            },
            taker: address
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.text();
          console.error(`API error: ${response.status}`, errorData);
          throw new Error(`API error: ${errorData}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Failed to get transaction data');
        }
        
        const txData = data.data.transactionData;
        const wagmiData = data.data.wagmiCompatibleData;
        
        // Send the transaction with current gas limit
        try {
          await writeContract({
            address: wagmiData.address as `0x${string}`,
            abi: wagmiData.abi,
            functionName: wagmiData.functionName,
            args: [],
            value: BigInt(wagmiData.value || '0'),
            gas: gasLimit
          });
          
          // If we get here without error, the transaction was submitted
          setCurrentAction('Transaction submitted, waiting for confirmation...');
          setTxStatus('pending');
          setError(null);
          
          // Transaction will be tracked by the useEffect hooks watching for txHash/txSuccess/txError
          return; // Exit the retry loop
        } catch (writeErr) {
          console.error(`Write contract error in attempt ${i+1}:`, writeErr);
          throw writeErr;
        }
      } catch (error) {
        console.error(`Attempt ${i+1} failed:`, error);
        // Continue to next gas limit if this one failed
        if (i === gasLimits.length - 1) {
          // This was the last attempt
          setError(`All retry attempts failed. The NFT may no longer be available.`);
        }
      }
      
      // Short delay between attempts
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    setIsProcessingAction(false);
  };

  // Function to monitor transaction status and ownership
  const monitorTransactionAndOwnership = async (txHash: string, listing: Listing) => {
    if (!address || !txHash || !listing.tokenId) return;
    
    setIsMonitoringTx(true);
    setCurrentAction('Verifying purchase...');
    
    try {
      // Initial delay to allow the transaction to be processed
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Monitor for up to 30 seconds (6 attempts, 5 seconds apart)
      for (let i = 0; i < 6; i++) {
        console.log(`Monitoring attempt ${i+1}/6 for tx ${txHash}`);
        
        const response = await fetch('/api/monitorEscrow', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            txHash,
            tokenId: listing.tokenId,
            contract: "0x8549FaF1d5553dB17C9c6154141e5357758006cC",
            buyer: address
          }),
        });
        
        if (!response.ok) {
          console.error('Error from monitoring API:', response.statusText);
          continue;
        }
        
        const data = await response.json();
        console.log('Monitoring data:', data);
        
        // Store ownership status
        setOwnershipStatus(data.ownershipStatus);
        
        // If transaction is confirmed
        if (data.txStatus?.status === true) {
          console.log('Transaction confirmed successful!');
          
          // Check if ownership was transferred
          if (data.ownershipStatus?.buyerIsOwner === true) {
            // Success! User owns the NFT
            setCurrentAction('');
            alert(`Successfully purchased Elementals #${listing.tokenId}!`);
            
            // Refresh listings
            fetchListings();
            break;
          } else if (data.ownershipStatus?.currentOwner) {
            // Transaction successful but user doesn't own the NFT
            setError(`Transaction succeeded but you don't own the NFT. Current owner is ${data.ownershipStatus.currentOwner}`);
            break;
          }
        } else if (data.txStatus?.status === false) {
          // Transaction failed
          setError('Transaction confirmed but failed on the blockchain');
          break;
        }
        
        // If we're on the last attempt and still don't have confirmation
        if (i === 5) {
          setCurrentAction('');
          console.log('Monitoring complete without definitive result');
        } else {
          // Wait 5 seconds before next check
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    } catch (err) {
      console.error('Error monitoring transaction:', err);
    } finally {
      setIsMonitoringTx(false);
      setCurrentAction('');
    }
  };

  return (
    <div className="p-0 h-full flex flex-col">
      {/* Network Warning */}
      {isConnected && chainId !== MONAD_TESTNET_ID && (
        <div className="mb-4 p-2 bg-yellow-800 border border-yellow-600 text-yellow-200 text-xs font-pixel text-center">
          Please switch to Monad Testnet to interact with the marketplace
          <button
            onClick={handleSwitchNetwork}
            className="block mx-auto mt-2 ro-button text-xs py-1 px-3"
          >
            Switch Network
          </button>
        </div>
      )}
      
      {/* Transaction Status */}
      {lastTxHash && (
        <div className={`mb-4 p-2 ${
          txStatus === 'success' ? 'bg-green-800 border-green-600 text-green-200' :
          txStatus === 'error' ? 'bg-red-900 border-red-600 text-red-200' :
          'bg-blue-800 border-blue-600 text-blue-200'
        } border text-xs font-pixel text-center`}>
          {txStatus === 'success' ? 'Transaction successful! ' :
           txStatus === 'error' ? 'Transaction failed! ' :
           'Transaction submitted! '}
          <a 
            href={`https://testnet.monadexplorer.com/tx/${lastTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block underline mt-1"
          >
            View on Monad Explorer
          </a>
          
          {isMonitoringTx && (
            <div className="mt-2 animate-pulse">
              Verifying purchase status...
            </div>
          )}
          
          {ownershipStatus && ownershipStatus.buyerIsOwner && (
            <div className="mt-2 text-green-300">
              ✓ NFT ownership confirmed!
            </div>
          )}
          
          {ownershipStatus && ownershipStatus.error && (
            <div className="mt-2 text-yellow-300">
              Could not verify ownership: {ownershipStatus.error}
            </div>
          )}
          
          {txStatus === 'error' && (
            <div className="mt-2 text-red-200">
              <p className="font-bold">Transaction Failed</p>
              <p>The transaction was rejected by the blockchain. This could be due to:</p>
              <ul className="list-disc list-inside mt-1">
                <li>Insufficient funds for gas</li>
                <li>The NFT was already purchased</li>
                <li>The listing was cancelled</li>
                <li>Magic Eden contract execution error</li>
              </ul>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => currentPurchaseListing && handleBuy(currentPurchaseListing, true)}
                  className="mt-2 ro-button-small text-xs py-1 px-3"
                >
                  Retry with Higher Gas
                </button>
                <button
                  onClick={retryWithMuchHigherGas}
                  className="mt-2 ro-button-small bg-yellow-600 hover:bg-yellow-500 text-xs py-1 px-3"
                >
                  Retry with MUCH Higher Gas
                </button>
                <button
                  onClick={retryWithProgressiveGas}
                  className="mt-2 ro-button-small bg-blue-600 hover:bg-blue-500 text-xs py-1 px-3"
                >
                  Smart Progressive Retry
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Error Message */}
      {error && (
        <div className="mb-4 p-2 bg-red-900 border border-red-600 text-red-200 text-xs font-pixel text-center">
          {error}
        </div>
      )}
      
      {/* Processing Message */}
      {isProcessingAction && (
        <div className="mb-4 p-2 bg-blue-900 border border-blue-600 text-blue-200 text-xs font-pixel text-center">
          {currentAction || 'Processing...'}
        </div>
      )}
      
      {/* Top Controls */}
      <div className="flex justify-between mb-2">
        <a
          href="https://magiceden.io/collections/monad-testnet/0x8549FaF1d5553dB17C9c6154141e5357758006cC"
          target="_blank"
          rel="noopener noreferrer"
          className="ro-button-small text-xs py-1 px-3 flex items-center"
        >
          Go to Magic Eden
        </a>
        
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="ro-button-small text-xs py-1 px-3 flex items-center"
          >
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
          
          <button
            onClick={fetchListings}
            className="ro-button-small text-xs py-1 px-3 flex items-center"
            disabled={isLoading}
          >
            {isLoading ? 'Refreshing...' : '↻ Refresh'}
          </button>
        </div>
      </div>
      
      {/* Filter Panel */}
      {showFilters && (
        <div className="mb-4 p-3 bg-[var(--ro-panel-dark)] border border-[var(--ro-border-dark)] rounded">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Species Filter */}
            <div className="flex-1">
              <label className="block text-xs font-pixel mb-1 text-[var(--ro-gold)]">Species</label>
              <select 
                className="w-full bg-[var(--ro-bg-dark)] border border-[var(--ro-border-dark)] rounded text-white font-pixel p-1 text-xs"
                value={filters.species || ''}
                onChange={(e) => setFilters({...filters, species: e.target.value || null})}
              >
                <option value="">All Species</option>
                {getUniqueSpecies().map(species => (
                  <option key={species} value={species}>{species}</option>
                ))}
                <option value="Rhoxodon">Rhoxodon</option>
                <option value="Nactivyx">Nactivyx</option>
                <option value="Infermor">Infermor</option>
                <option value="Emberith">Emberith</option>
                <option value="Nyxar">Nyxar</option>
              </select>
            </div>
            
            {/* Rarity Filter */}
            <div className="flex-1">
              <label className="block text-xs font-pixel mb-1 text-[var(--ro-gold)]">Rarity</label>
              <select 
                className="w-full bg-[var(--ro-bg-dark)] border border-[var(--ro-border-dark)] rounded text-white font-pixel p-1 text-xs"
                value={filters.rarity || ''}
                onChange={(e) => setFilters({...filters, rarity: e.target.value || null})}
              >
                <option value="">All Rarities</option>
                {getUniqueRarities().map(rarity => (
                  <option key={rarity} value={rarity}>{rarity}</option>
                ))}
                <option value="Common">Common</option>
                <option value="Uncommon">Uncommon</option>
                <option value="Epic">Epic</option>
                <option value="Legendary">Legendary</option>
                <option value="Ultra Rare">Ultra Rare</option>
              </select>
            </div>
            
            {/* Price Range Filter */}
            <div className="flex-1">
              <label className="block text-xs font-pixel mb-1 text-[var(--ro-gold)]">Price Range (MONAD)</label>
              <div className="flex gap-2">
                <input 
                  type="number"
                  placeholder="Min"
                  className="w-1/2 bg-[var(--ro-bg-dark)] border border-[var(--ro-border-dark)] rounded text-white font-pixel p-1 text-xs"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  min="0"
                  step="0.01"
                />
                <input 
                  type="number"
                  placeholder="Max"
                  className="w-1/2 bg-[var(--ro-bg-dark)] border border-[var(--ro-border-dark)] rounded text-white font-pixel p-1 text-xs"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          </div>
          
          {/* Filter Action Buttons */}
          <div className="flex justify-end mt-3 gap-2">
            <button 
              onClick={resetFilters}
              className="ro-button-secondary text-xs py-1 px-3"
            >
              Reset
            </button>
            <button 
              onClick={applyPriceFilter}
              className="ro-button text-xs py-1 px-3"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}
      
      {/* Stats Bar */}
      <div className="mb-4 text-xs font-pixel flex justify-between items-center px-2 py-1 bg-[var(--ro-panel-dark)] border border-[var(--ro-border-dark)] rounded">
        <div>
          <span className="text-[var(--ro-gold)]">Total:</span> {displayListings.length} listings
        </div>
        {filters.species || filters.rarity || filters.priceRange ? (
          <div className="text-green-400">
            Filters Active
          </div>
        ) : null}
      </div>
      
      {/* Tabs */}
      <div className="flex border-b-2 border-[var(--ro-border-dark)] mb-4 overflow-x-auto pb-1">
        <button 
          onClick={() => setSelectedTab('all')}
          className={`px-3 py-1 font-pixel text-xs whitespace-nowrap ${selectedTab === 'all' ? 'bg-[var(--ro-panel-light)] text-white' : 'text-gray-300'}`}
        >
          ALL LISTINGS
        </button>
        <button 
          onClick={() => setSelectedTab('my-listings')}
          className={`px-3 py-1 font-pixel text-xs whitespace-nowrap ${selectedTab === 'my-listings' ? 'bg-[var(--ro-panel-light)] text-white' : 'text-gray-300'}`}
        >
          MY LISTINGS
        </button>
      </div>
      
      {/* Listings Content */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-white font-pixel text-base animate-pulse">Loading marketplace...</div>
        </div>
      ) : displayListings.length === 0 ? (
        <div className="flex flex-col justify-center items-center h-64 space-y-4">
          <p className="text-white font-pixel text-base">
            {selectedTab === 'all' ? 'No listings found' : 'You have no active listings'}
          </p>
          {selectedTab === 'all' ? (
            <p className="text-[var(--ro-gold)] font-pixel text-xs">Be the first to list your Elementals!</p>
          ) : (
            <p className="text-[var(--ro-gold)] font-pixel text-xs">List your Elementals from the inventory page</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {displayListings.map((listing) => (
            <div 
              key={listing.id} 
              className="ro-item-slot cursor-pointer hover:border-[var(--ro-gold)] hover:shadow-[0_0_8px_rgba(255,204,51,0.5)] transition-all h-72"
            >
              <div className="w-full h-full flex flex-col relative">
                {/* Rarity Badge */}
                <div className="absolute top-1 right-1 z-10">
                  <span className={`px-2 py-0.5 text-[10px] font-pixel rounded-sm ${getRarityBadgeClass(listing.rarity)}`}>
                    {listing.rarity}
                  </span>
                </div>
                
                {/* Item Image - Larger size */}
                <div className="w-full flex-grow flex items-center justify-center p-3">
                  <img 
                    src={listing.image} 
                    alt={listing.name} 
                    className="max-w-full max-h-full object-contain pixelated"
                  />
                </div>
                
                {/* Item Info */}
                <div className="w-full text-center p-1 bg-[var(--ro-bg-dark)] border-t border-[var(--ro-border-dark)]">
                  <p className="font-pixel text-sm truncate text-white">
                    {listing.species || getElementalName(parseInt(listing.tokenId))} #{listing.tokenId}
                  </p>
                  <p className="font-pixel text-[var(--ro-gold)] text-sm">
                    {listing.price} MONAD
                  </p>
                </div>
                
                {/* Action Buttons - Horizontal row at bottom */}
                <div className="w-full p-2 flex gap-1 mt-auto">
                  {selectedTab === 'my-listings' || listing.seller.toLowerCase() === address?.toLowerCase() ? (
                    <button 
                      onClick={() => handleCancel(listing)}
                      className="ro-button-secondary w-full py-1 text-xs"
                      disabled={isProcessingAction}
                    >
                      Cancel Listing
                    </button>
                  ) : (
                    <>
                      <button 
                        onClick={() => handleBuy(listing)}
                        className="ro-button flex-1 py-1 text-xs"
                        disabled={isProcessingAction}
                      >
                        Buy Now
                      </button>
                      <a 
                        href={`https://magiceden.io/item-details/monad-testnet/0x8549faf1d5553db17c9c6154141e5357758006cc/${listing.tokenId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ro-button-secondary flex-1 py-1 text-xs block text-center text-white bg-gray-700 hover:bg-gray-600"
                      >
                        MAGIC EDEN
                      </a>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 