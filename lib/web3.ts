import { ethers } from "ethers";
import { myDataMarketAbi } from "@/lib/myDataMarketAbi";
import type { MarketAsset } from "@/lib/types";

declare global {
  interface Window {
    ethereum?: {
      on?: (eventName: string, listener: (...args: any[]) => void) => void;
      removeListener?: (eventName: string, listener: (...args: any[]) => void) => void;
      request: (args: { method: string; params?: unknown[] }) => Promise<any>;
    };
  }
}

function requireEthereum() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("MetaMask was not detected in this browser.");
  }

  return window.ethereum;
}

function getContractAddress() {
  const address = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

  if (!address) {
    throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS is missing.");
  }

  return address;
}

async function assertSupportedChain(provider: ethers.BrowserProvider) {
  const expectedChainId = process.env.NEXT_PUBLIC_CHAIN_ID;

  if (!expectedChainId) {
    return;
  }

  const network = await provider.getNetwork();

  if (network.chainId !== BigInt(expectedChainId)) {
    throw new Error(`Wrong network. Switch MetaMask to chain ID ${expectedChainId}.`);
  }
}

export async function requestWalletAccess() {
  const ethereum = requireEthereum();
  await ethereum.request({
    method: "eth_requestAccounts"
  });

  const provider = new ethers.BrowserProvider(ethereum);
  await assertSupportedChain(provider);
  const signer = await provider.getSigner();

  return {
    provider,
    signer,
    account: (await signer.getAddress()).toLowerCase()
  };
}

export async function getMarketReadContract() {
  const ethereum = requireEthereum();
  const provider = new ethers.BrowserProvider(ethereum);
  await assertSupportedChain(provider);

  return new ethers.Contract(getContractAddress(), myDataMarketAbi, provider);
}

export async function getMarketWriteContract() {
  const { signer } = await requestWalletAccess();
  return new ethers.Contract(getContractAddress(), myDataMarketAbi, signer);
}

export function mapAssetTuple(tuple: readonly unknown[]): MarketAsset {
  const id = Number(tuple[0]);
  const owner = String(tuple[1]).toLowerCase();
  const dbId = String(tuple[2]);
  const tags = String(tuple[3]);
  const price = BigInt(tuple[4] as bigint);
  const isSold = Boolean(tuple[5]);

  return {
    id,
    owner,
    dbId,
    tags,
    priceWei: price.toString(),
    priceEth: ethers.formatEther(price),
    isSold,
    canAccess: false
  };
}
