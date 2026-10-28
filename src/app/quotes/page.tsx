"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCase } from "@/components/case-provider";
import {
  EmptyCase,
  Money,
  Notice,
  Panel,
  Tag,
} from "@/components/ui";
import { api } from "@/lib/client";
import { formatYuan } from "@/lib/domain/money";
import type { QuoteRecord } from "@/lib/types";

type QuotesView = {
  quotes: QuoteRecord[];
  selectedProviderId: string | null;
  selectedVersion: number | null;
  selectedStale: boolean;
  profileVersion: number;
};

export default function QuotesPage() {
  const router = useRouter();
  const { caseId, snapshot, refresh } = useCase();
  const [view, setView] = useState<QuotesView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!caseId) return;
    try {
      setView(await api<QuotesView>(`/api/quotes?caseId=${encodeURIComponent(caseId)}`));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "报价加载失败");
    }
  }, [caseId]);

  useEffect(() => {
    // 页面数据通过 API 拉取，异步回调内更新状态。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const replace = snapshot?.case.intent === "replace";
  const selectionValid = Boolean(
    view?.selectedProviderId &&
      view.quotes.some(
        (q) => q.providerId === view.selectedProviderId && q.netFen !== null,
      ) &&
      !view.selectedStale,
  );

  async function select(providerId: string) {
    if (!caseId) return;
    setBusy(providerId);
    setMessage(null);
    try {
      await api("/api/quotes/select", {
        method: "POST",
        json: { caseId, providerId },
      });
      await load();
      await refresh();
      setMessage("已记住此演示报价及版本。更换服务方需要重新确认预约摘要。");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "选择失败");
    } finally {
      setBusy(null);
    }
  }

  if (!caseId) return <EmptyCase />;
  if (!view) {
    return <p className="mono mt-6 text-sm text-dim">正在加载演示报价…</p>;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="hazard mb-5" aria-hidden />
      <p className="label text-rust">P4 · 演示报价</p>
      <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-4xl">
        比较费用，选择演示回收方
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-dim">
        预计实收 = 回收款 − 拖车费 − 服务费。金额按整数分计算，未知费用显示“待确认”，不会当成 0。
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Tag tone="warn">演示金额 仅用于比较交互</Tag>
        <Tag>资质：演示占位 未查询真实资质</Tag>
        {view.quotes[0] && <Tag>报价版本 v{view.quotes[0].version}</Tag>}
      </div>

      {snapshot?.policy.status === "unverified_city" && (
        <div className="mt-4">
          <Notice tone="warn" title="该市州本地规则待核实">
            {snapshot.policy.notes} 可继续基础模拟，但不会套用成都要求，也不承诺服务范围。
          </Notice>
        </div>
      )}

      {view.selectedStale && (
        <div className="mt-4">
          <Notice tone="warn" title="报价需要重新确认">
            车辆所在地或行驶状况变化后已生成新版本，旧报价保留为历史记录。请重新选择当前版本。
          </Notice>
        </div>
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {view.quotes.map((quote) => {
          const selected = view.selectedProviderId === quote.providerId && !view.selectedStale;
          return (
            <Panel key={quote.id} strong={selected} className={selected ? "border-rust/60" : ""}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="label">DEMO PROVIDER {quote.providerId.slice(-1)}</p>
                  <h2 className="mt-1 text-xl font-black">{quote.providerName}</h2>
                </div>
                {selected ? <Tag tone="acid">已选择 · v{quote.version}</Tag> : <Tag>演示</Tag>}
              </div>

              <p className="mt-2 text-xs text-dim">
                资质位：演示占位 未查询真实资质
              </p>

              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
                  <dt className="text-dim">车辆回收款</dt>
                  <dd className="mono tabular">
                    {quote.grossFen === null ? "待确认" : `¥${formatYuan(quote.grossFen)}`}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
                  <dt className="text-dim">拖车费</dt>
                  <dd className="mono tabular">
                    {quote.towFen === null ? (
                      <span className="text-warn">待确认</span>
                    ) : (
                      `−¥${formatYuan(quote.towFen)}`
                    )}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
                  <dt className="text-dim">服务费</dt>
                  <dd className="mono tabular">
                    {quote.serviceFen === null ? (
                      <span className="text-warn">待确认</span>
                    ) : (
                      `−¥${formatYuan(quote.serviceFen)}`
                    )}
                  </dd>
                </div>
              </dl>

              <div className="mt-4">
                <p className="label">预计实收</p>
                <Money fen={quote.netFen} size="lg" />
                {replace && (
                  <Link href="/subsidy" className="mt-2 block text-sm text-warn underline underline-offset-4">
                    补贴资格待核实 金额未计入 →
                  </Link>
                )}
              </div>

              <div className="mt-4 space-y-1 text-xs text-dim">
                <p>适用演示区域：{quote.conditions.area ?? "待确认"}</p>
                <p>拖运条件：{quote.conditions.tow ?? "待确认"}</p>
                <p>{quote.conditions.note ?? "演示报价，不代表真实行情。"}</p>
                {quote.conditions.versionNote && (
                  <p className="text-warn">{quote.conditions.versionNote}</p>
                )}
              </div>

              <button
                type="button"
                className={`btn-secondary mt-4 w-full ${selected ? "border-acid text-acid" : ""}`}
                disabled={busy !== null || quote.netFen === null}
                onClick={() => void select(quote.providerId)}
              >
                {selected
                  ? "当前已选择"
                  : busy === quote.providerId
                    ? "保存中…"
                    : quote.netFen === null
                      ? "费用待确认，暂不能选择"
                      : "选择此演示报价"}
              </button>
            </Panel>
          );
        })}
      </div>

      {view.quotes.length === 0 && (
        <Notice tone="warn" title="暂无报价">
          请先返回计划页确认车辆所在地与行驶状况，系统会重新生成演示报价。
        </Notice>
      )}

      <p aria-live="polite" className="mt-4 min-h-[2rem] text-sm text-acid">
        {message}
      </p>

      <Panel className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="label">下一步</p>
            <p className="mt-1 text-sm text-dim">
              选择报价后确认模拟预约。报价或材料需要重新确认时，不能用旧版本直接提交。
            </p>
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={!selectionValid}
            onClick={() => router.push("/appointment")}
          >
            下一步：确认模拟预约
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link href="/documents" className="link-rust">
            ← 返回材料
          </Link>
          {replace && (
            <Link href="/subsidy" className="link-rust">
              查看补贴待办
            </Link>
          )}
        </div>
      </Panel>
    </div>
  );
}