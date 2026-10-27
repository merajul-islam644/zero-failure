import { useId } from "react";

// The CHOKRO mark: the app icon tile — a dark rounded plate with a
// hairline blue frame, the ringed planet inside stroked with the brand's
// cyan-falling-into-magenta gradient. Each neon shape paints twice: a
// soft wide halo pass, then the crisp line. The plate travels with the
// glyph, so every surface — topbar, login, favicon — carries the same
// framed tile without any CSS chipping around it.

export function ChokroMark({ size = 24 }: { size?: number }) {
  // useId keeps the gradient id unique per instance — the mark renders in
  // the topbar and on the login screen at the same time.
  const gradId = `chokro-neon-${useId()}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#56d9e6" />
          <stop offset="1" stopColor="#f04ec1" />
        </linearGradient>
      </defs>
      {/* the plate: the app-icon tile itself */}
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="14"
        fill="#0d1322"
        stroke="#42506b"
        strokeWidth="2"
      />
      <g
        fill="none"
        stroke={`url(#${gradId})`}
        strokeLinecap="round"
        opacity="0.3"
      >
        <circle cx="32" cy="31.5" r="12.5" strokeWidth="5.5" />
        <ellipse
          cx="32"
          cy="33.5"
          rx="20"
          ry="6.4"
          strokeWidth="4.5"
          transform="rotate(-16 32 33.5)"
        />
      </g>
      <g fill="none" stroke={`url(#${gradId})`} strokeLinecap="round">
        <circle cx="32" cy="31.5" r="12.5" strokeWidth="3" />
        <ellipse
          cx="32"
          cy="33.5"
          rx="20"
          ry="6.4"
          strokeWidth="2.5"
          transform="rotate(-16 32 33.5)"
        />
      </g>
    </svg>
  );
}
