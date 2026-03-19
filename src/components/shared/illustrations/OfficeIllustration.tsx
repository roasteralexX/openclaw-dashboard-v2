export default function OfficeIllustration() {
  const desks = [
    { x: 60,  y: 30,  status: 'var(--c-success)',  delay: '0s' },
    { x: 148, y: 30,  status: 'var(--c-success)',  delay: '0.4s' },
    { x: 60,  y: 90,  status: 'var(--c-warn-500)', delay: '0.8s' },
    { x: 148, y: 90,  status: 'var(--c-warn-500)', delay: '1.2s' },
    { x: 60,  y: 150, status: 'var(--c-error)',    delay: '1.6s' },
    { x: 148, y: 150, status: 'var(--c-base-300)', delay: '2.0s' },
  ];

  return (
    <svg width="280" height="200" viewBox="0 0 280 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <style>{`
        @keyframes of-pulse {
          0%, 100% { opacity: 0.2; r: 6; }
          50%       { opacity: 0.7; r: 9; }
        }
        @keyframes of-fade {
          0%, 100% { opacity: 0.6; }
          50%       { opacity: 1; }
        }
      `}</style>

      {/* Floor grid */}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <line key={`h${i}`} x1={4} x2={276} y1={10 + i * 30} y2={10 + i * 30}
          stroke="var(--c-border)" strokeWidth={0.5} />
      ))}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
        <line key={`v${i}`} x1={4 + i * 30} x2={4 + i * 30} y1={10} y2={190}
          stroke="var(--c-border)" strokeWidth={0.5} />
      ))}

      {desks.map((d, i) => (
        <g key={i}>
          {/* desk top-down silhouette */}
          <rect x={d.x - 24} y={d.y - 14} width={48} height={28} rx={4}
            fill="var(--c-surface-raised)" stroke="var(--c-border)" strokeWidth={1} />
          {/* monitor hint */}
          <rect x={d.x - 12} y={d.y - 10} width={24} height={14} rx={2}
            fill="var(--c-base-600)" opacity={0.6} />
          {/* screen glow */}
          <rect x={d.x - 10} y={d.y - 8} width={20} height={10} rx={2}
            fill={d.status} opacity={0.15} />

          {/* status ring (outer pulse) */}
          <circle cx={d.x + 18} cy={d.y - 10} r={6} fill={d.status} opacity={0.2}
            style={{ animation: `of-pulse 2s ease-in-out infinite ${d.delay}` }} />
          {/* status dot */}
          <circle cx={d.x + 18} cy={d.y - 10} r={4} fill={d.status} opacity={0.85}
            style={{ animation: `of-fade 2s ease-in-out infinite ${d.delay}` }} />
        </g>
      ))}

      {/* Center label */}
      <rect x={100} y={90} width={80} height={20} rx={10}
        fill="var(--c-accent-200)" stroke="var(--c-border-accent)" strokeWidth={1} />
      <rect x={115} y={97} width={50} height={6} rx={3} fill="var(--c-accent-500)" opacity={0.7} />
    </svg>
  );
}
