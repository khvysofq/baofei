"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCase } from "@/components/case-provider";
import {
  EmptyCase,
  FieldValueText,
  Notice,
  Panel,
  SectionTitle,
  Tag,
  TaskCard,
} from "@/components/ui";
import { api } from "@/lib/client";
import { PROVINCES, SICHUAN_CITIES } from "@/lib/domain/regions";
import type { CaseField, CoreFieldName, FieldValue, RegionValue } from "@/lib/types";

const FIELD_LABELS: Record<CoreFieldName, string> = {
  vehicleLocation: "车辆当前所在地",
  registrationLocation: "车辆登记地",
  ownerRelation: "由谁办理",
  drivable: "车辆能否行驶",
  intent: "办理目标",
  documentsStatus: "证件概况",
};

const FIELD_HINTS: Record<CoreFieldName, string> = {
  vehicleLocation: "判断服务地点、拖运条件与办理地核对。",
  registrationLocation: "单独保存，不从所在地自动复制。",
  ownerRelation: "家人代办会增加授权核对任务。",
  drivable: "开不动会增加拖运条件核对；费用未知时不会按 0 计算。",
  intent: "换新只开关补贴待办，不改变回收净额。",
  documentsStatus: "缺证会创建核对任务，仍可先看报价。",
};

const CORE_FIELDS: CoreFieldName[] = [
  "vehicleLocation",
  "registrationLocation",
  "ownerRelation",
  "drivable",
  "intent",
  "documentsStatus",
];

type Conflict = {
  field: CoreFieldName;
  kept: FieldValue;
  candidate: FieldValue;
  message: string;
};

function sourceLabel(field: CaseField | undefined): string {
  if (!field) return "尚未说明";
  if (field.confirmed) return "你已确认";
  if (field.source === "text") return "从描述中提取";
  if (field.source === "user") return "你填写";
  return "尚未确认";
}

function regionOf(value: FieldValue): RegionValue {
  if (value && typeof value === "object") return value as RegionValue;
  return { province: null, city: null };
}

function FieldShell({
  field,
  current,
  children,
  busy,
}: {
  field: CoreFieldName;
  current: CaseField | undefined;
  children: React.ReactNode;
  busy: boolean;
}) {
  return (
    <div className="border-t border-line py-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold">{FIELD_LABELS[field]}</p>
          <p className="mt-0.5 text-xs text-dim">{FIELD_HINTS[field]}</p>
        </div>
        <span
          className={`tag ${
            current?.confirmed
              ? "text-acid border-acid/40"
              : current?.value == null
                ? "text-warn border-warn/40"
                : "text-rust border-rust/40"
          }`}
        >
          {sourceLabel(current)}
        </span>
      </div>
      <div className={`mt-3 ${busy ? "opacity-60" : ""}`}>{children}</div>
    </div>
  );
}

