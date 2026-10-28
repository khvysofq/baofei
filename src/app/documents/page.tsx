"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCase } from "@/components/case-provider";
import {
  EmptyCase,
  Notice,
  Panel,
  Tag,
  TaskCard,
} from "@/components/ui";
import { api } from "@/lib/client";
import type { DocumentIssue, DocumentType } from "@/lib/types";

type DocumentView = {
  type: DocumentType;
  label: string;
  hint: string;
  sampleId: string | null;
  quality: "clear" | "blur" | "mismatch" | null;
  issues: DocumentIssue[];
  fields: Record<string, string> | null;
  originalFields: Record<string, string> | null;
  confirmed: boolean;
  verificationStatus: string;
  documentId: string | null;
};

type DocumentsView = {
  documents: DocumentView[];
  samples: { id: string; label: string }[];
  documentsStatus: string;
  missingTask: {
    id: string;
    status: string;
    reason: string | null;
    resolutionNote: string | null;
  } | null;
  materialsVersion: number;
  profileVersion: number;
};

const FIELD_LABELS: Record<string, string> = {
  plate: "号牌号码",
  vehicleNo: "演示车辆编号",
  owner: "所有人",
  regDate: "登记日期",
  vin: "车辆识别代号",
  useNature: "使用性质",
};

