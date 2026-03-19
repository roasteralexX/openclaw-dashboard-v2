export default function HealthIllustration() {
  return (
    <svg
      width="160"
      height="120"
      viewBox="0 0 160 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Grid lines */}
      <line x1="10" y1="90" x2="150" y2="90" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1"/>
      <line x1="10" y1="70" x2="150" y2="70" stroke="currentColor" strokeOpacity="0.08" strokeWidth="1" strokeDasharray="3 3"/>
      <line x1="10" y1="50" x2="150" y2="50" stroke="currentColor" strokeOpacity="0.08" strokeWidth="1" strokeDasharray="3 3"/>
      <line x1="10" y1="30" x2="150" y2="30" stroke="currentColor" strokeOpacity="0.08" strokeWidth="1" strokeDasharray="3 3"/>

      {/* Latency line — cyan */}
      <polyline
        points="10,75 30,68 50,72 70,55 90,60 110,45 130,50 150,40"
        stroke="#00E5FF"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      />
      {/* Area fill */}
      <polygon
        points="10,75 30,68 50,72 70,55 90,60 110,45 130,50 150,40 150,90 10,90"
        fill="#00E5FF"
        fillOpacity="0.06"
      />

      {/* Second line — amber */}
      <polyline
        points="10,80 30,78 50,82 70,75 90,78 110,70 130,72 150,65"
        stroke="#FFB300"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />

      {/* Third line — green */}
      <polyline
        points="10,85 30,83 50,87 70,82 90,85 110,80 130,83 150,78"
        stroke="#00E676"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />

      {/* Spike indicator on cyan line */}
      <circle cx="70" cy="55" r="3" fill="#00E5FF" opacity="0.9"/>
      <line x1="70" y1="48" x2="70" y2="55" stroke="#00E5FF" strokeWidth="1" strokeDasharray="2 2" opacity="0.5"/>

      {/* Node status dots — top right */}
      <circle cx="130" cy="14" r="5" fill="#00E676" opacity="0.85"/>
      <circle cx="143" cy="14" r="5" fill="#00E676" opacity="0.85"/>
      <circle cx="156" cy="14" r="5" fill="#FFB300" opacity="0.85"/>

      {/* Status label bar */}
      <rect x="10" y="6" width="52" height="14" rx="3" fill="#00E5FF" fillOpacity="0.12" stroke="#00E5FF" strokeOpacity="0.3" strokeWidth="1"/>
      <text x="36" y="16" textAnchor="middle" fontSize="7" fill="#00E5FF" fontFamily="monospace" opacity="0.9">HEALTHY</text>

      {/* Axis ticks */}
      <line x1="10" y1="88" x2="10" y2="92" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1"/>
      <line x1="50" y1="88" x2="50" y2="92" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1"/>
      <line x1="90" y1="88" x2="90" y2="92" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1"/>
      <line x1="130" y1="88" x2="130" y2="92" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1"/>
      <line x1="150" y1="88" x2="150" y2="92" stroke="currentColor" strokeOpacity="0.2" strokeWidth="1"/>
    </svg>
  );
}
