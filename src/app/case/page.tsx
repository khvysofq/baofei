"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useCase } from "@/components/case-provider";
import {
  EmptyCase,
  Notice,
  Panel,
  SectionTitle,
  StatusBlock,
  Tag,
  TASK_HREF,
} from "@/components/ui";
import { api } from "@/lib/client";
import { TASK_META } from "@/lib/domain/tasks";
import type { EvidenceRecord, TrackState } from "@/lib/types";

const EVIDENCE_LABELS: Record<string, string> = {
  HANDOVER_RECEIPT: "交接回执",
  RECOVERY_CERTIFICATE: "回收证明",
  DEREGISTRATION_CERTIFICATE: "注销证明",
};

const EVIDENCE_STATUS: Record<string, string> = {
  provided: "已提供 待核验",
  pending_check: "已提供 待核验",
  demo_verified: "已核验",
  rejected: "核对未通过",
};

const SOURCE_LABELS: Record<string, string> = {
  user: "用户操作",
  rule: "规则生成",
  demo_controller: "内部调试",
  system: "系统",
};

const HELP_KINDS = [
  { id: "mortgage", label: "抵押或状态不明" },
  { id: "battery", label: "新能源电池情况不明" },
  { id: "cross_region", label: "省外或跨省登记" },
  { id: "non_supported", label: "非支持车型或复杂情形" },
];

type HelpCard = {
  kind: string;
  kindLabel: string;
  confirmedFacts: string[];
  vehicleRegion: string;
  registrationRegion: string;
  subsidyRegions: string;
  questions: string[];
  materials: string[];
  channel: string;
  blockingTask: string;
  note: string;
};

