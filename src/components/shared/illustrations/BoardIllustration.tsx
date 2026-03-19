export default function BoardIllustration() {
  return (
    <svg width="280" height="160" viewBox="0 0 280 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <style>{`
        @keyframes bd-slide {
          0%   { transform: translateX(0)  translateY(0); opacity: 1; }
          40%  { transform: translateX(52px) translateY(0); opacity: 1; }
          50%  { transform: translateX(52px) translateY(0); opacity: 0; }
          51%  { transform: translateX(0)  translateY(0); opacity: 0; }
          60%  { transform: translateX(0)  translateY(0); opacity: 1; }
          100% { transform: translateX(0)  translateY(0); opacity: 1; }
        }
        @keyframes bd-appear {
          0%, 50%  { opacity: 0; }
          60%, 90% { opacity: 1; }
          100%     { opacity: 0; }
        }
        .bd-card  { animation: bd-slide  4s ease-in-out infinite; }
        .bd-dest  { animation: bd-appear 4s ease-in-out infinite; }
      `}</style>

      {/* 5 columns */}
      {['Backlog', 'To Do', 'In Progress', 'Review', 'Done'].map((_label, i) => (
        <g key={i}>
          {/* column header */}
          <rect x={4 + i * 55} y={4} width={48} height={16} rx={4}
            fill="var(--c-surface-raised)" stroke="var(--c-border)" strokeWidth={1} />
          <rect x={10 + i * 55} y={10} width={28} height={4} rx={2}
            fill="var(--c-text-muted)" opacity={0.5} />

          {/* ghost cards */}
          {[0, 1, 2].map((j) => {
            if (i === 2 && j === 0) return null; // slot for animated card
            const skip = i === 3 && j === 2;
            if (skip) return null;
            const priorities = ['var(--c-error)', 'var(--c-warn-500)', 'var(--c-accent-500)', 'var(--c-success)', 'var(--c-base-300)'];
            return (
              <g key={j}>
                <rect x={4 + i * 55} y={26 + j * 42} width={48} height={34} rx={4}
                  fill="var(--c-surface-raised)" stroke="var(--c-border)" strokeWidth={1} />
                <rect x={10 + i * 55} y={31 + j * 42} width={14} height={5} rx={2}
                  fill={priorities[i]} opacity={0.6} />
                <rect x={10 + i * 55} y={39 + j * 42} width={34} height={4} rx={2}
                  fill="var(--c-text-secondary)" opacity={0.4} />
                <rect x={10 + i * 55} y={45 + j * 42} width={22} height={4} rx={2}
                  fill="var(--c-border)" />
              </g>
            );
          })}
        </g>
      ))}

      {/* Animated card sliding from "In Progress" to "Review" */}
      <g className="bd-card">
        <rect x={114} y={26} width={48} height={34} rx={4}
          fill="var(--c-accent-100)" stroke="var(--c-accent-500)" strokeWidth={1} />
        <rect x={120} y={31} width={14} height={5} rx={2} fill="var(--c-accent-500)" opacity={0.8} />
        <rect x={120} y={39} width={34} height={4} rx={2} fill="var(--c-accent-500)" opacity={0.5} />
        <rect x={120} y={45} width={22} height={4} rx={2} fill="var(--c-accent-200)" />
      </g>

      {/* Destination slot in Review */}
      <g className="bd-dest">
        <rect x={166} y={110} width={48} height={34} rx={4}
          fill="var(--c-accent-100)" stroke="var(--c-border-accent)" strokeWidth={1}
          strokeDasharray="4 2" />
      </g>
    </svg>
  );
}
