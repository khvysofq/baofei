"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CaseSnapshot } from "@/lib/types";
import { api, clearCaseId, readCaseId, storeCaseId } from "@/lib/client";

type CaseContextValue = {
  caseId: string | null;
  snapshot: CaseSnapshot | null;
  loading: boolean;
  error: string | null;
  setCaseId: (caseId: string) => void;
  clearCase: () => void;
  refresh: () => Promise<void>;
};

const CaseContext = createContext<CaseContextValue | null>(null);

export function CaseProvider({ children }: { children: React.ReactNode }) {
  const [caseId, setCaseIdState] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<CaseSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestCase = useRef<string | null>(null);

  const setCaseId = useCallback((next: string) => {
    latestCase.current = next;
    storeCaseId(next);
    setCaseIdState(next);
  }, []);

  const clearCase = useCallback(() => {
    latestCase.current = null;
    clearCaseId();
    setCaseIdState(null);
    setSnapshot(null);
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    const id = latestCase.current;
    if (!id) {
      setSnapshot(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api<CaseSnapshot>(
        `/api/case?caseId=${encodeURIComponent(id)}`,
      );
      if (latestCase.current !== id) return;
      setSnapshot(data);
      setError(null);
    } catch (err) {
      if (latestCase.current !== id) return;
      setError(err instanceof Error ? err.message : "案件加载失败");
      setSnapshot(null);
    } finally {
      if (latestCase.current === id) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const stored = readCaseId();
    if (stored) {
      latestCase.current = stored;
      // 首屏从 localStorage 恢复案件，属于客户端同步，需在 effect 中完成。
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCaseIdState(stored);
    }
  }, []);

  useEffect(() => {
    if (caseId) void refresh();
  }, [caseId, refresh]);

  useEffect(() => {
    const handler = () => {
      void refresh();
    };
    window.addEventListener("baofei:refresh", handler);
    return () => window.removeEventListener("baofei:refresh", handler);
  }, [refresh]);

  const value = useMemo(
    () => ({
      caseId,
      snapshot,
      loading,
      error,
      setCaseId,
      clearCase,
      refresh,
    }),
    [caseId, snapshot, loading, error, setCaseId, clearCase, refresh],
  );

  return <CaseContext.Provider value={value}>{children}</CaseContext.Provider>;
}

export function useCase(): CaseContextValue {
  const ctx = useContext(CaseContext);
  if (!ctx) throw new Error("useCase 必须在 CaseProvider 内使用");
  return ctx;
}