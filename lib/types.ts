export type MyDataRecord = {
  id: string;
  owner_address: string;
  raw_data: Record<string, unknown>;
  created_at: string;
};

export type MarketAsset = {
  id: number;
  owner: string;
  dbId: string;
  tags: string;
  priceWei: string;
  priceEth: string;
  isSold: boolean;
  canAccess: boolean;
};

