"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useCase } from "@/components/case-provider";
import { api, downloadJson } from "@/lib/client";
import { DEMO_STAGES_LABEL } from "@/components/demo-stages";

type DemoResult = { applied: boolean; message: string };

// 只在显式带上 ?demo=1 时显示内部调试入口；默认页面不渲染任何按钮。
function subscribeDebugFlag() {
  return () => {};
}

function readDebugFlag(): boolean {
  return new URLSearchParams(window.location.search).get("demo") === "1";
}

function readDebugFlagOnServer(): boolean {
  return false;
}

export function DemoDrawer() {
  const { caseId, clearCase, refresh } = useCase();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const enabled = useSyncExternalStore(
    subscribeDebugFlag,
    readDebugFlag,
    readDebugFlagOnServer,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("内部调试与用户操作分开记录。");

  async function inject(stage: string) {
    if (!caseId) return;
    setBusy(stage);
    setMessage("");
    try {
      const result = await api<DemoResult>("/api/demo", {
        method: "POST",
        json: { action: "inject", caseId, stage },
      });
      setMessage(result.message);
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "注入失败");
    } finally {
      setBusy(null);
    }
  }

  async function paymentNotice() {
    if (!caseId) return;
    setBusy("notice");
    try {
      await api("/api/demo", {
        method: "POST",
        json: { action: "payment_notice", caseId },
      });
      setMessage("已记录企业付款反馈（仅通知，不等于到账）。");
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusy(null);
    }
  }

  async function reset() {
    if (!window.confirm("重置会清空当前案件、材料、报价、预约与事件记录，回到同一 seed。继续？")) {
      return;
    }
    setBusy("reset");
    try {
      await api("/api/demo", { method: "POST", json: { action: "reset" } });
      clearCase();
      setMessage("已重置到 V1.1 初始数据。");
      router.push("/start");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "重置失败");
    } finally {
      setBusy(null);
    }
  }

  async function exportRecord() {
    if (!caseId) return;
    setBusy("export");
    try {
      const data = await api<Record<string, unknown>>("/api/demo", {
        method: "POST",
        json: { action: "export", caseId },
      });
      downloadJson(`baofei-debug-${caseId.slice(0, 8)}.json`, data);
      setMessage("已导出本地测试记录 JSON（不含真实个人信息与证件图像）。");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "导出失败");
    } finally {
      setBusy(null);
    }
  }

  if (!enabled) return null;
  return (
    <div
      className={`fixed bottom-20 right-3 z-50 lg:bottom-5 lg:right-5 ${
        open ? "w-[min(92vw,340px)]" : "w-auto"
      }`}
    >
      <div className="panel-strong shadow-2xl">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="demo-drawer-body"
          className="flex min-h-[44px] w-full items-center justify-between gap-3 px-3 text-left"
        >
          <span className="label flex items-center gap-2 text-warn">
            <span className="lamp text-warn" aria-hidden />
            内部调试
          </span>
          <span className="mono text-xs text-dim">{open ? "收起 ▲" : "展开 ▼"}</span>
        </button>

        {open && (
          <div id="demo-drawer-body" className="border-t border-line p-3">
            <p className="mono text-[11px] leading-relaxed text-dim">
              主持人区域，与用户操作分开。注入事件 source=demo_controller，不计作用户自主完成。
            </p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {DEMO_STAGES_LABEL.map((stage) => (
                <button
                  key={stage.id}
                  type="button"
                  className="btn-secondary min-h-[40px] px-2 text-xs"
                  disabled={!caseId || busy !== null}
                  onClick={() => void inject(stage.id)}
                  title={stage.description}
                >
                  {busy === stage.id ? "注入中…" : stage.label}
                </button>
              ))}
            </div>
            <div className="mt-2 grid gap-1.5">
              <button
                type="button"
                className="btn-secondary min-h-[40px] text-xs"
                disabled={!caseId || busy !== null}
                onClick={() => void paymentNotice()}
              >
                企业付款反馈（仅通知，不到账）
              </button>
              <button
                type="button"
                className="btn-secondary min-h-[40px] text-xs"
                disabled={!caseId || busy !== null}
                onClick={() => void exportRecord()}
              >
                导出本地测试记录 JSON
              </button>
              <button
                type="button"
                className="btn-secondary min-h-[40px] border-danger/60 text-xs text-danger"
                disabled={busy !== null}
                onClick={() => void reset()}
              >
                重置到 seed
              </button>
            </div>
            <p aria-live="polite" className="mt-2 min-h-[2.5rem] text-xs text-dim">
              {message}
            </p>
            {!caseId && (
              <p className="mono text-[11px] text-warn">
                当前没有案件：注入与导出需先开始一次办理。
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}