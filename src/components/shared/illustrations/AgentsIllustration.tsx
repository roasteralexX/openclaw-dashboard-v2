export default function AgentsIllustration() {
  return (
    <svg width="280" height="160" viewBox="0 0 280 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <style>{`
        @keyframes ag-ring {
          0%, 100% { r: 6; opacity: 1; }
          50% { r: 9; opacity: 0; }
        }
        @keyframes ag-bubble {
          0%   { opacity: 0; transform: translateY(8px); }
          20%  { opacity: 1; transform: translateY(0); }
          80%  { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-4px); }
        }
        @keyframes ag-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .ag-ring1 { animation: ag-ring 2s ease-in-out infinite 0s; }
        .ag-ring2 { animation: ag-ring 2s ease-in-out infinite 0.6s; }
        .ag-ring3 { animation: ag-ring 2s ease-in-out infinite 1.2s; }
        .ag-bubble { animation: ag-bubble 3s ease-in-out infinite 0.5s; }
        .ag-cursor { animation: ag-blink 1s step-end infinite; }
      `}</style>

      {/* 3 agent cards on the left */}
      {[0, 1, 2].map((i) => {
        const statuses = ['var(--c-success)', 'var(--c-warn-500)', 'var(--c-base-300)'];
        const rings = ['ag-ring1', 'ag-ring2', 'ag-ring3'];
        return (
          <g key={i}>
            <rect x={4} y={4 + i * 50} width={120} height={42} rx={6}
              fill={i === 0 ? 'var(--c-accent-100)' : 'var(--c-surface-raised)'}
              stroke={i === 0 ? 'var(--c-accent-500)' : 'var(--c-border)'}
              strokeWidth={1}
            />
            {/* status ring */}
            <circle cx={20} cy={25 + i * 50} r={6} fill={statuses[i]} opacity={0.2} />
            <circle cx={20} cy={25 + i * 50} r={6} fill={statuses[i]} className={rings[i]} opacity={0.4} />
            <circle cx={20} cy={25 + i * 50} r={4} fill={statuses[i]} />
            {/* name bar */}
            <rect x={32} y={18 + i * 50} width={55} height={6} rx={3} fill="var(--c-text-secondary)" opacity={0.5} />
            {/* role bar */}
            <rect x={32} y={30 + i * 50} width={38} height={4} rx={2} fill="var(--c-border)" />
            {/* token */}
            <rect x={96} y={18 + i * 50} width={22} height={6} rx={3} fill="var(--c-accent-200)" />
          </g>
        );
      })}

      {/* Chat panel on the right */}
      <rect x={136} y={4} width={140} height={152} rx={6}
        fill="var(--c-surface-raised)" stroke="var(--c-border)" strokeWidth={1} />

      {/* Agent header */}
      <circle cx={154} cy={22} r={8} fill="var(--c-accent-200)" />
      <circle cx={154} cy={22} r={4} fill="var(--c-accent-500)" />
      <rect x={166} y={16} width={50} height={6} rx={3} fill="var(--c-text-secondary)" opacity={0.5} />
      <rect x={166} y={26} width={32} height={4} rx={2} fill="var(--c-border)" />
      <line x1={136} x2={276} y1={38} y2={38} stroke="var(--c-border)" strokeWidth={1} />

      {/* Chat messages */}
      {/* user message (right aligned) */}
      <rect x={196} y={46} width={68} height={22} rx={5}
        fill="var(--c-accent-200)" stroke="var(--c-border-accent)" strokeWidth={0.5} />
      <rect x={204} y={52} width={52} height={4} rx={2} fill="var(--c-accent-500)" opacity={0.7} />
      <rect x={204} y={58} width={38} height={4} rx={2} fill="var(--c-accent-500)" opacity={0.4} />

      {/* agent reply (left aligned) */}
      <rect x={144} y={76} width={76} height={28} rx={5}
        fill="var(--c-surface-raised)" stroke="var(--c-border)" strokeWidth={1} />
      <rect x={152} y={82} width={60} height={4} rx={2} fill="var(--c-text-secondary)" opacity={0.6} />
      <rect x={152} y={90} width={44} height={4} rx={2} fill="var(--c-text-secondary)" opacity={0.4} />
      <rect x={152} y={96} width={52} height={4} rx={2} fill="var(--c-text-secondary)" opacity={0.3} />

      {/* typing bubble */}
      <g className="ag-bubble">
        <rect x={196} y={112} width={60} height={22} rx={5}
          fill="var(--c-accent-200)" stroke="var(--c-border-accent)" strokeWidth={0.5} />
        <rect x={204} y={118} width={44} height={4} rx={2} fill="var(--c-accent-500)" opacity={0.7} />
        <rect x={204} y={126} width={28} height={4} rx={2} fill="var(--c-accent-500)" opacity={0.4} />
      </g>

      {/* Input bar */}
      <rect x={144} y={142} width={120} height={8} rx={4} fill="var(--c-base-600)" opacity={0.5} />
      <rect x={150} y={145} width={30} height={2} rx={1} fill="var(--c-text-muted)" />
      <rect x={182} y={145} width={2} height={2} rx={1} fill="var(--c-accent-500)" className="ag-cursor" />
    </svg>
  );
}