function RegionSelect({
  value,
  onChange,
  idPrefix,
}: {
  value: FieldValue;
  onChange: (region: RegionValue) => void;
  idPrefix: string;
}) {
  const region = regionOf(value);
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="block text-sm">
        <span className="label mb-1 block">省份</span>
        <select
          id={`${idPrefix}-province`}
          className="input"
          value={region.province ?? ""}
          onChange={(e) => {
            const province = e.target.value || null;
            onChange({
              province,
              city:
                province === "四川" || province === "重庆" || province === "北京" || province === "上海" || province === "天津"
                  ? region.city
                  : null,
            });
          }}
        >
          <option value="">不清楚</option>
          {PROVINCES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="label mb-1 block">
          {region.province === "四川" ? "市（州）" : "城市"}
        </span>
        <select
          id={`${idPrefix}-city`}
          className="input"
          value={region.city ?? ""}
          onChange={(e) => {
            const city = e.target.value || null;
            onChange({
              province: city ? (region.province ?? "四川") : region.province,
              city,
            });
          }}
          disabled={!region.province}
        >
          <option value="">{region.province === "四川" ? "市州待确认" : "不清楚"}</option>
          {region.province === "四川" &&
            SICHUAN_CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          {["重庆", "北京", "上海", "天津"].includes(region.province ?? "") && (
            <option value={region.province ?? ""}>{region.province}</option>
          )}
        </select>
      </label>
    </div>
  );
}

export default function PlanPage() {
  const router = useRouter();
  const { snapshot, loading, error, caseId, refresh } = useCase();
  const [busyField, setBusyField] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [extra, setExtra] = useState("");
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [parsing, setParsing] = useState(false);

  const fields = useMemo(() => {
    const map = new Map<CoreFieldName, CaseField>();
    snapshot?.fields.forEach((f) => {
      if (CORE_FIELDS.includes(f.field as CoreFieldName)) {
        map.set(f.field as CoreFieldName, f);
      }
    });
    return map;
  }, [snapshot]);

  const unknownCount = CORE_FIELDS.filter((f) => fields.get(f)?.value == null).length;
  const subsidyActive = snapshot?.case.intent === "replace";

  async function update(field: CoreFieldName, value: FieldValue) {
    if (!caseId) return;
    setBusyField(field);
    setMessage(null);
    try {
      await api(`/api/case/fields`, {
        method: "PATCH",
        json: { caseId, field, value },
      });
      await refresh();
      setMessage("已更新，任务与下一步已重新计算。");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "更新失败");
    } finally {
      setBusyField(null);
    }
  }

  async function confirmAndContinue() {
    if (!caseId) return;
    setConfirming(true);
    setMessage(null);
    try {
      await api("/api/case/confirm", { method: "POST", json: { caseId } });
      await refresh();
      router.push("/documents");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "确认失败");
    } finally {
      setConfirming(false);
    }
  }

  async function reparse() {
    if (!caseId || !extra.trim()) return;
    setParsing(true);
    setMessage(null);
    try {
      const parsed = await api<{
        fields: Record<CoreFieldName, { value: FieldValue; confirmed: boolean }>;
        conflicts: Conflict[];
        degraded: boolean;
      }>("/api/intake/parse", {
        method: "POST",
        json: { text: extra, caseId },
      });
      setConflicts(parsed.conflicts);
      if (parsed.conflicts.length === 0) {
        setMessage(
          parsed.degraded
            ? "没有识别到新的可确认信息。已确认字段保持不变。"
            : "新描述与已确认字段没有冲突；如需修改，请直接在字段卡中选择。",
        );
      }
      setExtra("");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "解析失败，可直接用选项继续。");
    } finally {
      setParsing(false);
    }
  }

  if (!caseId) return <EmptyCase />;
  if (loading && !snapshot) {
    return <p className="mono mt-6 text-sm text-dim">正在加载案件…</p>;
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

  return (
    <div className="mx-auto max-w-4xl">
      <div className="hazard mb-5" aria-hidden />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label text-rust">P2 · 我的办理计划</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-4xl">
            确认情况，生成下一步
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Tag tone="rust">常见情况</Tag>
          {subsidyActive && <Tag tone="acid">补贴待办</Tag>}
        </div>
      </div>

      <p className="mt-3 max-w-2xl text-sm text-dim">
        字段卡显示信息来源。改动任一值会立即重算任务与下一步；unknown 不会被自动补成成都。
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <TaskCard task={snapshot.nextAction} stageNote={snapshot.stageNote} action />

          <Panel className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="label">确认后进入材料预检</p>
                <p className="mt-1 text-sm text-dim">
                  只需确认一次；下一步只列本次计划需要的材料。
                </p>
              </div>
              <button
                type="button"
                className="btn-primary w-full sm:w-auto"
                onClick={() => void confirmAndContinue()}
                disabled={confirming}
              >
                {confirming ? "保存中…" : "确认情况 · 检查材料"}
              </button>
            </div>
          </Panel>

          <Panel className="mt-4">
            <SectionTitle aside={<span className="mono text-xs text-dim">{unknownCount > 0 ? `${unknownCount} 项待说明` : "已识别 6 项"}</span>}>
              已识别情况
            </SectionTitle>

            {CORE_FIELDS.map((field) => {
              const current = fields.get(field);
              const value = current?.value ?? null;
              const busy = busyField === field;
              return (
                <FieldShell key={field} field={field} current={current} busy={busy}>
                  {field === "vehicleLocation" || field === "registrationLocation" ? (
                    <RegionSelect
                      value={value}
                      onChange={(region) => void update(field, region)}
                      idPrefix={field}
                    />
                  ) : null}

                  {field === "ownerRelation" && (
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: "self", label: "车主本人" },
                        { value: "family", label: "家人或他人协助" },
                        { value: null, label: "不清楚" },
                      ].map((option) => (
                        <button
                          key={String(option.value)}
                          type="button"
                          className={`btn-secondary min-h-[44px] ${value === option.value ? "border-rust text-rust" : ""}`}
                          aria-pressed={value === option.value}
                          onClick={() => void update(field, option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {field === "drivable" && (
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: true, label: "能正常行驶" },
                        { value: false, label: "开不动，需要拖运" },
                        { value: null, label: "不清楚" },
                      ].map((option) => (
                        <button
                          key={String(option.value)}
                          type="button"
                          className={`btn-secondary min-h-[44px] ${value === option.value ? "border-rust text-rust" : ""}`}
                          aria-pressed={value === option.value}
                          onClick={() => void update(field, option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {field === "intent" && (
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: "scrap", label: "仅报废" },
                        { value: "replace", label: "报废并换新" },
                        { value: null, label: "还不确定" },
                      ].map((option) => (
                        <button
                          key={String(option.value)}
                          type="button"
                          className={`btn-secondary min-h-[44px] ${value === option.value ? "border-rust text-rust" : ""}`}
                          aria-pressed={value === option.value}
                          onClick={() => void update(field, option.value)}
                        >
                          {option.label}
                          {option.value === "replace" && (
                            <span className="tag ml-2 text-acid">补贴待办</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {field === "documentsStatus" && (
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: "complete", label: "行驶证和登记证都在" },
                        { value: "missing_registration", label: "登记证（绿本）暂时找不到" },
                        { value: null, label: "不清楚" },
                      ].map((option) => (
                        <button
                          key={String(option.value)}
                          type="button"
                          className={`btn-secondary min-h-[44px] ${value === option.value ? "border-rust text-rust" : ""}`}
                          aria-pressed={value === option.value}
                          onClick={() => void update(field, option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {busy && <p className="mono mt-2 text-xs text-warn">正在重算…</p>}
                </FieldShell>
              );
            })}

            <div className="mt-5 border-t border-line pt-4">
              <label htmlFor="extra" className="label block">
                补充一句（可选）
              </label>
              <p className="mt-1 text-xs text-dim">
                新描述与已确认字段冲突时会标出冲突，不会静默覆盖。
              </p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  id="extra"
                  className="input"
                  value={extra}
                  maxLength={200}
                  onChange={(e) => setExtra(e.target.value)}
                  placeholder="例如：登记地其实是绵阳"
                />
                <button
                  type="button"
                  className="btn-secondary shrink-0"
                  onClick={() => void reparse()}
                  disabled={parsing || !extra.trim()}
                >
                  {parsing ? "解析中…" : "重新识别"}
                </button>
              </div>
              {conflicts.length > 0 && (
                <div className="mt-3 space-y-2" aria-live="polite">
                  {conflicts.map((conflict) => (
                    <Notice
                      key={conflict.field}
                      tone="warn"
                      title={`字段冲突：${FIELD_LABELS[conflict.field]}`}
                    >
                      <p>
                        已确认：<FieldValueText value={conflict.kept} />；新描述：
                        <FieldValueText value={conflict.candidate} />
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            void update(conflict.field, conflict.candidate);
                            setConflicts((prev) =>
                              prev.filter((c) => c.field !== conflict.field),
                            );
                          }}
                        >
                          使用新值
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() =>
                            setConflicts((prev) =>
                              prev.filter((c) => c.field !== conflict.field),
                            )
                          }
                        >
                          保留已确认
                        </button>
                      </div>
                    </Notice>
                  ))}
                </div>
              )}
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel>
            <p className="label">地区核对</p>
            <div className="mt-3 space-y-3 text-sm">
              <div>
                <p className="text-dim">车辆所在地</p>
                <p className="font-bold">
                  <FieldValueText value={fields.get("vehicleLocation")?.value} />
                </p>
              </div>
              <div>
                <p className="text-dim">登记地</p>
                <p className="font-bold">
                  <FieldValueText value={fields.get("registrationLocation")?.value} />
                </p>
              </div>
              <div>
                <p className="text-dim">地方规则覆盖</p>
                <p className="text-warn">{snapshot.policy.statusLabel}</p>
                <p className="mt-1 text-xs text-dim">
                  来源 {snapshot.policy.sourceIds.join(" / ")} · 核对日期{" "}
                  {snapshot.policy.checkedAt || "待确认"}
                </p>
              </div>
            </div>
          </Panel>

          <Panel>
            <p className="label">接下来</p>
            <p className="mt-2 text-sm text-dim">
              确认情况后进入材料预检。材料页只列本次计划需要的材料，不会一次展示全部证件。
            </p>
            <p className="mt-3 text-xs text-dim">
              主按钮在本页顶部；字段修改可随时进行，改动会立即重算任务与下一步。
            </p>
          </Panel>

          <p aria-live="polite" className="min-h-[2rem] text-sm text-acid">
            {message}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/start" className="btn-secondary">
          ← 返回开始
        </Link>
        <Link href="/documents" className="btn-secondary">
          跳过修改，查看材料
        </Link>
      </div>
    </div>
  );
}