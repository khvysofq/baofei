/**
 * 首页 hero 的装饰装置：车辆侧视线稿 + 拆解刻度 + HUD 角标。
 * 纯 SVG / CSS，无外部图片；对读屏隐藏，信息由相邻文案承担。
 */
export function VehicleRig() {
  return (
    <div className="relative mx-auto w-full max-w-[420px]">
      <div className="panel-strong relative overflow-hidden px-3 py-4">
        <div className="hero-scanbar" aria-hidden />
        <svg
          viewBox="0 0 400 430"
          aria-hidden
          focusable="false"
          className="h-auto w-full"
        >
          {/* HUD 四角 */}
          <g className="stroke-line-strong" fill="none" strokeWidth="1">
            <path d="M8 44V8h36" />
            <path d="M356 8h36v36" />
            <path d="M392 386v36h-36" />
            <path d="M44 422H8v-36" />
          </g>

          {/* 顶部刻度尺 */}
          <g className="stroke-line" strokeWidth="1">
            <path d="M32 60h336" />
            {Array.from({ length: 17 }, (_, i) => {
              const x = 32 + i * 21;
              const tall = i % 4 === 0;
              return (
                <path key={i} d={`M${x} 60v${tall ? 12 : 6}`} />
              );
            })}
          </g>
          <text
            x="32"
            y="88"
            className="fill-dim"
            fontFamily="var(--font-mono)"
            fontSize="9"
            letterSpacing="2"
          >
            0
          </text>
          <text
            x="326"
            y="88"
            className="fill-dim"
            fontFamily="var(--font-mono)"
            fontSize="9"
            letterSpacing="2"
          >
            1600
          </text>
          <text
            x="228"
            y="88"
            className="fill-rust"
            fontFamily="var(--font-mono)"
            fontSize="9"
            letterSpacing="2"
          >
            SIDE VIEW
          </text>

          {/* 拆解基准线 */}
          <g
            className="stroke-line"
            strokeWidth="1"
            strokeDasharray="2 5"
            fill="none"
          >
            <path d="M104 150v210" />
            <path d="M300 150v210" />
            <path d="M46 340h310" />
          </g>

          {/* 车身侧视线稿 */}
          <g
            className="stroke-dim"
            fill="none"
            strokeWidth="1.4"
            strokeLinejoin="round"
            strokeLinecap="round"
          >
            <path d="M40 340v-30c0-14 8-24 22-28l40-11 44-8 38-40c6-6 14-9 22-9h74c10 0 19 4 26 12l30 34 24 8c10 4 16 12 16 22v50" />
            <path d="M40 340h34" />
            <path d="M142 340h120" />
            <path d="M330 340h24" />
            <path d="M60 314h286" />
            <path d="M186 214l-22 38h92v-38z" />
            <path d="M268 214v38h46l-30-38z" />
            <path d="M114 271h50M244 271h76" />
            <path d="M40 314l4-16h18M360 314l-2-18h-16" />
          </g>

          {/* 轮组 */}
          <g className="stroke-line-strong" fill="none" strokeWidth="1.4">
            <circle cx="108" cy="340" r="34" />
            <circle cx="108" cy="340" r="18" />
            <circle cx="108" cy="340" r="5" className="stroke-rust" />
            <circle cx="302" cy="340" r="34" />
            <circle cx="302" cy="340" r="18" />
            <circle cx="302" cy="340" r="5" className="stroke-rust" />
          </g>

          {/* 拆解标记 */}
          <g
            className="fill-dim"
            fontFamily="var(--font-mono)"
            fontSize="9"
            letterSpacing="1.5"
          >
            <text x="112" y="146">01 / AXLE</text>
            <text x="248" y="146">02 / BODY</text>
            <text x="46" y="360">03 / BASE</text>
          </g>
          <g className="stroke-rust" strokeWidth="1.2" fill="none">
            <path d="M100 152h8" />
            <path d="M100 146v12" />
            <path d="M296 146v12" />
            <path d="M292 152h8" />
            <path d="M40 334v12" />
            <path d="M34 340h12" />
          </g>

          {/* 底部读数 */}
          <g
            className="fill-dim"
            fontFamily="var(--font-mono)"
            fontSize="9"
            letterSpacing="1.5"
          >
            <text x="32" y="396">DEMO UNIT · NOT TO SCALE</text>
            <text x="32" y="410">SICHUAN / CD · 30.57N 104.06E</text>
          </g>
          <text
            x="368"
            y="396"
            textAnchor="end"
            className="fill-rust"
            fontFamily="var(--font-mono)"
            fontSize="9"
            letterSpacing="1.5"
          >
            DEMO
          </text>
          <g className="stroke-line-strong" strokeWidth="1" fill="none">
            <path d="M368 404v16h-28" />
          </g>
        </svg>
      </div>
    </div>
  );
}