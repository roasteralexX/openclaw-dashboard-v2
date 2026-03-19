export default function ChatIllustration() {
  return (
    <svg width="280" height="160" viewBox="0 0 280 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <style>{`
        @keyframes ci-pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        @keyframes ci-slide {
          0%   { opacity: 0; transform: translateX(-6px); }
          15%  { opacity: 1; transform: translateX(0); }
          85%  { opacity: 1; transform: translateX(0); }
          100% { opacity: 0; transform: translateX(4px); }
        }
        @keyframes ci-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .ci-msg1 { animation: ci-slide 3.2s ease-in-out infinite 0s; }
        .ci-msg2 { animation: ci-slide 3.2s ease-in-out infinite 0.8s; }
        .ci-msg3 { animation: ci-slide 3.2s ease-in-out infinite 1.6s; }
        .ci-dot1 { animation: ci-pulse 1.4s ease-in-out infinite 0s; }
        .ci-dot2 { animation: ci-pulse 1.4s ease-in-out infinite 0.25s; }
        .ci-dot3 { animation: ci-pulse 1.4s ease-in-out infinite 0.5s; }
        .ci-cursor { animation: ci-blink 0.9s step-end infinite; }
      `}</style>

      {/* Main chat window */}
      <rect x={20} y={8} width={240} height={130} rx={8}
        fill="var(--c-surface-raised)" stroke="var(--c-border)" strokeWidth={1} />

      {/* Header bar */}
      <rect x={20} y={8} width={240} height={36} rx={8}
        fill="var(--c-base-700)" stroke="var(--c-border)" strokeWidth={1} />
      <rect x={20} y={32} width={240} height={12} fill="var(--c-base-700)" />
      <circle cx={44} cy={26} r={8} fill="var(--c-accent-200)" />
      <circle cx={44} cy={26} r={4} fill="var(--c-accent-500)" />
      <rect x={58} y={21} width={56} height={5} rx={2.5}
        fill="var(--c-text-secondary)" opacity={0.6} />
      <rect x={58} y={29} width={34} height={4} rx={2}
        fill="var(--c-success)" opacity={0.5} />
      {/* connection dot */}
      <circle cx={248} cy={26} r={4} fill="var(--c-success)" opacity={0.8} />

      {/* User message (right-aligned) */}
      <g className="ci-msg1">
        <rect x={148} y={52} width={96} height={28} rx={6}
          fill="var(--c-accent-200)" stroke="var(--c-accent-300)" strokeWidth={0.5} />
        <rect x={158} y={59} width={76} height={4} rx={2}
          fill="var(--c-accent-500)" opacity={0.8} />
        <rect x={158} y={67} width={52} height={4} rx={2}
          fill="var(--c-accent-500)" opacity={0.5} />
      </g>

      {/* Assistant message (left-aligned) */}
      <g className="ci-msg2">
        <rect x={28} y={88} width={112} height={36} rx={6}
          fill="var(--c-base-700)" stroke="var(--c-border)" strokeWidth={1} />
        <rect x={38} y={95} width={92} height={4} rx={2}
          fill="var(--c-text-secondary)" opacity={0.7} />
        <rect x={38} y={103} width={74} height={4} rx={2}
          fill="var(--c-text-secondary)" opacity={0.5} />
        <rect x={38} y={111} width={60} height={4} rx={2}
          fill="var(--c-text-secondary)" opacity={0.35} />
      </g>

      {/* Typing indicator */}
      <g className="ci-msg3">
        <rect x={28} y={90} width={52} height={24} rx={6}
          fill="var(--c-base-600)" stroke="var(--c-border)" strokeWidth={1} />
        <circle cx={42} cy={102} r={3.5} fill="var(--c-accent-500)" className="ci-dot1" />
        <circle cx={54} cy={102} r={3.5} fill="var(--c-accent-500)" className="ci-dot2" />
        <circle cx={66} cy={102} r={3.5} fill="var(--c-accent-500)" className="ci-dot3" />
      </g>

      {/* Input bar */}
      <rect x={28} y={122} width={186} height={10} rx={5}
        fill="var(--c-base-600)" />
      <rect x={36} y={125} width={48} height={4} rx={2}
        fill="var(--c-text-muted)" opacity={0.4} />
      <rect x={86} y={126} width={2} height={2} rx={1}
        fill="var(--c-accent-500)" className="ci-cursor" />

      {/* Send button */}
      <rect x={220} y={120} width={32} height={14} rx={5}
        fill="var(--c-accent-500)" opacity={0.9} />
      <path d="M228 127 L244 127 M240 124 L244 127 L240 130"
        stroke="var(--c-text-inverse)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />

      {/* Rate limit dots (bottom left) */}
      {[0, 1, 2, 3, 4].map((i) => (
        <circle key={i} cx={28 + i * 9} cy={150} r={3}
          fill={i < 3 ? 'var(--c-accent-500)' : 'var(--c-base-500)'}
          opacity={i < 3 ? 0.8 : 0.3}
        />
      ))}
    </svg>
  );
}
