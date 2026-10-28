"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCase } from "@/components/case-provider";
import {
  EmptyCase,
  Money,
  Notice,
  Panel,
  SectionTitle,
  Tag,
} from "@/components/ui";
import { api, newIdempotencyKey } from "@/lib/client";
import { formatYuan } from "@/lib/domain/money";
import type { AppointmentRecord, QuoteRecord } from "@/lib/types";

type Slot = { id: string; label: string; window: string };

type AppointmentView = {
  appointment: AppointmentRecord | null;
  cancelled: AppointmentRecord | null;
  quote: QuoteRecord | null;
  slots: Slot[];
  defaultLocation: string;
  drivable: boolean | null;
  handoverPerson: string;
  materials: string[];
  missingTask: { kind: string; title: string } | null;
  docsReady: boolean;
  handedOver: boolean;
  canConfirm: boolean;
  summary: {
    providerName: string;
    slot: string;
    location: string;
    vehicleStatus: string;
    handoverPerson: string;
    materials: string[];
    fees: { gross: string; tow: string; service: string; net: string };
    note: string;
  } | null;
  profileVersion: number;
  materialsVersion: number;
  nextAction: { title: string } | null;
};

const HANDOVER_PERSONS = ["车主本人", "代办人"];

export default function AppointmentPage() {
  const router = useRouter();
  const { caseId, refresh } = useCase();
  const [view, setView] = useState<AppointmentView | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [idemKey, setIdemKey] = useState(() =>
    typeof window === "undefined" ? "" : newIdempotencyKey(),
  );
  const [form, setForm] = useState({
    slotId: "DEMO_SLOT_A",
    location: "",
    handoverPerson: "车主本人",
    drivable: null as boolean | null,
  });
  const [initializedFor, setInitializedFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!caseId) return;
    try {
      const data = await api<AppointmentView>(
        `/api/appointments?caseId=${encodeURIComponent(caseId)}`,
      );
      setView(data);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "预约加载失败");
    }
  }, [caseId]);

  useEffect(() => {
    // 页面数据通过 API 拉取，异步回调内更新状态。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    if (!view) return;
    const key = view.appointment
      ? `${view.appointment.id}:${view.appointment.status}`
      : "new";
    if (initializedFor === key) return;
    const appointment = view.appointment;
    // 首次拿到服务端数据后初始化本地表单。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      slotId: appointment?.slotId ?? view.slots[0]?.id ?? "DEMO_SLOT_A",
      location: appointment?.location ?? view.defaultLocation,
      handoverPerson: appointment?.handoverPerson ?? view.handoverPerson,
      drivable:
        appointment?.drivable === undefined
          ? view.drivable
          : appointment.drivable ?? view.drivable,
    });
    setInitializedFor(key);
    setEditing(false);
  }, [view, initializedFor]);

  const booked = view?.appointment?.status === "booked";
  const needsReconfirm = view?.appointment?.status === "needs_reconfirmation";
  const showForm = Boolean(view) && (!booked || editing) && !view?.handedOver;
  const suggestedLocation = view?.defaultLocation ?? "";

  const summary = useMemo(() => {
    if (!view?.quote) return null;
    const slot = view.slots.find((s) => s.id === form.slotId);
    const drivableLabel =
      form.drivable === true
        ? "可正常行驶"
        : form.drivable === false
          ? "开不动，需要拖运"
          : "行驶状况待确认";
    return {
      provider: view.quote.providerName,
      slot: slot?.label ?? "待选择",
      window: slot?.window ?? "",
      location: form.location || "待选择",
      drivableLabel,
      handoverPerson: form.handoverPerson || "待填写",
      materials: view.materials,
      fees: view.quote,
    };
  }, [view, form]);

  async function confirm() {
    if (!caseId) return;
    setBusy(true);
    setMessage(null);
    try {
      await api("/api/appointments/confirm", {
        method: "POST",
        json: {
          caseId,
          idempotencyKey: idemKey || newIdempotencyKey(),
          slotId: form.slotId,
          location: form.location,
          handoverPerson: form.handoverPerson,
          drivable: form.drivable,
        },
      });
      await refresh();
      await load();
      setMessage("预约已创建。资料发送项目已列在摘要中。");
      router.push("/case");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "预约失败");
    } finally {
      setBusy(false);
    }
  }

  async function reschedule() {
    if (!caseId) return;
    setBusy(true);
    setMessage(null);
    try {
      await api("/api/appointments", {
        method: "PATCH",
        json: {
          caseId,
          slotId: form.slotId,
          location: form.location,
          handoverPerson: form.handoverPerson,
          drivable: form.drivable,
        },
      });
      await refresh();
      await load();
      setMessage("预约时段已修改。");
      setEditing(false);
      setInitializedFor(null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "修改失败");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!caseId) return;
    if (!window.confirm("取消预约不会删除材料，也不会把车辆标记为已交接。继续？")) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await api("/api/appointments/cancel", {
        method: "POST",
        json: { caseId, reason: "用户取消" },
      });
      await refresh();
      await load();
      setIdemKey(newIdempotencyKey());
      setMessage("预约已取消。材料保留，车辆未被标记为已交接。");
      setInitializedFor(null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "取消失败");
    } finally {
      setBusy(false);
    }
  }

  if (!caseId) return <EmptyCase />;
  if (!view) {
    return <p className="mono mt-6 text-sm text-dim">正在加载预约信息…</p>;
  }

  const quote = view.quote;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="hazard mb-5" aria-hidden />
      <p className="label text-rust">P5 · 预约</p>
      <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-4xl">
        确认服务方、时段与费用
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-dim">
        本页读取当前报价和服务方，不要求重复输入。资料发送项目会列明，提交后生成预约记录。
      </p>

      {!quote && (
        <div className="mt-4">
          <Notice tone="warn" title="还没有有效报价">
            请先到报价页选择回收方。<Link href="/quotes" className="ml-1 underline">去报价页</Link>
          </Notice>
        </div>
      )}

      {view.handedOver && (
        <div className="mt-4">
          <Notice tone="warn" title="车辆已交接">
            交接后禁用常规取消、重选服务方和重订预约；错误或争议通过更正任务处理。
          </Notice>
        </div>
      )}

      {view.missingTask && (
        <div className="mt-4">
          <Notice tone="warn" title="先解决材料核对任务">
            {view.missingTask.title}：登记证缺失尚未解决，确认预约会被定位到该任务。
            <Link href="/documents" className="ml-1 underline">去材料页处理</Link>
          </Notice>
        </div>
      )}

      {!view.docsReady && !view.missingTask && (
        <div className="mt-4">
          <Notice tone="warn" title="材料尚未全部确认">
            可继续查看摘要，但确认预约前需要完成材料预检。
            <Link href="/documents" className="ml-1 underline">去材料页</Link>
          </Notice>
        </div>
      )}

      {booked && (
        <Panel className="mt-5" strong>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="label text-acid">预约已创建</p>
              <p className="mono mt-1 text-lg">{view.appointment?.appointmentNo}</p>
              <p className="mt-1 text-sm text-dim">
                状态：已预约 · 报价版本 v{view.appointment?.quoteVersion} · 资料版本 v
                {view.appointment?.materialsVersion}
              </p>
            </div>
            <Tag tone="acid">预约已确认</Tag>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setEditing(true)}
              disabled={view.handedOver}
            >
              修改时段
            </button>
            <button
              type="button"
              className="btn-secondary border-danger/60 text-danger"
              onClick={() => void cancel()}
              disabled={busy || view.handedOver}
            >
              取消预约
            </button>
          </div>
        </Panel>
      )}

      {needsReconfirm && (
        <div className="mt-4">
          <Notice tone="warn" title="预约摘要需要重新确认">
            报价、概况或材料版本已变化。请核对下方摘要后重新确认；旧摘要保留在事件记录中。
          </Notice>
        </div>
      )}

      {view.cancelled && !booked && (
        <div className="mt-4">
          <Notice tone="dim" title="上次预约已取消">
            {view.cancelled.appointmentNo} · 材料保留，车辆未被标记为已交接。可重新选择摘要并确认。
          </Notice>
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        {showForm && (
          <Panel>
            <SectionTitle>选择预约安排</SectionTitle>

            <fieldset>
              <legend className="label mb-2">预约时段</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {view.slots.map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    aria-pressed={form.slotId === slot.id}
                    className={`btn-secondary min-h-[64px] flex-col items-start ${form.slotId === slot.id ? "border-rust text-rust" : ""}`}
                    onClick={() => setForm((f) => ({ ...f, slotId: slot.id }))}
                  >
                    <span className="font-bold">{slot.label}</span>
                    <span className="mono text-xs text-dim">{slot.window}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="mt-4">
              <label htmlFor="location" className="label block">
                车辆停放点
              </label>
              <input
                id="location"
                className="input mt-1"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder={suggestedLocation || "请选择车辆停放点（所在地未知时不预填）"}
              />
              {suggestedLocation && form.location !== suggestedLocation && (
                <button
                  type="button"
                  className="link-rust mt-1 text-xs"
                  onClick={() => setForm((f) => ({ ...f, location: suggestedLocation }))}
                >
                  使用 {suggestedLocation}
                </button>
              )}
              <p className="mt-1 text-xs text-dim">
                请填写便于交接的停放位置，无需填写门牌号。仅成都核心场景预填“成都·车辆停放点”。
              </p>
            </div>

            <div className="mt-4">
              <label htmlFor="handover" className="label block">
                交接人
              </label>
              <select
                id="handover"
                className="input mt-1"
                value={form.handoverPerson}
                onChange={(e) =>
                  setForm((f) => ({ ...f, handoverPerson: e.target.value }))
                }
              >
                {HANDOVER_PERSONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4">
              <span className="label block">车辆状况（本次交接）</span>
              <div className="mt-1 flex flex-wrap gap-2">
                {[
                  { value: false, label: "开不动，需要拖运" },
                  { value: true, label: "可正常行驶" },
                  { value: null, label: "不清楚" },
                ].map((option) => (
                  <button
                    key={String(option.value)}
                    type="button"
                    aria-pressed={form.drivable === option.value}
                    className={`btn-secondary min-h-[44px] ${form.drivable === option.value ? "border-rust text-rust" : ""}`}
                    onClick={() => setForm((f) => ({ ...f, drivable: option.value }))}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-dim">
                只记录在本次预约摘要；如需调整拖车费用，请回计划页修改行驶状况并重新确认报价。
              </p>
            </div>

            {booked && editing ? (
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busy || !form.location.trim()}
                  onClick={() => void reschedule()}
                >
                  {busy ? "保存中…" : "保存修改后的时段"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setEditing(false);
                    setInitializedFor(null);
                  }}
                >
                  放弃修改
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn-primary mt-5 w-full"
                disabled={
                  busy ||
                  !view.canConfirm ||
                  !form.location.trim() ||
                  !form.handoverPerson.trim()
                }
                onClick={() => void confirm()}
              >
                {busy ? "提交中…" : "确认预约"}
              </button>
            )}
            {!view.canConfirm && !view.handedOver && (
              <p className="mt-2 text-xs text-warn">
                当前不能提交：请先完成报价选择、材料确认或核对任务。
              </p>
            )}
          </Panel>
        )}

        <div className="space-y-4">
          <Panel strong>
            <SectionTitle aside={<Tag tone="rust">摘要同屏确认</Tag>}>
              最终确认摘要
            </SectionTitle>
            {!summary ? (
              <p className="text-sm text-dim">尚无有效报价，无法生成摘要。</p>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <div>
                    <p className="label">服务方</p>
                    <p className="font-bold">{summary.provider}</p>
                  </div>
                  <div>
                    <p className="label">时段</p>
                    <p className="font-bold">{summary.slot}</p>
                    <p className="mono text-xs text-dim">{summary.window}</p>
                  </div>
                  <div>
                    <p className="label">地点</p>
                    <p className="font-bold">{summary.location}</p>
                  </div>
                  <div>
                    <p className="label">交接人</p>
                    <p className="font-bold">{summary.handoverPerson}</p>
                  </div>
                  <div>
                    <p className="label">车辆状况</p>
                    <p className="font-bold">{summary.drivableLabel}</p>
                  </div>
                  <div>
                    <p className="label">待交材料</p>
                    <p className="font-bold">{summary.materials.join("、")}</p>
                  </div>
                </div>

                <div className="border-t border-line pt-3">
                  <p className="label">全部费用</p>
                  <dl className="mt-2 space-y-1">
                    <div className="flex justify-between">
                      <dt className="text-dim">回收款</dt>
                      <dd className="mono">
                        {summary.fees.grossFen === null
                          ? "待确认"
                          : `¥${formatYuan(summary.fees.grossFen)}`}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-dim">拖车费</dt>
                      <dd className="mono">
                        {summary.fees.towFen === null
                          ? "待确认"
                          : `−¥${formatYuan(summary.fees.towFen)}`}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-dim">服务费</dt>
                      <dd className="mono">
                        {summary.fees.serviceFen === null
                          ? "待确认"
                          : `−¥${formatYuan(summary.fees.serviceFen)}`}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-2 flex items-end justify-between">
                    <p className="label">预计实收</p>
                    <Money fen={summary.fees.netFen} size="lg" />
                  </div>
                </div>

                <Notice tone="warn" title="预约记录说明">
                  确认后生成预约记录。服务方、时段、停车点、报价与回执以提交内容为准。
                </Notice>
              </div>
            )}
          </Panel>

          <div className="flex flex-wrap gap-3 text-sm">
            <Link href="/quotes" className="link-rust">
              ← 更换服务方
            </Link>
            <Link href="/documents" className="link-rust">
              返回材料
            </Link>
            <Link href="/case" className="link-rust">
              查看办理状态
            </Link>
          </div>
          <p aria-live="polite" className="min-h-[2rem] text-sm text-acid">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}