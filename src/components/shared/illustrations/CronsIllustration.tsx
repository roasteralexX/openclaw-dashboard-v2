export default function CronsIllustration() {
  return (
    <svg width="280" height="160" viewBox="0 0 280 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <style>{`
        @keyframes cr-sweep {
          0%   { width: 0; opacity: 0; }
          10%  { opacity: 1; }
          80%  { opacity: 1; }
          100% { width: 220px; opacity: 0; }
        }
        @keyframes cr-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @keyframes cr-run {
          0%   { x: 4; opacity: 0; }
          5%   { opacity: 1; }
          95%  { opacity: 1; }
          100% { x: 224; opacity: 0; }
        }
        .cr-sweep { animation: cr-sweep 3s ease-in-out infinite; }
        .cr-b1 { animation: cr-pulse 2s ease-in-out infinite 0.0s; }
        .cr-b2 { animation: cr-pulse 2s ease-in-out infinite 0.3s; }
        .cr-b3 { animation: cr-pulse 2s ease-in-out infinite 0.6s; }
        .cr-b4 { animation: cr-pulse 2s ease-in-out infinite 0.9s; }
        .cr-b5 { animation: cr-pulse 2s ease-in-out infinite 1.2s; }
        .cr-runner { animation: cr-run 3s ease-in-out infinite; }
      `}</style>

      {/* 4 cron rows */}
      {[0, 1, 2, 3].map((i) => {
        const colors = [
          'var(--c-success)', 'var(--c-success)', 'var(--c-warn-500)', 'var(--c-error)'
        ];
        const enabled = [true, true, true, false];
        return (
          <g key={i}>
            <rect x={4} y={4 + i * 38} width={272} height={30} rx={5}
              fill="var(--c-surface-raised)" stroke="var(--c-border)" strokeWidth={1} />
            {/* toggle dot */}
            <circle cx={18} cy={19 + i * 38} r={5}
              fill={enabled[i] ? colors[i] : 'var(--c-base-300)'} opacity={0.85} />
            {/* cron name */}
            <rect x={30} y={14 + i * 38} width={55} height={5} rx={2}
              fill="var(--c-text-secondary)" opacity={0.6} />
            {/* schedule badge */}
            <rect x={30} y={22 + i * 38} width={42} height={5} rx={2}
              fill="var(--c-accent-200)" />
            {/* execution blocks */}
            {[0, 1, 2, 3, 4, 5].map((b) => (
              <rect key={b}
                x={100 + b * 22} y={12 + i * 38}
                width={16}
                height={b % 3 === 2 && i === 2 ? 10 : b === 5 && i === 3 ? 10 : 14}
                rx={2}
                fill={
                  i === 3 ? 'var(--c-base-300)' :
                  b === 4 && i === 2 ? 'var(--c-error)' :
                  colors[i]
                }
                opacity={0.25 + b * 0.12}
              />
            ))}
            {/* run button */}
            <rect x={248} y={12 + i * 38} width={20} height={14} rx={3}
              fill={enabled[i] ? 'var(--c-accent-100)' : 'var(--c-base-600)'}
              stroke={enabled[i] ? 'var(--c-border-accent)' : 'var(--c-border)'}
              strokeWidth={0.5} />
            <polygon
              points={`${254},${17 + i * 38} ${261},${19 + i * 38} ${254},${21 + i * 38}`}
              fill={enabled[i] ? 'var(--c-accent-500)' : 'var(--c-text-muted)'}
              opacity={0.7}
            />
          </g>
        );
      })}

      {/* sweep animation over rows */}
      <clipPath id="cr-clip">
        <rect x={4} y={4} width={272} height={152} rx={5} />
      </clipPath>
      <rect x={4} y={4} height={152} rx={2}
        fill="var(--c-accent-500)" opacity={0.06}
        className="cr-sweep"
        clipPath="url(#cr-clip)"
      />
    </svg>
  );
}
