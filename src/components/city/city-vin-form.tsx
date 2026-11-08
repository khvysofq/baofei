"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { validateVin } from "@/lib/vin/normalize";

/**
 * 城市落地页上的精简 VIN 输入。
 * 只做本地校验，然后把 VIN 带到首页估价框，避免在 21 个页面上重复渲染整份估价应用
 * （重复渲染会让这些页面互相抢同一批关键词）。
 */
export function CityVinForm({ cityName }: { cityName: string }) {
  const router = useRouter();
  const [vin, setVin] = useState("");
  const [error, setError] = useState<string | null>(null);

  const valid = useMemo(() => validateVin(vin).ok, [vin]);

  function go() {
    const result = validateVin(vin);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.push(`/?vin=${result.vin}#vin-input`);
  }

  return (
    <div className="panel-strong p-4 sm:p-5">
      <label htmlFor="city-vin" className="text-sm font-semibold">
        车辆识别代号（VIN）
      </label>
      <input
        id="city-vin"
        value={vin}
        onChange={(event) => {
          setVin(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 17));
          setError(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") go();
        }}
        inputMode="text"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder="请输入 17 位车辆识别代号"
        aria-invalid={vin.length > 0 && !valid}
        aria-describedby="city-vin-hint"
        className="input mono mt-2 h-14 w-full text-lg uppercase tracking-[0.12em]"
      />
      <div id="city-vin-hint" className="mt-2 flex items-center justify-between gap-2 text-xs">
        <span className="text-dim">17 位，不含 I / O / Q，第 9 位为校验位</span>
        <span
          className={`mono tabular ${
            vin.length === 0 ? "text-dim" : valid ? "text-brand" : "text-warn"
          }`}
        >
          {vin.length}/17
        </span>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-danger/40 bg-danger/8 px-3 py-2 text-xs text-danger"
        >
          {error}
        </p>
      ) : null}

      <button type="button" onClick={go} className="btn-primary mt-4 h-12 w-full text-base">
        免费估算{cityName}参考价
      </button>
      <p className="mt-2 text-center text-[11px] text-dim">
        只填 VIN，不上传证件，不采集手机号
      </p>
    </div>
  );
}