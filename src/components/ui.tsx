import type { ReactNode } from "react";
import Link from "next/link";
import { formatYuan } from "@/lib/domain/money";
import { TASK_META } from "@/lib/domain/tasks";
import type { TaskKind, TaskRecord, TrackState } from "@/lib/types";

export const TASK_HREF: Record<TaskKind, string> = {
  unsupported_case: "/case#help",
  confirm_authorization: "/documents",
  review_missing_document: "/documents",
  confirm_materials: "/documents",
  confirm_quote: "/quotes",
  confirm_appointment: "/appointment",
  obtain_recovery_certificate: "/case",
  verify_recovery_certificate: "/case",
  verify_deregistration: "/case",
  confirm_payment: "/case",
  subsidy_followup: "/subsidy",
};

export function Panel({
  children,
  className = "",
  strong = false,
  id,
}: {
  children: ReactNode;
  className?: string;
  strong?: boolean;
  id?: string;
}) {
  return (
    <section id={id} className={`${strong ? "panel-strong" : "panel"} p-4 sm:p-5 ${className}`}>
      {children}
    </section>
  );
}

export function SectionTitle({
  children,
  aside,
}: {
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <h2 className="text-lg font-black tracking-tight sm:text-xl">{children}</h2>
      {aside}
    </div>
  );
}

export function Tag({ children, tone = "dim" }: { children: ReactNode; tone?: "dim" | "rust" | "acid" | "warn" | "danger" }) {
  const color =
    tone === "rust"
      ? "text-rust border-rust/50"
      : tone === "acid"
        ? "text-acid border-acid/50"
        : tone === "warn"
          ? "text-warn border-warn/50"
          : tone === "danger"
            ? "text-danger border-danger/50"
            : "text-dim";
  return (
    <span className={`tag ${color}`}>
      <span className="min-w-0">{children}</span>
    </span>
  );
}

export function Lamp({ tone = "neutral", label }: { tone?: TrackState["tone"]; label: string }) {
  const color =
    tone === "done"
      ? "text-acid"
      : tone === "warn"
        ? "text-warn"
        : tone === "danger"
          ? "text-danger"
          : tone === "waiting"
            ? "text-rust"
            : "text-dim";
  return (
    <span className={`inline-flex items-center gap-2 ${color}`}>
      <span className={`lamp ${tone === "waiting" ? "breathe" : ""}`} aria-hidden />
      <span className="text-sm font-semibold text-text">{label}</span>
    </span>
  );
}

export function Money({
  fen,
  size = "md",
  prefix = "¥",
}: {
  fen: number | null;
  size?: "sm" | "md" | "lg" | "xl";
  prefix?: string;
}) {
  const sizes = {
    sm: "text-base",
    md: "text-xl",
    lg: "text-3xl",
    xl: "text-4xl sm:text-5xl",
  };
  return (
    <span className={`mono tabular ${sizes[size]} font-black text-text`}>
      {fen === null ? (
        <span className="text-warn">待确认</span>
      ) : (
        <>
          <span className="mr-1 text-rust">{prefix}</span>
          {formatYuan(fen)}
        </>
      )}
    </span>
  );
}

export function TaskCard({
  task,
  stageNote,
  action = true,
}: {
  task: TaskRecord | null;
  stageNote?: string;
  action?: boolean;
}) {
  if (!task) {
    return (
      <div className="panel p-4">
        <p className="label">现在需要做</p>
        <p className="mt-2 text-lg font-black">没有待办任务</p>
        <p className="mt-1 text-sm text-dim">{stageNote ?? "可查看下方状态与凭证。"}</p>
      </div>
    );
  }
  return (
    <div className="panel border-rust/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="label">现在需要做</p>
        <Tag tone="rust">主任务</Tag>
      </div>
      <p className="mt-2 text-xl font-black tracking-tight">{TASK_META[task.kind].title}</p>
      <p className="mt-1 text-sm text-dim">{task.reason}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="text-dim">
          负责：<span className="text-text">{task.owner}</span>
        </span>
        {task.status === "needs_reconfirmation" && (
          <Tag tone="warn">需要重新确认</Tag>
        )}
        {action && (
          <Link href={TASK_HREF[task.kind]} className="link-rust mono text-sm">
            去处理 →
          </Link>
        )}
      </div>
    </div>
  );
}

export function StatusBlock({
  track,
  children,
}: {
  track: TrackState;
  children?: ReactNode;
}) {
  return (
    <div className="panel p-4" id={`track-${track.key}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="label">{track.label}</p>
          <div className="mt-2">
            <Lamp tone={track.tone} label={track.statusLabel} />
          </div>
        </div>
        <span className="mono text-[11px] text-dim">{track.status}</span>
      </div>
      <p className="mt-3 text-sm text-dim">{track.basis}</p>
      <p className="mt-2 text-sm">
        <span className="text-dim">下一步：</span>
        {track.next}
      </p>
      {children}
    </div>
  );
}

export function Notice({
  tone = "dim",
  title,
  children,
}: {
  tone?: "dim" | "warn" | "danger" | "acid" | "rust";
  title?: string;
  children: ReactNode;
}) {
  const color =
    tone === "warn"
      ? "border-warn/50 text-warn"
      : tone === "danger"
        ? "border-danger/50 text-danger"
        : tone === "acid"
          ? "border-acid/50 text-acid"
          : tone === "rust"
            ? "border-rust/50 text-rust"
            : "border-line-strong text-dim";
  return (
    <div className={`border-l-2 bg-panel px-3 py-2 text-sm ${color}`}>
      {title && <p className="font-bold">{title}</p>}
      <div className={title ? "mt-0.5" : ""}>{children}</div>
    </div>
  );
}

export function EmptyCase({ message }: { message?: string }) {
  return (
    <Panel className="mt-6">
      <p className="label">尚未开始</p>
      <h1 className="mt-2 text-2xl font-black tracking-tight">先描述车辆情况</h1>
      <p className="mt-2 text-base text-dim">
        {message ?? "直接打开此页时还没有案件。回到开始页描述情况，或选择一个成都演示案例。"}
      </p>
      <Link href="/start" className="btn-primary mt-5 inline-flex">
        去开始页
      </Link>
    </Panel>
  );
}

export function FieldValueText({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-warn">尚未说明</span>;
  }
  if (typeof value === "boolean") {
    return <span>{value ? "可正常行驶" : "开不动，需要拖运"}</span>;
  }
  if (typeof value === "object") {
    const region = value as { province?: string | null; city?: string | null };
    if (!region.province) return <span className="text-warn">尚未说明</span>;
    if (!region.city) return <span>{region.province}·市州待确认</span>;
    return <span>{region.province === region.city ? region.city : `${region.province}·${region.city}`}</span>;
  }
  if (value === "self") return <span>车主本人</span>;
  if (value === "family") return <span>家人或他人协助</span>;
  if (value === "scrap") return <span>仅报废</span>;
  if (value === "replace") return <span>报废并换新</span>;
  if (value === "complete") return <span>行驶证与登记证都在</span>;
  if (value === "missing_registration") return <span>登记证（绿本）暂时找不到</span>;
  return <span>{String(value)}</span>;
}

export function DemoDisclaimer() {
  return (
    <p className="mono text-[11px] leading-relaxed text-dim">
      演示数据不产生真实法律效力。金额、时段、凭证、企业资质均为演示配置，未接入真实政务或企业接口。
    </p>
  );
}