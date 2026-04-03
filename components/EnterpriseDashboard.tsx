"use client";

import { useEffect, useState } from "react";
import { getMyDataById } from "@/lib/supabase";
import type { MarketAsset } from "@/lib/types";
import { getMarketReadContract, getMarketWriteContract, mapAssetTuple } from "@/lib/web3";

type EnterpriseMode = "catalog" | "request";

const filterOptions = [
  {
    token: "high-net-worth",
    label: "고액 자산가",
    description: "예적금 여력이 큰 사용자"
  },
  {
    token: "no-irp",
    label: "IRP 미가입",
    description: "IRP 계좌가 없는 사용자"
  },
  {
    token: "salary-worker",
    label: "직장인",
    description: "급여소득 기반 고객군"
  },
  {
    token: "irp-enrollment",
    label: "IRP 관심군",
    description: "퇴직연금 캠페인 대상"
  }
] as const;

function parseTagTokens(value: string) {
  return value
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}

type EnterpriseDashboardProps = {
  account: string | null;
  refreshKey: number;
};

export function EnterpriseDashboard({
  account,
  refreshKey
}: EnterpriseDashboardProps) {
  const [assets, setAssets] = useState<MarketAsset[]>([]);
  const [mode, setMode] = useState<EnterpriseMode>("catalog");
  const [search, setSearch] = useState("");
  const [selectedFilters, setSelectedFilters] = useState<string[]>(["no-irp"]);
  const [requestTitle, setRequestTitle] = useState("IRP 가입 유도 대상 요청");
  const [requestFilters, setRequestFilters] = useState<string[]>(["high-net-worth", "no-irp"]);
  const [requestNote, setRequestNote] = useState("예적금 여력이 있고 IRP 계좌가 없는 직장인");
  const [requestBudgetEth, setRequestBudgetEth] = useState("0.01");
  const [status, setStatus] = useState("온체인 데이터 목록을 불러오세요.");
  const [selectedRawData, setSelectedRawData] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [requestStatus, setRequestStatus] = useState("조건 요청 초안을 만들 수 있습니다.");

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) {
      setStatus("이 고급 모드에서는 MetaMask가 필요합니다.");
      return;
    }

    void loadAssets();
  }, [account, refreshKey]);

  async function loadAssets() {
    setIsLoading(true);
    setStatus("스마트 컨트랙트에서 데이터 메타정보를 불러오는 중입니다.");

    try {
      const contract = await getMarketReadContract();
      const count = Number(await contract.dataCount());
      const assetIds = Array.from({ length: count }, (_, index) => index + 1);

      const nextAssets = await Promise.all(
        assetIds.map(async (id) => {
          const tuple = await contract.dataAssets(id);
          const asset = mapAssetTuple(tuple);
          const canAccess = account ? await contract.checkAccess(id, account) : false;

          return {
            ...asset,
            canAccess
          };
        })
      );

      setAssets(nextAssets.reverse());
      setStatus(nextAssets.length > 0 ? "데이터 목록을 불러왔습니다." : "아직 등록된 데이터가 없습니다.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "데이터 메타정보를 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  async function purchaseAsset(asset: MarketAsset) {
    setActiveId(asset.id);
    setStatus(`dataId #${asset.id} 구매 트랜잭션을 제출하고 있습니다.`);

    try {
      const contract = await getMarketWriteContract();
      const tx = await contract.purchaseData(asset.id, {
        value: BigInt(asset.priceWei)
      });
      await tx.wait();
      setStatus(`dataId #${asset.id} 구매가 완료되었습니다. 열람 권한이 부여되었습니다.`);
      await loadAssets();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "데이터 구매에 실패했습니다.");
    } finally {
      setActiveId(null);
    }
  }

  async function viewRawData(asset: MarketAsset) {
    if (!account) {
      setStatus("원본 데이터 열람 전에 구매자 지갑을 연결하세요.");
      return;
    }

    setActiveId(asset.id);
    setStatus(`dataId #${asset.id}의 열람 권한을 확인하는 중입니다.`);

    try {
      const contract = await getMarketReadContract();
      const hasAccess = await contract.checkAccess(asset.id, account);

      if (!hasAccess) {
        setStatus("열람 권한이 없습니다. 먼저 데이터를 구매하세요.");
        return;
      }

      const record = await getMyDataById(asset.dbId);
      setSelectedRawData(JSON.stringify(record.raw_data, null, 2));
      setStatus(`dataId #${asset.id} 원본 데이터를 불러왔습니다.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "원본 데이터를 불러오지 못했습니다.");
    } finally {
      setActiveId(null);
    }
  }

  function toggleCatalogFilter(token: string) {
    setSelectedFilters((current) =>
      current.includes(token)
        ? current.filter((item) => item !== token)
        : [...current, token]
    );
  }

  function toggleRequestFilter(token: string) {
    setRequestFilters((current) =>
      current.includes(token)
        ? current.filter((item) => item !== token)
        : [...current, token]
    );
  }

  function applyRequestFiltersToCatalog() {
    setSelectedFilters(requestFilters);
    setMode("catalog");
    setStatus("요청 조건을 바로 구매 필터에 적용했습니다.");
  }

  function submitRequestDraft() {
    if (!requestFilters.length) {
      setRequestStatus("최소 1개 이상의 요청 필터를 선택하세요.");
      return;
    }

    const labels = filterOptions
      .filter((option) => requestFilters.includes(option.token))
      .map((option) => option.label)
      .join(", ");

    setRequestStatus(
      `요청 초안을 만들었습니다. 조건: ${labels} / 예산: ${requestBudgetEth} ETH / 메모: ${requestNote}`
    );
  }

  const filteredAssets = assets.filter((asset) => {
    const tags = parseTagTokens(asset.tags.toLowerCase());
    const matchesFilters = selectedFilters.every((token) => tags.includes(token.toLowerCase()));
    const matchesSearch = search
      ? asset.tags.toLowerCase().includes(search.toLowerCase())
      : true;

    return matchesFilters && matchesSearch;
  });

  return (
    <section className="panel p-6 sm:p-7">
      <div className="space-y-5">
        <div className="space-y-2">
          <span className="eyebrow">Enterprise Buyer</span>
          <h2 className="text-2xl font-semibold">기업 데이터 검색, 구매, 열람</h2>
          <p className="text-sm leading-6 muted">
            기업은 태그로 데이터를 찾고, 온체인 결제를 마친 뒤에만 Supabase 원본 데이터를
            열람할 수 있습니다.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            className={`button-secondary ${mode === "catalog" ? "border-[#cb5a21] bg-[#fff0e7] text-[#9d4317]" : ""}`}
            onClick={() => setMode("catalog")}
            type="button"
          >
            등록된 데이터 바로 구매
          </button>
          <button
            className={`button-secondary ${mode === "request" ? "border-[#cb5a21] bg-[#fff0e7] text-[#9d4317]" : ""}`}
            onClick={() => setMode("request")}
            type="button"
          >
            원하는 데이터 조건 요청
          </button>
        </div>

        {mode === "catalog" ? (
          <>
            <div className="rounded-[24px] border border-line bg-white/75 p-5">
              <div className="grid gap-4 lg:grid-cols-[1.12fr_0.88fr]">
                <div>
                  <p className="text-sm font-medium">빠른 필터</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {filterOptions.map((option) => {
                      const isSelected = selectedFilters.includes(option.token);
                      return (
                        <button
                          className={`chip-filter ${isSelected ? "chip-filter-active" : ""}`}
                          key={option.token}
                          onClick={() => toggleCatalogFilter(option.token)}
                          type="button"
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-3">
                  <input
                    className="input-surface"
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="추가 검색어 입력"
                    value={search}
                  />
                  <button
                    className="button-secondary w-full"
                    disabled={isLoading}
                    onClick={() => {
                      void loadAssets();
                    }}
                    type="button"
                  >
                    목록 새로고침
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              {filteredAssets.map((asset) => (
                <article className="rounded-[26px] border border-line bg-white/75 p-5" key={asset.id}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#fff0e7] px-3 py-1 text-xs font-semibold text-[#9d4317]">
                          dataId #{asset.id}
                        </span>
                        <span className="rounded-full bg-[#eff6f1] px-3 py-1 text-xs font-semibold text-[#356348]">
                          {asset.canAccess ? "열람 가능" : "잠김"}
                        </span>
                        {asset.isSold ? (
                          <span className="rounded-full bg-[#fff7db] px-3 py-1 text-xs font-semibold text-[#7c6227]">
                            1회 이상 판매
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {parseTagTokens(asset.tags).map((token) => (
                          <span className="chip-tag" key={`${asset.id}-${token}`}>
                            {token}
                          </span>
                        ))}
                      </div>
                      <p className="break-all text-xs muted">dbId: {asset.dbId}</p>
                      <p className="text-sm muted">판매자: {asset.owner}</p>
                    </div>
                    <div className="flex flex-col gap-2 lg:min-w-56">
                      <div className="rounded-2xl border border-line bg-white/80 px-4 py-3">
                        <p className="text-xs uppercase tracking-[0.2em] muted">가격</p>
                        <p className="mt-2 text-lg font-semibold">{asset.priceEth} ETH</p>
                      </div>
                      <button
                        className="button-primary"
                        disabled={activeId === asset.id || !account || account === asset.owner}
                        onClick={() => {
                          void purchaseAsset(asset);
                        }}
                        type="button"
                      >
                        {activeId === asset.id ? "처리 중..." : `${asset.priceEth} ETH에 구매`}
                      </button>
                      <button
                        className="button-secondary"
                        disabled={activeId === asset.id || !account}
                        onClick={() => {
                          void viewRawData(asset);
                        }}
                        type="button"
                      >
                        원본 데이터 열람
                      </button>
                    </div>
                  </div>
                </article>
              ))}
              {!filteredAssets.length ? (
                <div className="rounded-[26px] border border-dashed border-line bg-white/50 p-6 text-sm muted">
                  현재 필터 조합에 맞는 데이터가 없습니다.
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[26px] border border-line bg-white/70 p-4 text-sm leading-6">
                <p className="font-medium">상태</p>
                <p className="mt-2 muted">{status}</p>
                <p className="mt-4 text-xs muted">
                  이 PoC는 속도를 위해 클라이언트에서 Supabase를 직접 읽습니다. 실제 서비스에서는
                  신뢰 가능한 서버 경계 뒤로 데이터 접근을 옮겨야 합니다.
                </p>
              </div>
              <div className="rounded-[26px] border border-line bg-[#1b1713] p-4 text-sm text-[#f6efe4]">
                <p className="font-medium">열람한 raw_data</p>
                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all text-xs leading-6 text-[#f5dfbd]">
                  {selectedRawData || "구매 후 열람한 데이터가 여기에 표시됩니다."}
                </pre>
              </div>
            </div>
          </>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
            <div className="rounded-[24px] border border-line bg-white/75 p-5">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium">조건 필터 선택</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {filterOptions.map((option) => {
                      const isSelected = requestFilters.includes(option.token);
                      return (
                        <button
                          className={`chip-filter ${isSelected ? "chip-filter-active" : ""}`}
                          key={option.token}
                          onClick={() => toggleRequestFilter(option.token)}
                          type="button"
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium">요청 이름</span>
                    <input
                      className="input-surface"
                      onChange={(event) => setRequestTitle(event.target.value)}
                      value={requestTitle}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium">희망 예산</span>
                    <input
                      className="input-surface"
                      onChange={(event) => setRequestBudgetEth(event.target.value)}
                      value={requestBudgetEth}
                    />
                  </label>
                </div>
                <label className="block space-y-2">
                  <span className="text-sm font-medium">추가 메모</span>
                  <textarea
                    className="input-surface min-h-32 resize-y"
                    onChange={(event) => setRequestNote(event.target.value)}
                    value={requestNote}
                  />
                </label>
                <div className="flex flex-wrap gap-3">
                  <button className="button-primary" onClick={submitRequestDraft} type="button">
                    조건 요청 초안 만들기
                  </button>
                  <button className="button-secondary" onClick={applyRequestFiltersToCatalog} type="button">
                    이 조건으로 바로 구매 보기
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[24px] border border-line bg-white/75 p-5">
                <p className="font-medium">요청 요약</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {requestFilters.length ? (
                    requestFilters.map((token) => (
                      <span className="chip-tag" key={token}>
                        {token}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm muted">선택된 요청 필터가 없습니다.</span>
                  )}
                </div>
                <div className="mt-4 space-y-3 text-sm leading-6 muted">
                  <p>요청 이름: {requestTitle}</p>
                  <p>예산: {requestBudgetEth} ETH</p>
                  <p>메모: {requestNote}</p>
                </div>
              </div>

              <div className="rounded-[24px] border border-line bg-[#20160f] p-5 text-sm text-[#f6efe4]">
                <p className="font-medium">요청 상태</p>
                <p className="mt-3 text-[#f5dfbd]">{requestStatus}</p>
                <p className="mt-4 text-xs leading-6 text-[#f5dfbd]">
                  이 요청 모드는 현재 PoC에서 선택형 수요 정의를 보여주기 위한 UI입니다.
                  실제 저장과 매칭 로직은 다음 단계에서 Supabase 요청 테이블로 확장할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