function formatTime(iso: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function trackEvidence(track: TrackState, evidence: EvidenceRecord[]): EvidenceRecord[] {
  if (track.key === "recovery") {
    return evidence.filter((e) =>
      ["HANDOVER_RECEIPT", "RECOVERY_CERTIFICATE"].includes(e.type),
    );
  }
  if (track.key === "deregistration") {
    return evidence.filter((e) => e.type === "DEREGISTRATION_CERTIFICATE");
  }
  return [];
}

export default function CasePage() {
  const { caseId, snapshot, loading, error, refresh } = useCase();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [helpCard, setHelpCard] = useState<HelpCard | null>(null);
  const [helpNote, setHelpNote] = useState("");

  const settlement = snapshot?.tracks.find((t) => t.key === "settlement");
  const unsupportedTask = snapshot?.tasks.find(
    (t) => t.kind === "unsupported_case" && t.active,
  );

  const nextHref = useMemo(() => {
    if (!snapshot?.nextAction) return null;
    return TASK_HREF[snapshot.nextAction.kind];
  }, [snapshot]);

  async function act(key: string, fn: () => Promise<unknown>, success: string) {
    setBusy(key);
    setMessage(null);
    try {
      await fn();
      await refresh();
      setMessage(success);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusy(null);
    }
  }

  async function provideDeregSample() {
    if (!caseId || !snapshot) return;
    await act(
      "dereg-provide",
      () =>
        api("/api/evidence", {
          method: "POST",
          json: {
            caseId,
            vehicleId: snapshot.vehicle.id,
            type: "DEREGISTRATION_CERTIFICATE",
            status: "provided",
            description: "用户提供的注销证明样例，等待核验。",
          },
        }),
      "已提供注销证明，状态为“已提供 待核验”，不会自动完成注销。",
    );
  }

  async function confirmPayment() {
    if (!caseId) return;
    await act(
      "payment",
      () => api("/api/payment/confirm", { method: "POST", json: { caseId } }),
      "已由你显式确认回收款到账。",
    );
  }

  async function openHelp(kind: string) {
    if (!caseId) return;
    await act(
      `help:${kind}`,
      async () => {
        const card = await api<HelpCard>("/api/help", {
          method: "POST",
          json: { caseId, kind, record: true },
        });
        setHelpCard(card);
      },
      "已生成并记录本地交接卡；不发送任何信息。",
    );
  }

  async function resolveSpecial() {
    if (!caseId) return;
    if (!helpNote.trim()) {
      setMessage("请填写核对说明。");
      return;
    }
    await act(
      "resolve-special",
      () =>
        api("/api/tasks/resolve", {
          method: "POST",
          json: {
            caseId,
            kind: "unsupported_case",
            note: helpNote.trim(),
          },
        }),
      "特殊情形核对任务已解除（核对说明，不代表官方批准）。",
    );
  }

  if (!caseId) return <EmptyCase />;
  if (loading && !snapshot) {
    return <p className="mono mt-6 text-sm text-dim">正在加载办理状态…</p>;
  }
  if (error || !snapshot) {
    return (
      <div className="mt-6">
        <Notice tone="danger" title="案件加载失败">
          {error ?? "未找到案件"}
        </Notice>
        <Link href="/start" className="btn-secondary mt-4 inline-flex">
          回到开始页
        </Link>
      </div>
    );
  }

  const vehicle = snapshot.fields.find((f) => f.field === "vehicleLocation")?.value as
    | { province?: string | null; city?: string | null }
    | null;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="hazard mb-5" aria-hidden />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label text-rust">P6 · 我的办理</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-4xl">
            现在需要做
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Tag>{vehicle?.city ? `${vehicle.province ?? ""}·${vehicle.city}` : "地区待确认"}</Tag>
          <Tag tone="acid">办理记录留档</Tag>
        </div>
      </div>

      <Panel className="mt-4" strong>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="label">当前主要任务</p>
            <p className="mt-1 text-xl font-black">
              {snapshot.nextAction ? TASK_META[snapshot.nextAction.kind].title : "没有阻塞任务"}
            </p>
            <p className="mt-1 text-sm text-dim">
              负责角色：{snapshot.nextAction?.owner ?? "—"} · 更新时间：
              {formatTime(snapshot.case.updatedAt)}
            </p>
            <p className="mt-2 text-sm text-dim">{snapshot.stageNote}</p>
          </div>
          {nextHref && (
            <Link href={nextHref} className="btn-primary">
              处理当前任务
            </Link>
          )}
        </div>
      </Panel>

      <div className="mt-4 flex flex-wrap gap-2">
        <Tag>案件 {snapshot.case.caseNo}</Tag>
        <Tag>{snapshot.vehicle.demoVehicleNo}</Tag>
        <Tag>资料版本 v{snapshot.case.materialsVersion}</Tag>
        <Tag>
          {snapshot.policy.statusLabel} · 核对日期 {snapshot.policy.checkedAt || "待确认"}
        </Tag>
      </div>

      <section className="mt-6">
        <SectionTitle aside={<span className="text-xs text-dim">四条业务线相互独立</span>}>
          办理状态
        </SectionTitle>
        <div className="grid gap-3 md:grid-cols-2">
          {snapshot.tracks.map((track) => (
            <StatusBlock key={track.key} track={track}>
              {track.key === "deregistration" && (
                <div className="mt-3 border-t border-line pt-3">
                  {track.status === "not_started" || track.status === "awaiting_materials" ? (
                    <button
                      type="button"
                      className="btn-secondary min-h-[44px]"
                      disabled={busy !== null}
                      onClick={() => void provideDeregSample()}
                    >
                      提供注销证明（待核验）
                    </button>
                  ) : track.status === "pending_check" ? (
                    <p className="text-sm text-warn">
                      注销证明已提供，等待核验；仅提供文件不会完成注销。
                    </p>
                  ) : (
                    <p className="text-sm text-acid">
                      注销已完成核验；仍需单独确认回收款到账。
                    </p>
                  )}
                </div>
              )}

              {track.key === "settlement" && (
                <div className="mt-3 border-t border-line pt-3">
                  {settlement?.status === "confirmed" ? (
                    <p className="text-sm text-acid">你已显式确认到账。</p>
                  ) : snapshot.case.handedOverAt ? (
                    <button
                      type="button"
                      className="btn-secondary min-h-[44px]"
                      disabled={busy !== null}
                      onClick={() => void confirmPayment()}
                    >
                      确认我已收到回收款
                    </button>
                  ) : (
                    <p className="text-sm text-dim">
                      交接后才能由你确认到账；企业付款反馈也不会自动推进。
                    </p>
                  )}
                </div>
              )}

              {track.key === "subsidy" && snapshot.case.intent === "replace" && (
                <Link href="/subsidy" className="link-rust mt-3 inline-block text-sm">
                  查看补贴待办 →
                </Link>
              )}

              <details className="mt-3">
                <summary className="min-h-[44px] cursor-pointer text-sm text-dim">
                  查看依据与下一步
                </summary>
                <div className="mt-2 space-y-2 text-sm">
                  <p>{track.basis}</p>
                  <p className="text-dim">{track.next}</p>
                  {trackEvidence(track, snapshot.evidence).map((e) => (
                    <div key={e.id} className="border border-line bg-raise p-2">
                      <p className="font-semibold">
                        {EVIDENCE_LABELS[e.type] ?? e.type} ·{" "}
                        {EVIDENCE_STATUS[e.status] ?? e.status}
                      </p>
                      <p className="mono mt-1 text-xs text-dim">
                        来源 {SOURCE_LABELS[e.source] ?? e.source} · 事件时间{" "}
                        {formatTime(e.eventTime)}
                      </p>
                      {e.description && (
                        <p className="mt-1 text-xs text-dim">{e.description}</p>
                      )}
                    </div>
                  ))}
                  {trackEvidence(track, snapshot.evidence).length === 0 && (
                    <p className="text-dim">暂无可核对的凭证。</p>
                  )}
                </div>
              </details>
            </StatusBlock>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <SectionTitle aside={<Tag tone="warn">凭证</Tag>}>凭证详情</SectionTitle>
        {snapshot.evidence.length === 0 ? (
          <Panel>
            <p className="text-sm text-dim">
              还没有凭证。交车、回收证明、注销证明与到账分别由显式事件记录。
            </p>
          </Panel>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {snapshot.evidence.map((e) => (
              <Panel key={e.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="label">凭证类型</p>
                    <p className="mt-1 font-black">{EVIDENCE_LABELS[e.type] ?? e.type}</p>
                  </div>
                  <Tag tone={e.status === "demo_verified" ? "acid" : "warn"}>
                    {EVIDENCE_STATUS[e.status] ?? e.status}
                  </Tag>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  <div>
                    <dt className="label">对应案件</dt>
                    <dd className="mono">{snapshot.case.caseNo}</dd>
                  </div>
                  <div>
                    <dt className="label">车辆编号</dt>
                    <dd className="mono">{snapshot.vehicle.demoVehicleNo}</dd>
                  </div>
                  <div>
                    <dt className="label">来源</dt>
                    <dd>{SOURCE_LABELS[e.source] ?? e.source}</dd>
                  </div>
                  <div>
                    <dt className="label">事件时间</dt>
                    <dd className="mono">{formatTime(e.eventTime)}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="label">核验状态</dt>
                    <dd>{EVIDENCE_STATUS[e.status] ?? e.status}</dd>
                  </div>
                </dl>
                {e.description && <p className="mt-2 text-xs text-dim">{e.description}</p>}
                <p className="mt-2 text-xs text-dim">
                  凭证绑定 caseId + vehicleId，跨案引用会被拒绝。
                </p>
              </Panel>
            ))}
          </div>
        )}
      </section>

      <section id="help" className="mt-6 scroll-mt-16">
        <SectionTitle aside={<Tag tone="rust">本地交接卡</Tag>}>
          特殊情况与人工协助
        </SectionTitle>
        <Panel>
          <p className="text-sm text-dim">
            选择一种情况生成带上下文的本地交接卡。默认不发送任何信息；生成“协助记录”只建立本地事件，不代表人工客服已响应。
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {HELP_KINDS.map((kind) => (
              <button
                key={kind.id}
                type="button"
                className="btn-secondary min-h-[44px] justify-start"
                disabled={busy !== null}
                onClick={() => void openHelp(kind.id)}
              >
                {busy === `help:${kind.id}` ? "生成中…" : kind.label}
              </button>
            ))}
          </div>

          {helpCard && (
            <div className="mt-4 border border-line-strong bg-raise p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-black">交接卡 · {helpCard.kindLabel}</h3>
                <Tag tone="warn">本地记录 · 不发送</Tag>
              </div>
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="label">已确认情况</dt>
                  <dd>{helpCard.confirmedFacts.join("；")}</dd>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <dt className="label">车辆所在地</dt>
                    <dd>{helpCard.vehicleRegion}</dd>
                  </div>
                  <div>
                    <dt className="label">登记地</dt>
                    <dd>{helpCard.registrationRegion}</dd>
                  </div>
                </div>
                <div>
                  <dt className="label">补贴相关地区</dt>
                  <dd>{helpCard.subsidyRegions}</dd>
                </div>
                <div>
                  <dt className="label">待核实问题</dt>
                  <dd>
                    <ul className="list-disc pl-5">
                      {helpCard.questions.map((q) => (
                        <li key={q}>{q}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
                <div>
                  <dt className="label">现有材料</dt>
                  <dd>{helpCard.materials.join("、")}</dd>
                </div>
                <div>
                  <dt className="label">建议渠道</dt>
                  <dd>{helpCard.channel}（未核实的具体联系方式留空）</dd>
                </div>
                <div>
                  <dt className="label">当前阻塞</dt>
                  <dd>{helpCard.blockingTask}</dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-warn">{helpCard.note}</p>
            </div>
          )}

          {unsupportedTask && (
            <div className="mt-4 border-t border-line pt-3">
              <Notice tone="warn" title="特殊情形阻断任务">
                常规办理判定已暂停。解决时必须写明核对说明，不能写成官方已批准。
              </Notice>
              <label htmlFor="help-resolution" className="label mt-2 block">
                核对说明
              </label>
              <textarea
                id="help-resolution"
                className="input mt-1 min-h-[72px]"
                value={helpNote}
                onChange={(e) => setHelpNote(e.target.value)}
                placeholder="例如：已核对抵押状态与权属问题，仍需线下渠道确认。"
              />
              <button
                type="button"
                className="btn-secondary mt-2"
                disabled={busy !== null}
                onClick={() => void resolveSpecial()}
              >
                记录核对说明并解除阻断
              </button>
            </div>
          )}
        </Panel>
      </section>

      <p aria-live="polite" className="mt-4 min-h-[2rem] text-sm text-acid">
        {message}
      </p>

      <div className="mt-2 flex flex-wrap gap-3 text-sm">
        <Link href="/appointment" className="link-rust">
          预约与交接
        </Link>
        <Link href="/subsidy" className="link-rust">
          补贴待办
        </Link>
        <Link href="/documents" className="link-rust">
          材料
        </Link>
      </div>

      <p className="mono mt-6 text-[11px] leading-relaxed text-dim">
        时间流逝、页面刷新或加载完成都不会生成完成事件。任何“完成”都来自上面可展开的显式事件与凭证。
      </p>
    </div>
  );
}