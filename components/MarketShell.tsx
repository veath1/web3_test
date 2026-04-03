"use client";

import { useState } from "react";
import { EnterpriseDashboard } from "@/components/EnterpriseDashboard";
import { PersonalDashboard } from "@/components/PersonalDashboard";
import { ScenarioDemo } from "@/components/ScenarioDemo";

export function MarketShell() {
  const [account, setAccount] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="panel overflow-hidden px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
        <div className="grid gap-8 lg:grid-cols-[1.18fr_0.82fr] lg:items-center">
          <div className="space-y-6">
            <span className="eyebrow">MyData Market Demo</span>
            <div className="space-y-4">
              <h1 className="max-w-4xl text-4xl font-semibold leading-tight sm:text-5xl">
                개인은 데이터를 팔고, 기업은 필요한 사람의 데이터만 산다
              </h1>
              <p className="max-w-3xl text-base leading-7 muted sm:text-lg">
                이 데모는 마이데이터 원본을 데이터베이스에 보관하고, 결제와 열람 권한만
                블록체인에서 처리하는 Web2.5 구조를 보여줍니다. 위쪽 데모만 따라가도
                왜 이 모델이 필요한지 이해할 수 있고, 아래 고급 모드에서는 실제 지갑과
                컨트랙트 흐름까지 확인할 수 있습니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a className="button-primary" href="#guided-demo">
                60초 데모 보기
              </a>
              <button
                className="button-secondary"
                onClick={() => setShowAdvanced((current) => !current)}
                type="button"
              >
                {showAdvanced ? "고급 모드 숨기기" : "실제 DApp 열기"}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-[28px] border border-line bg-[#20160f] p-5 text-[#f6efe4]">
              <p className="text-xs uppercase tracking-[0.2em] text-[#f5dfbd]">한눈에 보기</p>
              <div className="mt-4 space-y-4 text-sm leading-6 text-[#f6efe4]">
                <div>
                  <p className="font-medium text-white">문제</p>
                  <p className="mt-1 text-[#f5dfbd]">
                    기업은 진짜 IRP 타깃을 모른 채 넓게 광고비를 씁니다.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-white">해결</p>
                  <p className="mt-1 text-[#f5dfbd]">
                    원본은 DB에 두고, 결제와 열람 권한만 체인으로 강제합니다.
                  </p>
                </div>
                <div>
                  <p className="font-medium text-white">결과</p>
                  <p className="mt-1 text-[#f5dfbd]">
                    구매가 일어나면 판매자에게 즉시 정산되고 열람 이력이 남습니다.
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-[24px] border border-line bg-white/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] muted">데모 흐름</p>
              <p className="mt-2 text-base font-semibold">등록, 요청, 결제, 감사, 탐색기 확인</p>
              <p className="mt-2 text-sm muted">
                먼저 상단 Guided Demo로 설명하고, 질문이 나오면 고급 모드에서 실제 지갑과
                컨트랙트 호출을 보여주면 됩니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div id="guided-demo">
        <ScenarioDemo account={account} onAccountChange={setAccount} />
      </div>

      <section className="panel p-6 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <span className="eyebrow">Advanced Mode</span>
            <h2 className="text-2xl font-semibold">실제 컨트랙트와 데이터베이스 조작 패널</h2>
            <p className="max-w-3xl text-sm leading-6 muted">
              발표용 설명 데모와 분리된 영역입니다. MetaMask, 배포된 컨트랙트 주소,
              Supabase 설정이 준비된 상태에서만 사용하면 됩니다.
            </p>
          </div>
          <button
            className="button-secondary"
            onClick={() => setShowAdvanced((current) => !current)}
            type="button"
          >
            {showAdvanced ? "고급 모드 접기" : "고급 모드 펼치기"}
          </button>
        </div>

        {showAdvanced ? (
          <div className="mt-6 space-y-5">
            <div className="rounded-[22px] border border-line bg-[#fff6ea] px-4 py-3 text-sm leading-6">
              상단 설명 데모와 달리, 아래 패널은 실제로 Supabase에 쓰고 스마트 컨트랙트를
              호출합니다.
            </div>
            <section className="grid gap-6 lg:grid-cols-2">
              <PersonalDashboard
                account={account}
                onRegistered={() => {
                  setRefreshKey((value) => value + 1);
                }}
              />
              <EnterpriseDashboard account={account} refreshKey={refreshKey} />
            </section>
          </div>
        ) : (
          <div className="mt-6 rounded-[22px] border border-dashed border-line bg-white/60 px-4 py-5 text-sm leading-6 muted">
            지금은 설명 모드만 보이도록 접어뒀습니다. 질문이 나왔을 때만 고급 모드를 열어
            실제 구매와 열람 과정을 시연하면 됩니다.
          </div>
        )}
      </section>
    </main>
  );
}
