"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useCase } from "@/components/case-provider";
import {
  EmptyCase,
  Notice,
  Panel,
  SectionTitle,
  Tag,
} from "@/components/ui";
import { api } from "@/lib/client";
import { PROVINCES, SICHUAN_CITIES } from "@/lib/domain/regions";
import type { RegionValue, SubsidyContext } from "@/lib/types";

type SubsidyView = {
  enabled: boolean;
  context: SubsidyContext | null;
  policyYear: number;
  acceptingCity: string | null;
  acceptingBasis: string;
  missing: string[];
  warnings: string[];
  statusLabel: string;
  windowStatusLabel: string;
  materials: { id: string; label: string }[];
  stages: { id: string; label: string }[];
  sources: string[];
  note: string;
};

const SOURCE_LINKS = [
  { id: "S4", label: "2026 年汽车以旧换新补贴实施细则（商务部）", href: "https://www.mofcom.gov.cn/zcfg/art/2025/art_c5ba34448a2a4eea83b1d0b89b699807.html" },
  { id: "S5", label: "四川省 2026 年汽车以旧换新补贴实施细则", href: "https://www.nanchong.gov.cn/sswj/zwxx/zcwj/xzgfxwj/202603/t20260324_2321144.html" },
  { id: "S7", label: "全国汽车流通信息管理系统（官方入口）", href: "https://qclt.mofcom.gov.cn/" },
];

