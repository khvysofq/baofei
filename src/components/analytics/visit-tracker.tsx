"use client";

import { useEffect, useRef } from "react";

/** 首页访问埋点：只上报路径与来源，不采集 IP 或个人资料。 */
export function VisitTracker() {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    const payload = JSON.stringify({
      path: window.location.pathname,
      referrer: document.referrer || null,
    });

    void fetch("/api/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => {
      // 埋点失败不影响用户使用
    });
  }, []);

  return null;
}