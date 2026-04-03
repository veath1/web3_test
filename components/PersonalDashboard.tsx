"use client";

import { useState } from "react";
import { ethers } from "ethers";
import { insertMyData } from "@/lib/supabase";
import { getMarketWriteContract } from "@/lib/web3";

type PersonalDashboardProps = {
  account: string | null;
  onRegistered: () => void;
};

const defaultPayload = JSON.stringify(
  {
    balance_krw: 50000000,
    has_irp: false,
    monthly_salary_krw: 6200000,
    tags_hint: ["high-net-worth", "no-irp", "salary-worker"]
  },
  null,
  2
);

export function PersonalDashboard({
  account,
  onRegistered
}: PersonalDashboardProps) {
  const [rawData, setRawData] = useState(defaultPayload);
  const [tags, setTags] = useState("high-net-worth, no-irp, salary-worker");
  const [priceEth, setPriceEth] = useState("0.01");
  const [status, setStatus] = useState("판매자용 데이터 등록을 준비하세요.");
  const [lastDbId, setLastDbId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function registerData() {
    if (!account) {
      setStatus("데이터 등록 전에 MetaMask를 연결하세요.");
      return;
    }

    setIsSubmitting(true);
    setStatus("원본 데이터는 Supabase에 저장하고, 메타데이터는 온체인에 등록하고 있습니다.");

    try {
      const parsed = JSON.parse(rawData) as Record<string, unknown>;
      const inserted = await insertMyData({
        ownerAddress: account,
        rawData: parsed
      });

      const contract = await getMarketWriteContract();
      const tx = await contract.registerData(inserted.id, tags, ethers.parseEther(priceEth));
      await tx.wait();

      setLastDbId(inserted.id);
      setStatus("데이터 판매 등록이 완료되었습니다.");
      onRegistered();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "데이터 판매 등록에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="panel p-6 sm:p-7">
      <div className="space-y-5">
        <div className="space-y-2">
          <span className="eyebrow">Personal Seller</span>
          <h2 className="text-2xl font-semibold">개인 데이터 판매 등록</h2>
          <p className="text-sm leading-6 muted">
            원본 JSON은 Supabase에 저장되고, UUID와 태그, 가격만 스마트 컨트랙트에 기록됩니다.
          </p>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium">원본 데이터 JSON</span>
          <textarea
            className="input-surface min-h-64 resize-y"
            onChange={(event) => setRawData(event.target.value)}
            value={rawData}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-[1.4fr_0.8fr]">
          <label className="block space-y-2">
            <span className="text-sm font-medium">검색 태그</span>
            <input
              className="input-surface"
              onChange={(event) => setTags(event.target.value)}
              value={tags}
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium">판매 가격</span>
            <input
              className="input-surface"
              onChange={(event) => setPriceEth(event.target.value)}
              value={priceEth}
            />
          </label>
        </div>

        <button
          className="button-primary w-full"
          disabled={isSubmitting}
          onClick={registerData}
          type="button"
        >
          {isSubmitting ? "등록 중..." : "데이터 등록"}
        </button>

        <div className="rounded-3xl border border-line bg-white/70 p-4 text-sm leading-6">
          <p className="font-medium">상태</p>
          <p className="mt-2 muted">{status}</p>
          {lastDbId ? (
            <p className="mt-2 break-all text-xs muted">최근 dbId: {lastDbId}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