export default function SubsidyPage() {
  const { caseId, snapshot, refresh } = useCase();
  const [view, setView] = useState<SubsidyView | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [form, setForm] = useState({
    purchaseStage: "not_bought",
    plannedProvince: "四川",
    plannedCity: "",
    invoiceProvince: "四川",
    invoiceCity: "",
    newRegistrationProvince: "",
    materials: [] as string[],
  });

  const load = useCallback(async () => {
    if (!caseId) return;
    try {
      const data = await api<SubsidyView>(
        `/api/subsidy?caseId=${encodeURIComponent(caseId)}`,
      );
      setView(data);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "补贴待办加载失败");
    }
  }, [caseId]);

  useEffect(() => {
    // 页面数据通过 API 拉取，异步回调内更新状态。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    if (!view || initialized) return;
    const ctx = view.context;
    const planned = ctx?.plannedPurchaseRegion as RegionValue | null;
    const invoice = ctx?.invoiceRegion as RegionValue | null;
    // 首次拿到服务端数据后初始化本地表单。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      purchaseStage: ctx?.purchaseStage ?? "not_bought",
      plannedProvince: planned?.province ?? "四川",
      plannedCity: planned?.city ?? "",
      invoiceProvince: invoice?.province ?? "四川",
      invoiceCity: invoice?.city ?? "",
      newRegistrationProvince: ctx?.newRegistrationProvince ?? "",
      materials: ctx?.materials ?? [],
    });
    setInitialized(true);
  }, [view, initialized]);

  async function save() {
    if (!caseId) return;
    setBusy(true);
    setMessage(null);
    try {
      await api("/api/subsidy", {
        method: "POST",
        json: {
          caseId,
          purchaseStage: form.purchaseStage,
          plannedPurchaseRegion: form.plannedProvince
            ? { province: form.plannedProvince, city: form.plannedCity || null }
            : null,
          invoiceRegion: form.invoiceProvince
            ? { province: form.invoiceProvince, city: form.invoiceCity || null }
            : null,
          newRegistrationProvince: form.newRegistrationProvince || null,
          materials: form.materials,
        },
      });
      await load();
      await refresh();
      setMessage("已保存补贴待办。资格仍为待核实，未计算金额。");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  function toggleMaterial(id: string) {
    setForm((f) => ({
      ...f,
      materials: f.materials.includes(id)
        ? f.materials.filter((m) => m !== id)
        : [...f.materials, id],
    }));
  }

  if (!caseId) return <EmptyCase />;
  if (!view) {
    return <p className="mono mt-6 text-sm text-dim">正在加载补贴待办…</p>;
  }

  const intent = snapshot?.case.intent;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="hazard mb-5" aria-hidden />
      <p className="label text-rust">P7 · 补贴待办</p>
      <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-4xl">
        换新补贴：先核对，不承诺
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-dim">
        补贴与回收净额完全独立。本服务只给出“资格待核实”和缺项清单，不计算补贴金额，也不给出通过结论。
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Tag tone="warn">资格待核实</Tag>
        <Tag>政策年度 {view.policyYear}</Tag>
        <Tag>规则版本 V1.1</Tag>
        <Tag tone="acid">核对日期 2026-10-28</Tag>
      </div>

      {!view.enabled ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
          <Panel className="lg:col-span-2">
            <Notice tone="warn" title="当前办理目标不是换新">
              {intent === "scrap"
                ? "当前为仅报废，补贴待办已暂停并保留已有内容；切回换新后可继续填写与保存。"
                : "请先在计划页确认办理目标；确认换新后，这里才会开放补贴核对。"}
            </Notice>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link href="/plan" className="btn-primary inline-flex">
                回计划页调整目标
              </Link>
              <Link href="/case" className="link-rust text-sm">
                ← 返回办理
              </Link>
            </div>
            <p className="mt-4 text-sm text-dim">
              补贴状态与回收净额独立：暂停补贴待办不影响已选的回收报价与预计实收。
            </p>
          </Panel>
          <p aria-live="polite" className="min-h-[2rem] text-sm text-acid lg:col-span-2">
            {message}
          </p>
        </div>
      ) : (
      <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <Panel>
          <SectionTitle aside={<Tag tone="rust">只保存计划与核对信息</Tag>}>
            补贴核对信息
          </SectionTitle>

          <fieldset disabled={!view.enabled}>
            <legend className="label mb-2">新车购买阶段</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {view.stages.map((stage) => (
                <button
                  key={stage.id}
                  type="button"
                  aria-pressed={form.purchaseStage === stage.id}
                  className={`btn-secondary min-h-[52px] ${form.purchaseStage === stage.id ? "border-rust text-rust" : ""}`}
                  onClick={() =>
                    setForm((f) => ({ ...f, purchaseStage: stage.id }))
                  }
                >
                  {stage.label}
                </button>
              ))}
            </div>

            <div className="mt-4">
              <span className="label block">计划购车地区（未取得票证时只作计划值）</span>
              <div className="mt-1 grid gap-2 sm:grid-cols-2">
                <select
                  aria-label="计划购车省份"
                  className="input"
                  value={form.plannedProvince}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      plannedProvince: e.target.value,
                      plannedCity: "",
                    }))
                  }
                >
                  <option value="">不清楚</option>
                  {PROVINCES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="计划购车市州"
                  className="input"
                  value={form.plannedCity}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, plannedCity: e.target.value }))
                  }
                  disabled={form.plannedProvince !== "四川"}
                >
                  <option value="">市州待确认</option>
                  {form.plannedProvince === "四川" &&
                    SICHUAN_CITIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <span className="label block">新车发票开具地区（受理市州按发票市州确定）</span>
              <div className="mt-1 grid gap-2 sm:grid-cols-2">
                <select
                  aria-label="发票开具省份"
                  className="input"
                  value={form.invoiceProvince}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      invoiceProvince: e.target.value,
                      invoiceCity: "",
                    }))
                  }
                >
                  <option value="">不清楚</option>
                  {PROVINCES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="发票开具市州"
                  className="input"
                  value={form.invoiceCity}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, invoiceCity: e.target.value }))
                  }
                  disabled={form.invoiceProvince !== "四川"}
                >
                  <option value="">市州待确认</option>
                  {form.invoiceProvince === "四川" &&
                    SICHUAN_CITIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                </select>
              </div>
              <p className="mt-1 text-xs text-dim">
                未取得发票时保留为计划值，不能当作已确认事实。
              </p>
            </div>

            <div className="mt-4">
              <label htmlFor="new-registration" className="label block">
                新车登记省份
              </label>
              <select
                id="new-registration"
                className="input mt-1"
                value={form.newRegistrationProvince}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    newRegistrationProvince: e.target.value,
                  }))
                }
              >
                <option value="">不清楚</option>
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <fieldset className="mt-4">
              <legend className="label mb-2">已有材料类别</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {view.materials.map((material) => (
                  <label
                    key={material.id}
                    className="flex min-h-[44px] cursor-pointer items-center gap-2 border border-line bg-raise px-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--color-rust)]"
                      checked={form.materials.includes(material.id)}
                      onChange={() => toggleMaterial(material.id)}
                    />
                    {material.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <button
              type="button"
              className="btn-primary mt-5 w-full"
              disabled={busy || !view.enabled}
              onClick={() => void save()}
            >
              {busy ? "保存中…" : "保存补贴待办"}
            </button>
          </fieldset>
        </Panel>

        <div className="space-y-4">
          <Panel strong>
            <SectionTitle aside={<Tag tone="warn">无资格结论</Tag>}>
              核对结果
            </SectionTitle>
            <p className="text-lg font-black text-warn">{view.statusLabel}</p>
            <p className="mt-1 text-sm text-dim">{view.note}</p>

            <div className="mt-3 border-t border-line pt-3">
              <p className="label">受理市州（推导）</p>
              <p className="font-bold">{view.acceptingCity ?? "待确认"}</p>
              <p className="text-xs text-dim">{view.acceptingBasis}</p>
            </div>

            <div className="mt-3 border-t border-line pt-3">
              <p className="label">缺项清单</p>
              {view.missing.length === 0 ? (
                <p className="mt-1 text-sm text-dim">
                  当前信息已齐，但仍需通过官方渠道核实，不表示资格通过。
                </p>
              ) : (
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                  {view.missing.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </div>

            {view.warnings.length > 0 && (
              <div className="mt-3">
                <Notice tone="warn" title="需要注意">
                  <ul className="list-disc pl-5">
                    {view.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </Notice>
              </div>
            )}

            <div className="mt-3 border-t border-line pt-3 text-sm">
              <p className="label">申请开放情况</p>
              <p className="text-warn">{view.windowStatusLabel}</p>
              <p className="mt-1 text-xs text-dim">
                不显示未经核实的剩余额度、倒计时或保证到账时间。
              </p>
            </div>

            <div className="mt-3 border-t border-line pt-3">
              <p className="label">政策来源</p>
              <ul className="mt-1 space-y-1 text-sm">
                {SOURCE_LINKS.filter((s) => view.sources.includes(s.id)).map((s) => (
                  <li key={s.id}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="link-rust"
                    >
                      [{s.id}] {s.label} ↗
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-dim">
                打开官方资料只记录“查看资料”，不改变补贴状态，也不代表已提交申请。
              </p>
            </div>
          </Panel>

          <p aria-live="polite" className="min-h-[2rem] text-sm text-acid">
            {message}
          </p>

          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/case" className="link-rust">
              ← 返回办理
            </Link>
            <Link href="/quotes" className="link-rust">
              查看回收净额
            </Link>
            <Link href="/plan" className="link-rust">
              切换仅报废 / 换新
            </Link>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}