export default function DocumentsPage() {
  const router = useRouter();
  const { caseId, snapshot, refresh } = useCase();
  const [view, setView] = useState<DocumentsView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [manual, setManual] = useState<Record<string, string>>({});
  const [assistOpen, setAssistOpen] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");

  const load = useCallback(async () => {
    if (!caseId) return;
    try {
      const data = await api<DocumentsView>(
        `/api/documents?caseId=${encodeURIComponent(caseId)}`,
      );
      setView(data);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "材料加载失败");
    }
  }, [caseId]);

  useEffect(() => {
    // 页面数据通过 API 拉取，异步回调内更新状态。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const allConfirmed = useMemo(
    () => Boolean(view && view.documents.every((d) => d.confirmed)),
    [view],
  );

  async function act(key: string, fn: () => Promise<unknown>, success: string) {
    setBusy(key);
    setMessage(null);
    try {
      await fn();
      await load();
      await refresh();
      setMessage(success);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusy(null);
    }
  }

  async function pickSample(type: DocumentType, sampleId: string) {
    if (!caseId) return;
    await act(
      `${type}:${sampleId}`,
      () =>
        api("/api/documents/sample", {
          method: "POST",
          json: { caseId, type, sampleId },
        }),
      "已载入演示资料。请核对下方检查结果，展开或查看不视为确认。",
    );
  }

  async function confirm(type: DocumentType) {
    if (!caseId) return;
    await act(
      `${type}:confirm`,
      () =>
        api("/api/documents/confirm", {
          method: "POST",
          json: { caseId, type },
        }),
      "材料信息已确认。其他已确认材料保持不变。",
    );
  }

  async function resolveMismatch(
    type: DocumentType,
    action: "adopt_original" | "manual" | "assist",
  ) {
    if (!caseId) return;
    const manualValue = manual[type]?.trim();
    await act(
      `${type}:${action}`,
      () =>
        api("/api/documents/mismatch", {
          method: "POST",
          json: { caseId, type, action, manualValue },
        }),
      action === "assist"
        ? "已记录协助确认请求（演示），该材料仍未确认。"
        : "字段已修正，请再确认材料。",
    );
  }

  async function markMissing() {
    if (!caseId) return;
    await act(
      "missing",
      () => api("/api/documents/missing", { method: "POST", json: { caseId } }),
      "已记录登记证缺失并创建核对任务；仍可继续查看演示报价。",
    );
  }

  async function foundSample() {
    if (!caseId) return;
    await act(
      "found",
      async () => {
        await api("/api/case/fields", {
          method: "PATCH",
          json: { caseId, field: "documentsStatus", value: "complete" },
        });
        await api("/api/documents/sample", {
          method: "POST",
          json: { caseId, type: "REGISTRATION_CERT", sampleId: "DOC_CLEAR" },
        });
      },
      "已把登记证状态改为齐全并载入演示登记证；请核对并确认。",
    );
  }

  async function resolveMissingTask() {
    if (!caseId) return;
    if (!resolutionNote.trim()) {
      setMessage("请填写演示核对说明，不能把任务解决写成官方已批准。");
      return;
    }
    await act(
      "resolve-missing",
      () =>
        api("/api/tasks/resolve", {
          method: "POST",
          json: {
            caseId,
            kind: "review_missing_document",
            note: resolutionNote.trim(),
          },
        }),
      "核对任务已解决（演示）。说明已绑定当前资料版本与地区。",
    );
  }

  if (!caseId) return <EmptyCase />;
  if (!view) {
    return <p className="mono mt-6 text-sm text-dim">正在加载材料清单…</p>;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="hazard mb-5" aria-hidden />
      <p className="label text-rust">P3 · 材料预检</p>
      <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-4xl">
        按计划检查材料
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-dim">
        只列本次计划需要的材料。样例只能选择内置三份演示资料；模糊或字段不一致会定位到具体区域，修正后再确认。
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Tag tone="acid">材料版本 v{view.materialsVersion}</Tag>
        <Tag>资料编号 DEMO VEHICLE 01</Tag>
        {view.documentsStatus === "missing_registration" && (
          <Tag tone="warn">登记证缺失</Tag>
        )}
      </div>

      <div className="mt-5">
        <TaskCard
          task={
            snapshot?.nextAction
              ? snapshot.nextAction
              : null
          }
          stageNote={snapshot?.stageNote}
        />
      </div>

      <div className="mt-4 space-y-4">
        {view.documents.map((doc) => {
          const mismatch = doc.issues.filter((i) => i.kind === "mismatch");
          const blur = doc.issues.filter((i) => i.kind === "blur");
          const previewSrc = doc.documentId
            ? `/api/documents/${doc.documentId}/asset`
            : doc.sampleId
              ? `/api/documents/${doc.sampleId}/asset`
              : null;
          return (
            <Panel key={doc.type} strong={Boolean(mismatch.length || blur.length)}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="label">{doc.type}</p>
                  <h2 className="mt-1 text-xl font-black">{doc.label}</h2>
                  <p className="mt-1 text-sm text-dim">{doc.hint}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {doc.confirmed ? (
                    <Tag tone="acid">你已确认</Tag>
                  ) : doc.sampleId ? (
                    <Tag tone="rust">待确认</Tag>
                  ) : (
                    <Tag tone="warn">尚未提供</Tag>
                  )}
                  {doc.quality === "blur" && <Tag tone="warn">局部模糊</Tag>}
                  {mismatch.length > 0 && <Tag tone="danger">字段不一致</Tag>}
                </div>
              </div>

              {!doc.sampleId && (
                <div className="mt-4">
                  <p className="text-sm text-dim">选择一份内置演示资料：</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {view.samples.map((sample) => (
                      <button
                        key={sample.id}
                        type="button"
                        className="btn-secondary min-h-[44px]"
                        disabled={busy !== null}
                        onClick={() => void pickSample(doc.type, sample.id)}
                      >
                        {sample.label}
                      </button>
                    ))}
                  </div>
                  {doc.type === "REGISTRATION_CERT" && (
                    <button
                      type="button"
                      className="btn-secondary mt-3 min-h-[44px] border-warn/60 text-warn"
                      disabled={busy !== null}
                      onClick={() => void markMissing()}
                    >
                      登记证暂时找不到
                    </button>
                  )}
                </div>
              )}

              {doc.sampleId && (
                <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <figure>
                    {previewSrc && (
                      <Image
                        src={previewSrc}
                        alt={`${doc.label}的演示资料卡面`}
                        width={900}
                        height={560}
                        unoptimized
                        className="w-full border border-line bg-void"
                      />
                    )}
                    <figcaption className="mono mt-1 text-[11px] text-dim">
                      演示资料 · 不具法律效力 · 打开图片不改变确认状态
                    </figcaption>
                  </figure>

                  <div>
                    {blur.length > 0 && (
                      <Notice tone="warn" title="检查结果：局部不可读">
                        {blur.map((issue) =>
                          issue.kind === "blur" ? (
                            <p key={issue.region} className="mt-1">
                              {issue.region}：{issue.message}
                            </p>
                          ) : null,
                        )}
                      </Notice>
                    )}

                    {mismatch.length > 0 && (
                      <div className="space-y-2">
                        {mismatch.map((issue) =>
                          issue.kind === "mismatch" ? (
                            <Notice
                              key={issue.field}
                              tone="danger"
                              title={`字段不一致：${issue.fieldLabel}`}
                            >
                              <p className="mono text-xs">{issue.region}</p>
                              <div className="mt-2 grid grid-cols-2 gap-2">
                                <div className="border border-line bg-raise p-2">
                                  <p className="label">原件值</p>
                                  <p className="mono mt-1 text-text">{issue.original}</p>
                                </div>
                                <div className="border border-line bg-raise p-2">
                                  <p className="label">提取值</p>
                                  <p className="mono mt-1 text-danger">{issue.extracted}</p>
                                </div>
                              </div>
                              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  disabled={busy !== null}
                                  onClick={() =>
                                    void resolveMismatch(doc.type, "adopt_original")
                                  }
                                >
                                  采用原件值
                                </button>
                                <div className="flex flex-1 gap-2">
                                  <label className="sr-only" htmlFor={`manual-${doc.type}`}>
                                    手动修改登记日期
                                  </label>
                                  <input
                                    id={`manual-${doc.type}`}
                                    className="input"
                                    value={manual[doc.type] ?? ""}
                                    onChange={(e) =>
                                      setManual((prev) => ({
                                        ...prev,
                                        [doc.type]: e.target.value,
                                      }))
                                    }
                                    placeholder="输入正确值，例如 2014-03-18"
                                  />
                                  <button
                                    type="button"
                                    className="btn-secondary shrink-0"
                                    disabled={busy !== null}
                                    onClick={() => void resolveMismatch(doc.type, "manual")}
                                  >
                                    手动修改
                                  </button>
                                </div>
                              </div>
                              <button
                                type="button"
                                className="btn-secondary mt-2 min-h-[44px] w-full"
                                disabled={busy !== null}
                                onClick={() => setAssistOpen(doc.type)}
                              >
                                需要协助确认
                              </button>
                            </Notice>
                          ) : null,
                        )}
                      </div>
                    )}

                    {assistOpen === doc.type && (
                      <Notice tone="warn" title="需要协助确认（演示）">
                        这里只记录本地协助请求，不发送信息，也不会自动确认字段。
                        <button
                          type="button"
                          className="btn-secondary mt-2 w-full"
                          onClick={() => {
                            void resolveMismatch(doc.type, "assist");
                            setAssistOpen(null);
                          }}
                        >
                          记录协助请求
                        </button>
                      </Notice>
                    )}

                    <div className="mt-3 border border-line bg-raise p-3">
                      <p className="label">可读字段</p>
                      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                        {Object.entries(FIELD_LABELS).map(([key, label]) => (
                          <div key={key}>
                            <dt className="text-dim">{label}</dt>
                            <dd className="mono text-text">{doc.fields?.[key] ?? "—"}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>

                    {!doc.confirmed && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn-secondary min-h-[44px]"
                          disabled={busy !== null || mismatch.length > 0}
                          onClick={() => void confirm(doc.type)}
                        >
                          {blur.length > 0 ? "确认可读字段" : "确认材料信息"}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary min-h-[44px]"
                          disabled={busy !== null}
                          onClick={() =>
                            void pickSample(
                              doc.type,
                              view.samples.find((s) => s.label.includes("1"))?.id ??
                                view.samples[0].id,
                            )
                          }
                        >
                          更换为演示资料 1
                        </button>
                      </div>
                    )}
                    {mismatch.length > 0 && (
                      <p className="mt-2 text-xs text-warn">
                        字段不一致解决前不能确认；只展开详情不算确认。
                      </p>
                    )}
                  </div>
                </div>
              )}

              {doc.type === "REGISTRATION_CERT" &&
                view.documentsStatus === "missing_registration" && (
                  <div className="mt-4 border-t border-line pt-3">
                    <Notice tone="warn" title="核对任务：登记证缺失">
                      <p>
                        {view.missingTask?.status === "needs_reconfirmation"
                          ? "情况变化使之前的解决说明失效，需要重新确认。"
                          : view.missingTask?.resolutionNote
                            ? `已记录演示说明：${view.missingTask.resolutionNote}`
                            : "可继续查看报价，但确认预约前必须解决本任务。"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {!doc.sampleId && (
                          <button
                            type="button"
                            className="btn-secondary"
                            disabled={busy !== null}
                            onClick={() => void foundSample()}
                          >
                            找到示例登记证
                          </button>
                        )}
                      </div>
                      <label htmlFor="resolution-note" className="label mt-3 block">
                        演示核对说明（必填）
                      </label>
                      <textarea
                        id="resolution-note"
                        className="input mt-1 min-h-[72px]"
                        value={resolutionNote}
                        onChange={(e) => setResolutionNote(e.target.value)}
                        placeholder="例如：已演示核对拟办理地接受情况说明，仍需以受理渠道为准。"
                      />
                      <button
                        type="button"
                        className="btn-secondary mt-2"
                        disabled={busy !== null}
                        onClick={() => void resolveMissingTask()}
                      >
                        示例核对任务已解决
                      </button>
                    </Notice>
                  </div>
                )}

              {doc.confirmed && (
                <p className="mt-3 text-sm text-acid">
                  已确认的字段会在修改其他材料时保留；只对该材料重新要求确认。
                </p>
              )}
            </Panel>
          );
        })}
      </div>

      <p aria-live="polite" className="mt-4 min-h-[2rem] text-sm text-acid">
        {message}
      </p>

      <Panel className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="label">下一步</p>
            <p className="mt-1 text-sm text-dim">
              {allConfirmed
                ? "材料已全部确认，可以比较演示报价。"
                : "材料尚未全部确认；可先查看报价，但确认预约前需要完成材料核对。"}
            </p>
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={() => router.push("/quotes")}
          >
            查看演示报价
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link href="/plan" className="link-rust">
            ← 返回计划修改情况
          </Link>
          <Link href="/appointment" className="link-rust">
            直接去预约（会先检查核对任务）
          </Link>
        </div>
      </Panel>
    </div>
  );
}