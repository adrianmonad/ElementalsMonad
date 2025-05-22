// Types for the marketplace listings

export interface MarketplaceListing {
  id?: string;
  nftContract: string;
  tokenId: number;
  price: number;
  seller: string;
  status: 'pending' | 'active' | 'sold' | 'canceled';
  createdAt: number;
  updatedAt?: number;
  buyerAddress?: string;
  transactionHash?: string;
  name?: string;
  image?: string;
  rarity?: string;
  elementType?: string;
}

export interface CreateListingRequest {
  nftContract: string;
  tokenId: number;
  price: number;
  seller: string;
}

export interface UpdateListingRequest {
  id: string;
  status: 'active' | 'sold' | 'canceled';
  buyerAddress?: string;
  transactionHash?: string;
}

export interface GetListingsResponse {
  listings: MarketplaceListing[];
}

export interface GetListingResponse {
  listing: MarketplaceListing | null;
} 