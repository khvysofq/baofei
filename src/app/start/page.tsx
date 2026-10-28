"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCase } from "@/components/case-provider";
import { Notice, Panel, SectionTitle, Tag } from "@/components/ui";
import { api } from "@/lib/client";
import { TASK_META } from "@/lib/domain/tasks";
import type { CoreFieldName, FieldValue } from "@/lib/types";

type Scenario = {
  id: string;
  name: string;
  intakeText: string;
  label: string;
};

type ParsedField = {
  value: FieldValue;
  source: string;
  confirmed: boolean;
  confidence: number;
};

type ParseResponse = {
  fields: Record<CoreFieldName, ParsedField>;
  degraded: boolean;
  conflicts: unknown[];
};

const MAX = 500;

export default function StartPage() {
  const router = useRouter();
  const { snapshot, setCaseId } = useCase();
  const [text, setText] = useState("");
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api<Scenario[]>("/api/scenarios")
      .then((data) => {
        if (alive) setScenarios(data);
      })
      .catch(() => {
        if (alive) setScenarios([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  async function generate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const parsed = await api<ParseResponse>("/api/intake/parse", {
        method: "POST",
        json: { text },
      });
      const fields = Object.fromEntries(
        Object.entries(parsed.fields).map(([key, value]) => [
          key,
          {
            value: value.value,
            source: value.source,
            confidence: value.confidence,
          },
        ]),
      );
      const created = await api<{ caseId: string; caseNo: string }>("/api/cases", {
        method: "POST",
        json: { fields },
      });
      setCaseId(created.caseId);
      setNotice(
        parsed.degraded
          ? "没有识别到足够信息，已进入选项确认。"
          : `已生成办理计划：${created.caseNo}`,
      );
      router.push("/plan");
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="hazard mb-5" aria-hidden />
      <p className="label text-rust">四川 · 线上办理</p>
      <h1 className="mt-2 text-3xl font-black leading-tight tracking-tight sm:text-5xl">
        帮你理清在四川
        <br className="sm:hidden" />
        报废车辆的下一步
      </h1>
      <p className="mt-3 max-w-xl text-base text-dim">
        用一句话说明车在哪里、登记在哪里、现在能不能开。系统会整理成个人办理计划，
        再逐步核对材料、比较费用和安排预约。
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Tag tone="acid">自动整理信息</Tag>
        <Tag>材料线上核对</Tag>
        <Tag>进度可查</Tag>
      </div>

      <Panel className="mt-6" strong>
        <label htmlFor="intake" className="label block">
          用日常语言描述车辆情况
        </label>
        <textarea
          id="intake"
          className="input mt-2 min-h-[150px] resize-y"
          maxLength={MAX}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="例如：车现在在成都，登记也是成都，本人办理，车子开不动了，证件都在，只想报废，不买新车。"
          aria-describedby="intake-help"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p id="intake-help" className="text-xs text-dim">
            不要填写真实身份证号、电话、完整 VIN 或详细地址。最多 {MAX} 字。
          </p>
          <span className="mono text-xs tabular text-dim">
            {text.length}/{MAX}
          </span>
        </div>

        <button
          type="button"
          className="btn-primary mt-4 w-full sm:w-auto"
          onClick={() => void generate()}
          disabled={busy}
        >
          {busy ? "正在整理…" : "生成我的办理计划"}
        </button>
        {busy && (
          <p className="mono mt-2 text-xs text-warn" aria-live="polite">
            规则解析中，不会联网查档。
          </p>
        )}
        {error && (
          <div className="mt-3" aria-live="assertive">
            <Notice tone="danger" title="没有生成计划">
              {error}
            </Notice>
          </div>
        )}
        {notice && (
          <p className="mt-3 text-sm text-acid" aria-live="polite">
            {notice}
          </p>
        )}
      </Panel>

      <section className="mt-8">
        <SectionTitle
          aside={<span className="tag text-rust">常见情况</span>}
        >
          直接选择情况
        </SectionTitle>
        <p className="mb-3 text-sm text-dim">
          点选后只填入描述框，需要你确认后才生成计划，不会自动创建案件。
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {scenarios.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              onClick={() => setText(scenario.intakeText)}
              className="panel min-h-[132px] p-4 text-left transition-colors hover:border-rust/60"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="mono text-[11px] tracking-[0.18em] text-rust">
                  {scenario.id}
                </span>
                <span className="tag text-dim">{scenario.label}</span>
              </div>
              <p className="mt-2 font-black">{scenario.name.replace(/^S\d\s*/, "")}</p>
              <p className="mt-1 line-clamp-3 text-sm text-dim">{scenario.intakeText}</p>
            </button>
          ))}
          {scenarios.length === 0 && (
            <p className="text-sm text-dim">
              常见情况暂未加载，仍可在上方直接描述，规则解析不依赖它们。
            </p>
          )}
        </div>
      </section>

      {snapshot && (
        <Panel className="mt-8">
          <p className="label">当前案件</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="mono text-sm">{snapshot.case.caseNo}</p>
              <p className="text-sm text-dim">
                {snapshot.case.intent === "replace" ? "报废并换新" : snapshot.case.intent === "scrap" ? "仅报废" : "办理目标待确认"}
                · 下一步：{snapshot.nextAction ? TASK_META[snapshot.nextAction.kind].title : "查看办理状态"}
              </p>
            </div>
            <Link href="/plan" className="btn-secondary">
              继续上次办理
            </Link>
          </div>
        </Panel>
      )}

      <p className="mono mt-8 text-[11px] leading-relaxed text-dim">
        解析结果由规则整理生成，最终以受理渠道核验为准。
      </p>
    </div>
  );
}