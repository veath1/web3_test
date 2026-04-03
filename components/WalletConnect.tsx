"use client";

import { useEffect, useState } from "react";
import { requestWalletAccess } from "@/lib/web3";

type WalletConnectProps = {
  account: string | null;
  onAccountChange: (account: string | null) => void;
};

export function WalletConnect({ account, onAccountChange }: WalletConnectProps) {
  const [status, setStatus] = useState("지갑이 아직 연결되지 않았습니다.");

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) {
      setStatus("MetaMask가 없어도 상단 설명 데모는 기본 주소로 진행할 수 있습니다.");
      return;
    }

    const handleAccountsChanged = (accounts: string[]) => {
      const nextAccount = accounts[0]?.toLowerCase() ?? null;
      onAccountChange(nextAccount);
      setStatus(nextAccount ? "지갑이 연결되었습니다." : "지갑 연결이 해제되었습니다.");
    };

    async function syncWallet() {
      try {
        const accounts = (await window.ethereum?.request({
          method: "eth_accounts"
        })) as string[];
        handleAccountsChanged(accounts);
      } catch {
        setStatus("지갑 상태를 읽지 못했습니다.");
      }
    }

    void syncWallet();
    window.ethereum.on?.("accountsChanged", handleAccountsChanged);

    return () => {
      window.ethereum?.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, [onAccountChange]);

  async function connectWallet() {
    try {
      const { account: connectedAccount } = await requestWalletAccess();
      onAccountChange(connectedAccount);
      setStatus("지갑이 연결되었습니다.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "지갑 연결에 실패했습니다.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <span className="eyebrow">Optional Wallet</span>
        <h2 className="text-2xl font-semibold">지갑 연결</h2>
      </div>
      <div className="rounded-3xl border border-line bg-white p-4">
        <p className="text-xs uppercase tracking-[0.2em] muted">현재 연결된 주소</p>
        <p className="mt-3 break-all text-sm font-medium">
          {account ?? "연결된 지갑 없음"}
        </p>
      </div>
      <button className="button-primary w-full" onClick={connectWallet} type="button">
        {account ? "지갑 다시 연결" : "MetaMask 연결"}
      </button>
      <p className="text-sm muted">{status}</p>
    </div>
  );
}
