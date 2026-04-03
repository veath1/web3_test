"use client";

import { useEffect, useMemo, useState } from "react";
import { WalletConnect } from "@/components/WalletConnect";

type ScenarioDemoProps = {
  account: string | null;
  onAccountChange: (account: string | null) => void;
};

type TabId = "register" | "request" | "payment" | "seller" | "explorer";

type DemoEvent = {
  id: string;
  label: string;
  payload: string;
  timestamp: string;
  txHash?: string;
};

type DemoBlock = {
  index: number;
  label: string;
  payload: string;
  timestamp: string;
  prevHash: string;
  hash: string;
  txHash: string;
  nonce: number;
};

type AccessLog = {
  viewer: string;
  viewedAt: string;
  amountEth: string;
  txHash: string;
  requestTitle: string;
};

const tabs: Array<{ id: TabId; short: string; title: string }> = [
  { id: "register", short: "1", title: "개인 등록" },
  { id: "request", short: "2", title: "기업 요청" },
  { id: "payment", short: "3", title: "결제와 열람" },
  { id: "seller", short: "4", title: "판매자 확인" },
  { id: "explorer", short: "5", title: "블록체인 확인" }
];

const stepNarratives: Record<
  TabId,
  {
    title: string;
    action: string;
    system: string;
    proof: string;
  }
> = {
  register: {
    title: "개인이 판매할 데이터를 올립니다",
    action: "개인은 판매자 주소와 기업 주소를 정하고, 판매 가격이 붙은 데이터 항목을 등록합니다.",
    system:
      "민감한 원본 데이터는 데이터베이스에 있고, 블록체인에는 가격, 태그, 접근 기준 같은 메타정보만 남는 구조를 보여줍니다.",
    proof: "등록이 끝나면 기업이 어떤 조건으로 이 데이터를 찾을지 다음 단계에서 확인합니다."
  },
  request: {
    title: "기업이 필요한 타깃을 명확히 요청합니다",
    action: "증권사는 무작위 발송 대신 IRP 미가입 고액 자산가만 찾겠다는 조건을 제출합니다.",
    system:
      "기업은 데이터 원본을 바로 보지 못하고, 먼저 어떤 고객군을 사고 싶은지 요청을 남기는 흐름입니다.",
    proof: "이 단계가 있어야 기업이 왜 비용을 내는지, 데이터의 상업적 가치가 무엇인지 설명됩니다."
  },
  payment: {
    title: "결제와 열람 권한이 동시에 발생합니다",
    action: "기업이 비용을 지불하면 판매자에게 대금이 정산되고, 기업은 원본 데이터 열람 권한을 얻습니다.",
    system:
      "권한 확인이 끝나기 전에는 원본 데이터가 보이지 않고, 결제가 확인된 뒤에만 데이터가 열립니다.",
    proof: "원본은 오프체인, 정산과 권한은 온체인이라는 구조가 가장 잘 드러나는 단계입니다."
  },
  seller: {
    title: "판매자는 누가 봤는지와 얼마를 받았는지 확인합니다",
    action: "개인은 자신의 지갑 기준으로 열람 기록과 입금 결과를 검토합니다.",
    system:
      "구매자 주소, 시각, 거래 해시, 결제 금액이 기록되어 이후 감사와 정산 검증이 가능합니다.",
    proof: "데이터 주권이 실제 수익으로 연결된다는 점을 가장 직관적으로 보여주는 단계입니다."
  },
  explorer: {
    title: "외부 블록체인 탐색기로 투명성을 설명합니다",
    action: "공개 네트워크에 배포된 경우 판매자, 구매자, 컨트랙트 주소를 탐색기에서 직접 열어봅니다.",
    system:
      "상단 시나리오 데모는 설명용 시뮬레이션이고, 실제 체인 흔적은 공개 네트워크 배포와 함께 확인할 수 있습니다.",
    proof: "외부 기록으로 검증 가능하다는 점을 마지막에 강조하면 데모 마무리가 깔끔해집니다."
  }
};

const defaultSellerWallet =
  process.env.NEXT_PUBLIC_LOCAL_SELLER_ADDRESS ??
  "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
const defaultEnterpriseWallet =
  process.env.NEXT_PUBLIC_LOCAL_ENTERPRISE_ADDRESS ??
  "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
const defaultRawData = JSON.stringify(
  {
    balance_krw: 50000000,
    has_irp: false,
    salary_worker: true,
    spending_power_score: 91
  },
  null,
  2
);

function normalizeAddress(value: string) {
  return value.trim().toLowerCase();
}

