export default function OverviewIllustration() {
  return (
    <svg width="280" height="160" viewBox="0 0 280 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <style>{`
        @keyframes ov-scan {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        @keyframes ov-pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        @keyframes ov-draw {
          from { stroke-dashoffset: 200; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes ov-dot {
          0%, 100% { r: 3; opacity: 1; }
          50% { r: 5; opacity: 0.6; }
        }
        .ov-scan { animation: ov-scan 2.4s ease-in-out infinite; }
        .ov-p1 { animation: ov-pulse 2s ease-in-out infinite 0s; }
        .ov-p2 { animation: ov-pulse 2s ease-in-out infinite 0.4s; }
        .ov-p3 { animation: ov-pulse 2s ease-in-out infinite 0.8s; }
        .ov-p4 { animation: ov-pulse 2s ease-in-out infinite 1.2s; }
        .ov-line { animation: ov-draw 1.8s ease-out both 0.3s; }
        .ov-dot  { animation: ov-dot 1.5s ease-in-out infinite; }
      `}</style>

      {/* 4 KPI cards */}
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect
            x={4 + i * 68} y={4}
            width={60} height={52}
            rx={6}
            fill="var(--c-surface-raised)"
            stroke="var(--c-border)"
            strokeWidth={1}
          />
          {/* scan shimmer */}
          <clipPath id={`clip-ov-${i}`}>
            <rect x={4 + i * 68} y={4} width={60} height={52} rx={6} />
          </clipPath>
          <rect
            x={4 + i * 68} y={4} width={14} height={52}
            fill="var(--c-accent-100)"
            clipPath={`url(#clip-ov-${i})`}
            className="ov-scan"
          />
          {/* label bar */}
          <rect x={12 + i * 68} y={16} width={30} height={5} rx={2} fill="var(--c-border)" className={`ov-p${i + 1}`} />
          {/* value bar */}
          <rect x={12 + i * 68} y={28} width={40} height={8} rx={3} fill="var(--c-accent-200)" className={`ov-p${i + 1}`} />
          {/* sub bar */}
          <rect x={12 + i * 68} y={42} width={22} height={4} rx={2} fill="var(--c-border)" className={`ov-p${i + 1}`} />
        </g>
      ))}

      {/* Chart area */}
      <rect x={4} y={66} width={272} height={88} rx={6} fill="var(--c-surface-raised)" stroke="var(--c-border)" strokeWidth={1} />

      {/* Chart label */}
      <rect x={16} y={76} width={60} height={5} rx={2} fill="var(--c-border)" />

      {/* Grid lines */}
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1={16} x2={264} y1={92 + i * 14} y2={92 + i * 14} stroke="var(--c-border)" strokeWidth={0.5} />
      ))}

      {/* Sparkline */}
      <polyline
        points="16,134 44,122 72,128 100,110 128,116 156,98 184,104 212,88 240,96 264,80"
        stroke="var(--c-accent-500)"
        strokeWidth={2}
        fill="none"
        strokeDasharray="200"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="ov-line"
      />

      {/* Area fill */}
      <path
        d="M16,134 44,122 72,128 100,110 128,116 156,98 184,104 212,88 240,96 264,80 V148 H16 Z"
        fill="var(--c-accent-100)"
        opacity="0.5"
      />

      {/* Live dot */}
      <circle cx={264} cy={80} r={3} fill="var(--c-accent-500)" className="ov-dot" />
    </svg>
  );
}