function shortAddress(value: string) {
  if (value.length < 12) {
    return value;
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function isAddress(value: string) {
  return /^0x[a-f0-9]{40}$/i.test(value.trim());
}

function toHexFragment(value: number) {
  return Math.abs(value >>> 0).toString(16).padStart(8, "0");
}

function pseudoHash(input: string) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;

  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    h1 ^= code;
    h1 = Math.imul(h1, 16777619);
    h2 ^= code + index;
    h2 = Math.imul(h2, 2246822519);
  }

  const joined = [
    toHexFragment(h1),
    toHexFragment(h2),
    toHexFragment(h1 ^ h2),
    toHexFragment(h1 + h2),
    toHexFragment(h1 - h2),
    toHexFragment(h2 - h1),
    toHexFragment(h1 ^ 0xabcdef),
    toHexFragment(h2 ^ 0x123456)
  ].join("");

  return `0x${joined.slice(0, 64)}`;
}

function chainLabel(chainId?: string) {
  switch (chainId) {
    case "1":
      return "Ethereum Mainnet";
    case "11155111":
      return "Sepolia";
    case "17000":
      return "Holesky";
    default:
      return "설정된 탐색기";
  }
}

function explorerBaseUrl(chainId?: string) {
  const configured = process.env.NEXT_PUBLIC_ETHERSCAN_BASE_URL;

  if (configured) {
    return configured;
  }

  switch (chainId) {
    case "11155111":
      return "https://sepolia.etherscan.io";
    case "17000":
      return "https://holesky.etherscan.io";
    case "1":
    default:
      return "https://etherscan.io";
  }
}

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString();
}

function summarizeText(value: string, limit = 110) {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit).trim()}...`;
}

export function ScenarioDemo({ account, onAccountChange }: ScenarioDemoProps) {
  const [activeTab, setActiveTab] = useState<TabId>("register");
  const [sellerWallet, setSellerWallet] = useState(defaultSellerWallet);
  const [enterpriseWallet, setEnterpriseWallet] = useState(defaultEnterpriseWallet);
  const [rawData, setRawData] = useState(defaultRawData);
  const [priceEth, setPriceEth] = useState("0.01");
  const [tags, setTags] = useState("high-net-worth, no-irp, irp-enrollment");
  const [requestTitle, setRequestTitle] = useState("IRP 가입 유도 대상 요청");
  const [requestRule, setRequestRule] = useState("예적금은 많지만 IRP 계좌가 없는 사용자 찾기");
  const [demoDbId, setDemoDbId] = useState("");
  const [listingReady, setListingReady] = useState(false);
  const [requestReady, setRequestReady] = useState(false);
  const [accessGranted, setAccessGranted] = useState(false);
  const [sellerBalanceEth, setSellerBalanceEth] = useState("0.00");
  const [lastTxHash, setLastTxHash] = useState("");
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [events, setEvents] = useState<DemoEvent[]>([]);
  const [status, setStatus] = useState(
    "1단계부터 5단계까지 순서대로 누르면 사업 흐름이 자연스럽게 보입니다."
  );
  const [interactionFeedback, setInteractionFeedback] = useState(
    "현재는 1단계가 열려 있습니다. 단계나 블록을 클릭하면 여기서 바로 반응을 보여줍니다."
  );
  const [selectedBlockIndex, setSelectedBlockIndex] = useState(0);
  const [showLedger, setShowLedger] = useState(true);
  const [showTechnicalFields, setShowTechnicalFields] = useState(false);
  const [showWalletConnect, setShowWalletConnect] = useState(false);

  useEffect(() => {
    if (account) {
      setSellerWallet(account);
    }
  }, [account]);

  const blocks = useMemo<DemoBlock[]>(() => {
    const timeline: DemoEvent[] = [
      {
        id: "genesis",
        label: "GENESIS",
        payload: "Web2.5 market started. Raw data stays off-chain while payment and access stay on-chain.",
        timestamp: new Date("2026-01-01T00:00:00.000Z").toISOString()
      },
      ...events
    ];

    let prevHash = `0x${"0".repeat(64)}`;

    return timeline.map((event, index) => {
      const material = `${index}:${event.label}:${event.payload}:${event.timestamp}:${prevHash}`;
      const hash = pseudoHash(material);
      const txHash = event.txHash ?? pseudoHash(`tx:${material}`);
      const block = {
        index,
        label: event.label,
        payload: event.payload,
        timestamp: event.timestamp,
        prevHash,
        hash,
        txHash,
        nonce: (index + 1) * 7919
      };

      prevHash = hash;

      return block;
    });
  }, [events]);

  useEffect(() => {
    setSelectedBlockIndex(blocks.length - 1);
  }, [blocks.length]);

  const selectedBlock = blocks[selectedBlockIndex] ?? blocks[0];
  const networkLabel = chainLabel(process.env.NEXT_PUBLIC_CHAIN_ID);
  const baseExplorerUrl = explorerBaseUrl(process.env.NEXT_PUBLIC_CHAIN_ID);
  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "";
  const hasContractAddress = isAddress(contractAddress) && !/^0x0{40}$/i.test(contractAddress);
  const currentTab = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const activeNarrative = stepNarratives[activeTab];
  const progressItems = [
    {
      label: "개인 데이터 등록",
      value: listingReady ? "완료" : "대기"
    },
    {
      label: "기업 요청 제출",
      value: requestReady ? "완료" : "대기"
    },
    {
      label: "결제와 권한 부여",
      value: accessGranted ? "완료" : "잠금"
    },
    {
      label: "외부 확인 링크",
      value: lastTxHash ? "준비됨" : "대기"
    }
  ];

  function appendEvent(label: string, payload: string, txHash?: string) {
    setEvents((current) => [
      ...current,
      {
        id: `${label}-${Date.now()}`,
        label,
        payload,
        timestamp: new Date().toISOString(),
        txHash
      }
    ]);
  }

  function openTab(tabId: TabId) {
    const nextTab = tabs.find((tab) => tab.id === tabId) ?? tabs[0];
    setActiveTab(tabId);
    setInteractionFeedback(`${nextTab.short}단계 "${nextTab.title}" 화면으로 이동했습니다.`);
  }

  function selectBlock(index: number) {
    const block = blocks[index];
    if (!block) {
      return;
    }

    setSelectedBlockIndex(index);
    setInteractionFeedback(`Block ${block.index} ${block.label}을 선택했습니다. 아래 상세 정보가 갱신되었습니다.`);
  }

  function registerScenario() {
    const normalizedSeller = normalizeAddress(sellerWallet);
    const normalizedEnterprise = normalizeAddress(enterpriseWallet);

    if (!isAddress(normalizedSeller)) {
      setStatus("개인 지갑 주소 형식이 올바른지 먼저 확인하세요.");
      return;
    }

    if (!isAddress(normalizedEnterprise)) {
      setStatus("기업 지갑 주소 형식이 올바른지 먼저 확인하세요.");
      return;
    }

    try {
      JSON.parse(rawData);
    } catch {
      setStatus("원본 데이터 JSON 형식이 잘못되었습니다.");
      return;
    }

    const nextDbId = `demo-db-${Date.now().toString(36)}`;
    setDemoDbId(nextDbId);
    setListingReady(true);
    setRequestReady(false);
    setAccessGranted(false);
    setSellerBalanceEth("0.00");
    setLastTxHash("");
    setAccessLogs([]);
    setEvents([]);

    appendEvent(
      "REGISTERED",
      `Seller ${shortAddress(normalizedSeller)} registered ${nextDbId} with buyer ${shortAddress(normalizedEnterprise)} at ${priceEth} ETH and tags ${tags}.`
    );

    setStatus("1단계 완료. 개인 데이터와 판매 조건이 등록되었습니다.");
    setInteractionFeedback("개인 데이터 등록이 완료되었습니다. 이제 기업 요청 단계로 넘어갑니다.");
    setActiveTab("request");
  }

  function submitRequest() {
    if (!listingReady) {
      setStatus("먼저 1단계에서 판매 데이터 등록을 완료하세요.");
      return;
    }

    setRequestReady(true);
    appendEvent(
      "REQUESTED",
      `Enterprise ${shortAddress(normalizeAddress(enterpriseWallet))} requested ${requestTitle}. Rule: ${requestRule}.`
    );
    setStatus("2단계 완료. 기업이 어떤 고객군을 원하는지 요청이 기록되었습니다.");
    setInteractionFeedback("기업 요청이 장부에 기록되었습니다. 이제 결제와 열람 단계로 이동합니다.");
    setActiveTab("payment");
  }

  function grantAccessAndPayment() {
    if (!requestReady) {
      setStatus("먼저 2단계에서 기업 요청을 제출하세요.");
      return;
    }

    if (accessGranted) {
      setStatus("이 시나리오에서는 이미 결제와 열람 권한 부여가 끝났습니다.");
      return;
    }

    const txHash = pseudoHash(
      `${normalizeAddress(sellerWallet)}:${normalizeAddress(enterpriseWallet)}:${demoDbId}:${priceEth}:${Date.now()}`
    );

    setAccessGranted(true);
    setLastTxHash(txHash);
    setSellerBalanceEth(Number(priceEth).toFixed(2));
    setAccessLogs((current) => [
      {
        viewer: normalizeAddress(enterpriseWallet),
        viewedAt: new Date().toISOString(),
        amountEth: priceEth,
        txHash,
        requestTitle
      },
      ...current
    ]);
    appendEvent(
      "PURCHASED",
      `Enterprise ${shortAddress(normalizeAddress(enterpriseWallet))} paid ${priceEth} ETH and unlocked ${demoDbId}.`,
      txHash
    );
    appendEvent(
      "VIEWED",
      `Enterprise ${shortAddress(normalizeAddress(enterpriseWallet))} viewed the raw data after access verification.`,
      txHash
    );
    setStatus("3단계 완료. 기업이 결제했고, 판매자 입금과 열람 권한이 동시에 반영되었습니다.");
    setInteractionFeedback("결제와 열람 권한 부여가 완료되었습니다. 판매자 감사 화면으로 이동합니다.");
    setActiveTab("seller");
  }

  function resetScenario() {
    setActiveTab("register");
    setSellerWallet(account ?? defaultSellerWallet);
    setEnterpriseWallet(defaultEnterpriseWallet);
    setRawData(defaultRawData);
    setPriceEth("0.01");
    setTags("high-net-worth, no-irp, irp-enrollment");
    setRequestTitle("IRP 가입 유도 대상 요청");
    setRequestRule("예적금은 많지만 IRP 계좌가 없는 사용자 찾기");
    setDemoDbId("");
    setListingReady(false);
    setRequestReady(false);
    setAccessGranted(false);
    setSellerBalanceEth("0.00");
    setLastTxHash("");
    setAccessLogs([]);
    setEvents([]);
    setShowLedger(true);
    setShowTechnicalFields(false);
    setShowWalletConnect(false);
    setStatus("시나리오를 초기 상태로 되돌렸습니다. 다시 1단계부터 진행하세요.");
    setInteractionFeedback("데모를 초기화했습니다. 1단계부터 다시 진행할 수 있습니다.");
  }

  function renderActiveTab() {
    if (activeTab === "register") {
      return (
        <div className="rounded-[24px] border border-line bg-white/75 p-5">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-lg font-semibold">1. 개인 데이터와 지갑 정보를 등록합니다</p>
              <p className="text-sm leading-6 muted">
                판매자 주소, 기업 주소, 가격만 보면 됩니다. 원본 전체는 블록체인에 올리지 않고
                필요할 때만 기술 세부값을 펼쳐볼 수 있습니다.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium">개인 지갑 주소</span>
                <input
                  className="input-surface"
                  onChange={(event) => setSellerWallet(event.target.value)}
                  value={sellerWallet}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">기업 지갑 주소</span>
                <input
                  className="input-surface"
                  onChange={(event) => setEnterpriseWallet(event.target.value)}
                  value={enterpriseWallet}
                />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1.08fr_0.92fr]">
              <div className="rounded-[20px] border border-line bg-[#fff6ea] p-4">
                <p className="text-xs uppercase tracking-[0.2em] muted">데이터 요약</p>
                <p className="mt-2 text-sm font-medium">예적금 5,000만 원 보유, IRP 계좌 없음</p>
                <p className="mt-2 text-xs muted">태그 기준: {tags}</p>
              </div>
              <label className="block space-y-2">
                <span className="text-sm font-medium">판매 가격</span>
                <input
                  className="input-surface"
                  onChange={(event) => setPriceEth(event.target.value)}
                  value={priceEth}
                />
              </label>
            </div>
            <div className="rounded-[20px] border border-line bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">실제 지갑 연결은 선택입니다</p>
                  <p className="mt-1 text-sm leading-6 muted">
                    기본 주소로도 데모가 진행됩니다. 실제 지갑을 보여주고 싶을 때만 펼치세요.
                  </p>
                </div>
                <button
                  className="button-secondary"
                  onClick={() => {
                    setShowWalletConnect((current) => !current);
                    setInteractionFeedback(
                      showWalletConnect
                        ? "지갑 연결 패널을 접었습니다. 기본 데모 주소로 계속 진행합니다."
                        : "지갑 연결 패널을 펼쳤습니다. MetaMask 연결을 시연할 수 있습니다."
                    );
                  }}
                  type="button"
                >
                  {showWalletConnect ? "지갑 연결 접기" : "지갑 연결 펼치기"}
                </button>
              </div>
              {showWalletConnect ? (
                <div className="mt-4 border-t border-line pt-4">
                  <WalletConnect account={account} onAccountChange={onAccountChange} />
                </div>
              ) : (
                <div className="mt-4 rounded-[16px] border border-dashed border-line bg-[#fffdf9] px-4 py-3 text-sm muted">
                  현재는 고정된 로컬 데모 주소를 사용 중입니다.
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                className="button-secondary"
                onClick={() => {
                  if (account) {
                    setSellerWallet(account);
                    setStatus("연결된 지갑 주소를 개인 판매자 주소로 복사했습니다.");
                    setInteractionFeedback("연결된 지갑 주소를 판매자 주소 입력칸에 반영했습니다.");
                  } else {
                    setStatus("지갑 연결 없이도 기본 주소로 데모를 진행할 수 있습니다.");
                    setInteractionFeedback("지갑이 연결되어 있지 않아 기본 데모 주소를 유지합니다.");
                  }
                }}
                type="button"
              >
                연결된 지갑 주소 사용
              </button>
              <button
                className="button-secondary"
                onClick={() => {
                  setShowTechnicalFields((current) => !current);
                  setInteractionFeedback(
                    showTechnicalFields
                      ? "기술 세부값을 숨겼습니다. 발표용 기본 화면으로 돌아왔습니다."
                      : "기술 세부값을 펼쳤습니다. 태그와 원본 JSON까지 확인할 수 있습니다."
                  );
                }}
                type="button"
              >
                {showTechnicalFields ? "기술 세부값 숨기기" : "기술 세부값 보기"}
              </button>
              <button className="button-secondary" onClick={resetScenario} type="button">
                데모 초기화
              </button>
            </div>
            {showTechnicalFields ? (
              <div className="space-y-4 rounded-[20px] border border-line bg-white/80 p-4">
                <label className="block space-y-2">
                  <span className="text-sm font-medium">검색 태그</span>
                  <input
                    className="input-surface"
                    onChange={(event) => setTags(event.target.value)}
                    value={tags}
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium">원본 데이터 JSON</span>
                  <textarea
                    className="input-surface min-h-48 resize-y"
                    onChange={(event) => setRawData(event.target.value)}
                    value={rawData}
                  />
                </label>
              </div>
            ) : null}
            <button className="button-primary w-full" onClick={registerScenario} type="button">
              개인 데이터 등록 완료
            </button>
            <div className="rounded-[20px] border border-line bg-white/80 p-4 text-sm leading-6">
              <p className="font-medium">현재 등록 상태</p>
              <p className="mt-2 muted">
                dbId: {demoDbId || "아직 생성 전"} | 가격: {priceEth} ETH
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === "request") {
      return (
        <div className="rounded-[24px] border border-line bg-white/75 p-5">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-lg font-semibold">2. 기업이 IRP 타깃 고객을 요청합니다</p>
              <p className="text-sm leading-6 muted">
                이 단계는 왜 기업이 돈을 내는지를 보여주는 구간입니다. 무작위 광고가 아니라
                정확한 타깃을 사는 구조라는 점을 설명합니다.
              </p>
            </div>
            <label className="block space-y-2">
              <span className="text-sm font-medium">요청 이름</span>
              <input
                className="input-surface"
                onChange={(event) => setRequestTitle(event.target.value)}
                value={requestTitle}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium">타깃 조건</span>
              <textarea
                className="input-surface min-h-32 resize-y"
                onChange={(event) => setRequestRule(event.target.value)}
                value={requestRule}
              />
            </label>
            <button className="button-primary w-full" onClick={submitRequest} type="button">
              기업 요청 제출
            </button>
            <div className="grid gap-3 lg:grid-cols-[0.92fr_1.08fr]">
              <div className="rounded-[20px] border border-line bg-[#20160f] p-4 text-[#f6efe4]">
                <p className="font-medium">발표 포인트</p>
                <p className="mt-2 text-sm leading-6 text-[#f5dfbd]">
                  기업은 가치 없는 대량 데이터가 아니라, 실제 전환 가능성이 높은 고객군에만
                  비용을 지불합니다.
                </p>
              </div>
              <div className="rounded-[20px] border border-line bg-white p-4">
                <p className="font-medium">현재 요청 미리보기</p>
                <div className="mt-4 space-y-3 text-sm leading-6 muted">
                  <p>기업 지갑: {shortAddress(normalizeAddress(enterpriseWallet))}</p>
                  <p>요청 이름: {requestTitle}</p>
                  <p>조건: {requestRule}</p>
                  <p>매칭 태그: {tags}</p>
                  <p>판매 목록 등록 여부: {listingReady ? "완료" : "미완료"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === "payment") {
      return (
        <div className="rounded-[24px] border border-line bg-white/75 p-5">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-lg font-semibold">3. 기업이 결제하고 데이터 열람 권한을 얻습니다</p>
              <p className="text-sm leading-6 muted">
                결제가 끝나기 전에는 원본 데이터가 보이지 않습니다. 결제 직후에만 판매자
                정산과 기업 열람 권한이 동시에 반영됩니다.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[20px] border border-line bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] muted">오프체인 데이터 ID</p>
                <p className="mt-2 break-all text-sm font-medium">{demoDbId || "미등록"}</p>
              </div>
              <div className="rounded-[20px] border border-line bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] muted">결제 금액</p>
                <p className="mt-2 text-sm font-medium">{priceEth} ETH</p>
              </div>
            </div>
            <button
              className="button-primary w-full"
              disabled={!requestReady || accessGranted}
              onClick={grantAccessAndPayment}
              type="button"
            >
              {accessGranted ? "결제 처리 완료" : "결제 실행 + 열람 권한 부여"}
            </button>
            <div className="rounded-[20px] border border-line bg-[#fff6ea] p-4 text-sm leading-6">
              <p className="font-medium">기업이 보는 데이터 화면</p>
              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all text-xs leading-6 muted">
                {accessGranted ? rawData : "아직 결제가 되지 않아 원본 데이터는 가려져 있습니다."}
              </pre>
            </div>
            <div className="grid gap-3 lg:grid-cols-[0.94fr_1.06fr]">
              <div className="rounded-[20px] border border-line bg-[#20160f] p-4 text-[#f6efe4]">
                <p className="font-medium">결제 결과</p>
                <div className="mt-3 space-y-2 text-sm leading-6 text-[#f5dfbd]">
                  <p>열람 권한: {accessGranted ? "true" : "false"}</p>
                  <p>구매자: {shortAddress(normalizeAddress(enterpriseWallet))}</p>
                  <p>판매자: {shortAddress(normalizeAddress(sellerWallet))}</p>
                  <p>판매자 입금액: {sellerBalanceEth} ETH</p>
                  <p>마지막 거래 해시: {lastTxHash || "결제 전"}</p>
                </div>
              </div>
              <div className="rounded-[20px] border border-line bg-white p-4">
                <p className="font-medium">핵심 메시지</p>
                <p className="mt-2 text-sm leading-6 muted">
                  플랫폼이 돈을 대신 들고 있는 것이 아니라, 규칙에 맞는 결제가 일어나면 판매자
                  지갑으로 즉시 정산된다는 점이 핵심입니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === "seller") {
      return (
        <div className="rounded-[24px] border border-line bg-white/75 p-5">
          <div className="space-y-4">
            <div>
              <p className="text-lg font-semibold">4. 판매자가 열람 기록과 입금을 확인합니다</p>
              <p className="mt-2 text-sm leading-6 muted">
                누가 데이터를 봤는지, 언제 결제가 일어났는지, 얼마를 받았는지가 한 번에
                정리됩니다.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[20px] border border-line bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] muted">판매자 지갑</p>
                <p className="mt-2 break-all text-sm font-medium">{sellerWallet}</p>
              </div>
              <div className="rounded-[20px] border border-line bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] muted">누적 입금액</p>
                <p className="mt-2 text-sm font-medium">{sellerBalanceEth} ETH</p>
              </div>
            </div>
            <div className="mt-4 rounded-[20px] border border-line bg-[#fff6ea] p-4 text-sm leading-6">
              <p className="font-medium">왜 중요한가</p>
              <p className="mt-2 muted">
                데이터 판매자가 실제 수익을 확인할 수 있고, 누가 자신의 데이터를 열람했는지
                추적할 수 있어야 데이터 주권이 의미를 가집니다.
              </p>
            </div>
            <div className="rounded-[20px] border border-line bg-[#20160f] p-5 text-sm text-[#f6efe4]">
              <p className="font-medium">열람 기록</p>
              <div className="mt-4 space-y-3">
                {accessLogs.length ? (
                  accessLogs.map((log) => (
                    <div className="rounded-[18px] border border-white/10 bg-white/5 p-4" key={log.txHash}>
                      <p className="text-sm font-medium text-white">{shortAddress(log.viewer)}</p>
                      <p className="mt-2 break-all text-xs leading-6 text-[#f5dfbd]">
                        열람 시각: {formatTimestamp(log.viewedAt)}
                      </p>
                      <p className="break-all text-xs leading-6 text-[#f5dfbd]">
                        결제 금액: {log.amountEth} ETH
                      </p>
                      <p className="break-all text-xs leading-6 text-[#f5dfbd]">
                        거래 해시: {log.txHash}
                      </p>
                      <p className="text-xs leading-6 text-[#f5dfbd]">요청 목적: {log.requestTitle}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[#f5dfbd]">아직 기록된 열람 이력이 없습니다.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === "explorer") {
      return (
        <div className="rounded-[24px] border border-line bg-white/75 p-5">
          <div className="space-y-4">
            <p className="text-lg font-semibold">5. 외부 블록체인 기록으로 신뢰를 설명합니다</p>
            <p className="mt-2 text-sm leading-6 muted">
              실제 공개 체인에 배포한 경우 아래 링크로 판매자, 기업, 컨트랙트 주소를
              바로 열어볼 수 있습니다.
            </p>
            <div className="mt-4 space-y-3">
              <a
                className="button-primary w-full"
                href={baseExplorerUrl}
                rel="noreferrer"
                target="_blank"
              >
                {networkLabel} 탐색기 열기
              </a>
              <a
                className="button-secondary w-full"
                href={`${baseExplorerUrl}/address/${normalizeAddress(sellerWallet)}`}
                rel="noreferrer"
                target="_blank"
              >
                판매자 주소 열기
              </a>
              <a
                className="button-secondary w-full"
                href={`${baseExplorerUrl}/address/${normalizeAddress(enterpriseWallet)}`}
                rel="noreferrer"
                target="_blank"
              >
                기업 주소 열기
              </a>
              {hasContractAddress ? (
                <a
                  className="button-secondary w-full"
                  href={`${baseExplorerUrl}/address/${contractAddress}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  컨트랙트 주소 열기
                </a>
              ) : null}
            </div>
            <div className="rounded-[20px] border border-line bg-[#20160f] p-5 text-sm text-[#f6efe4]">
              <p className="font-medium">중요한 구분</p>
              <div className="mt-4 space-y-3 text-sm leading-6 text-[#f5dfbd]">
                <p>상단 데모 거래 해시: {lastTxHash || "아직 생성 전"}</p>
                <p>현재 탐색기 기준 네트워크: {networkLabel}</p>
                <p>판매자 주소: {sellerWallet}</p>
                <p>기업 주소: {enterpriseWallet}</p>
                <p>컨트랙트 주소: {hasContractAddress ? contractAddress : "아직 미설정"}</p>
                <p>
                  상단 5단계 데모는 설명용 시뮬레이션입니다. 실제 공개 기록은 하단 고급 모드로
                  컨트랙트를 실행하고, 공개 테스트넷에 배포했을 때 탐색기에서 확인할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  }

  function renderLedgerPanel() {
    return (
      <div className="rounded-[24px] border border-line bg-white/75 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-lg font-semibold">시뮬레이션 장부</p>
            <p className="text-sm leading-6 muted">
              거래 흐름과 선택한 블록 상세를 같은 화면에서 함께 보이도록 정리한 영역입니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="rounded-full border border-line bg-[#fff6ea] px-4 py-2 text-sm font-medium">
              총 {blocks.length}개 블록
            </div>
            <button
              className="button-secondary"
              onClick={() => {
                setShowLedger((current) => !current);
                setInteractionFeedback(
                  showLedger
                    ? "시뮬레이션 장부를 접었습니다."
                    : "시뮬레이션 장부를 다시 펼쳤습니다."
                );
              }}
              type="button"
            >
              {showLedger ? "장부 접기" : "장부 다시 보기"}
            </button>
            <button className="button-secondary" onClick={resetScenario} type="button">
              데모 초기화
            </button>
          </div>
        </div>

        {showLedger ? (
          <div className="mt-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[20px] border border-line bg-[#fff6ea] p-4">
                <p className="text-xs uppercase tracking-[0.2em] muted">현재 단계</p>
                <p className="mt-2 text-sm font-semibold">
                  {currentTab.short}. {currentTab.title}
                </p>
              </div>
              <div className="rounded-[20px] border border-line bg-white p-4">
                <p className="text-xs uppercase tracking-[0.2em] muted">최신 블록</p>
                <p className="mt-2 text-sm font-semibold">{blocks[blocks.length - 1]?.label}</p>
              </div>
              <div className="rounded-[20px] border border-line bg-white p-4">
                <p className="text-xs uppercase tracking-[0.2em] muted">선택한 블록</p>
                <p className="mt-2 text-sm font-semibold">Block {selectedBlock.index}</p>
              </div>
            </div>

            <div className="rounded-[20px] border border-line bg-white p-3">
              <div className="flex items-center justify-between gap-3 px-1">
                <p className="text-sm font-medium">블록 흐름</p>
                <p className="text-xs muted">가로로 넘기며 순서를 확인하세요</p>
              </div>
              <div className="mt-3 overflow-x-auto pb-2">
                <div className="flex min-w-max items-stretch gap-3">
                  {blocks.map((block, index) => (
                    <div className="flex items-center gap-3" key={block.hash}>
                      <button
                        className={`w-72 shrink-0 rounded-[20px] border p-4 text-left transition ${
                          selectedBlockIndex === block.index
                            ? "border-[#cb5a21] bg-[#fff0e7]"
                            : "border-line bg-[#fffdf9] hover:bg-[#fff7ef]"
                        }`}
                        onClick={() => selectBlock(block.index)}
                        type="button"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs uppercase tracking-[0.2em] muted">Block {block.index}</p>
                          <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-[#9d4317]">
                            {selectedBlockIndex === block.index
                              ? "선택됨"
                              : block.index === blocks.length - 1
                                ? "최신"
                                : "보기"}
                          </span>
                        </div>
                        <p className="mt-3 text-base font-semibold">{block.label}</p>
                        <p className="mt-2 text-xs muted">{formatTimestamp(block.timestamp)}</p>
                        <p className="mt-3 text-sm leading-6 muted">
                          {summarizeText(block.payload, 88)}
                        </p>
                        <div className="mt-4 border-t border-line pt-3 text-xs muted">
                          {shortAddress(block.txHash)}
                        </div>
                      </button>
                      {index < blocks.length - 1 ? (
                        <span className="text-lg font-semibold text-[#cb5a21]">-&gt;</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[20px] border border-line bg-[#20160f] p-5 text-sm text-[#f6efe4]">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">선택한 블록 상세</p>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[#f5dfbd]">
                    Block {selectedBlock.index}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[16px] border border-white/10 bg-white/5 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#f5dfbd]">Label</p>
                    <p className="mt-2 text-sm font-semibold text-white">{selectedBlock.label}</p>
                  </div>
                  <div className="rounded-[16px] border border-white/10 bg-white/5 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#f5dfbd]">Nonce</p>
                    <p className="mt-2 text-sm font-semibold text-white">{selectedBlock.nonce}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-3 text-xs leading-6 text-[#f5dfbd]">
                  <p>시각: {formatTimestamp(selectedBlock.timestamp)}</p>
                  <p className="break-all">Hash: {selectedBlock.hash}</p>
                  <p className="break-all">Previous hash: {selectedBlock.prevHash}</p>
                  <p className="break-all">Tx hash: {selectedBlock.txHash}</p>
                </div>
              </div>

              <div className="rounded-[20px] border border-line bg-[#fff6ea] p-4 text-sm leading-6">
                <p className="font-medium">블록 설명</p>
                <p className="mt-2 muted">{selectedBlock.payload}</p>
                <div className="mt-4 rounded-[16px] border border-line bg-white/70 px-4 py-3 text-xs leading-6 muted">
                  블록을 클릭하면 상단 선택 배지와 이 상세 영역이 함께 갱신됩니다.
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-[20px] border border-dashed border-line bg-white/60 px-4 py-5 text-sm leading-6 muted">
            장부는 접혀 있습니다. 다시 펼치면 흐름 카드와 블록 상세를 동시에 볼 수 있습니다.
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="panel flex flex-col gap-5 p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <span className="eyebrow">Guided Demo</span>
          <h2 className="text-2xl font-semibold">처음 보는 사람을 위한 5단계 데모</h2>
          <p className="max-w-2xl text-sm leading-6 muted">
            이 영역은 발표용 설명 모드입니다. 순서대로 클릭하면 개인 등록, 기업 요청, 결제,
            판매자 확인, 외부 검증 흐름을 자연스럽게 따라갈 수 있습니다.
          </p>
        </div>
        <div className="rounded-full border border-line bg-white/80 px-4 py-2 text-sm font-medium">
          현재 단계: {currentTab.short}. {currentTab.title}
        </div>
      </div>

      <div className="rounded-[22px] border border-line bg-[#fff6ea] px-4 py-3 text-sm leading-6">
        상단은 설명용 시뮬레이션입니다. 실제 MetaMask, Supabase, 스마트 컨트랙트 호출은 아래
        고급 모드에서 분리해 확인할 수 있습니다.
      </div>

      <div className="rounded-[22px] border border-[#f0c28f] bg-[#fff8f0] px-4 py-3 text-sm leading-6">
        <span className="font-medium text-[#9d4317]">인터랙션 피드백</span>
        <p className="mt-1 muted">{interactionFeedback}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        {tabs.map((tab) => (
          <button
            className={`rounded-[20px] border px-4 py-3 text-left transition ${
              activeTab === tab.id
                ? "border-[#cb5a21] bg-[#fff0e7]"
                : "border-line bg-white/80 hover:bg-white"
            }`}
            key={tab.id}
            onClick={() => openTab(tab.id)}
            type="button"
          >
            <p className="text-xs uppercase tracking-[0.2em] muted">Step {tab.short}</p>
            <p className="mt-2 text-sm font-semibold">{tab.title}</p>
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <div className="rounded-[22px] border border-line bg-white/75 p-4">
          <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] muted">이번 단계</p>
              <p className="mt-3 text-lg font-semibold">{activeNarrative.title}</p>
              <p className="mt-2 text-sm leading-6 muted">{activeNarrative.action}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] muted">시스템 처리</p>
              <p className="mt-3 text-sm leading-6 muted">{activeNarrative.system}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[18px] border border-line bg-[#fff6ea] p-3 text-sm leading-6">
              <p className="font-medium">여기서 봐야 할 것</p>
              <p className="mt-2 muted">{activeNarrative.proof}</p>
            </div>
            <div className="rounded-[18px] border border-line bg-[#20160f] p-3 text-sm leading-6 text-[#f6efe4]">
              <p className="font-medium">현재 상태</p>
              <p className="mt-2 text-[#f5dfbd]">{status}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[18px] border border-line bg-white p-3">
              <p className="text-xs uppercase tracking-[0.2em] muted">개인 판매자</p>
              <p className="mt-2 break-all text-xs muted">{sellerWallet}</p>
            </div>
            <div className="rounded-[18px] border border-line bg-white p-3">
              <p className="text-xs uppercase tracking-[0.2em] muted">기업 구매자</p>
              <p className="mt-2 break-all text-xs muted">{enterpriseWallet}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {progressItems.map((item) => (
              <div className="rounded-[18px] border border-line bg-white p-3" key={item.label}>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="mt-1 text-xs muted">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {renderActiveTab()}

        {renderLedgerPanel()}
      </div>
    </section>
  );
}
