interface HeroIllustrationProps {
  className?: string
}

export function HeroIllustration({ className }: HeroIllustrationProps) {
  return (
    <svg viewBox="0 0 480 480" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* soft background blob */}
      <circle cx="240" cy="248" r="190" fill="#E4F5F0" />
      <circle cx="240" cy="248" r="190" fill="#1E2A5E" fillOpacity="0.03" />

      {/* three-color accent arc (Ethiopian flag colors, used as an abstract accent, not a literal flag) */}
      <g opacity="0.9">
        <circle cx="118" cy="118" r="7" fill="#078930" />
        <circle cx="150" cy="92" r="5.5" fill="#FCDD09" />
        <circle cx="188" cy="76" r="5.5" fill="#DA121A" />
        <circle cx="362" cy="118" r="7" fill="#DA121A" />
        <circle cx="330" cy="92" r="5.5" fill="#FCDD09" />
        <circle cx="292" cy="76" r="5.5" fill="#078930" />
      </g>

      {/* open book */}
      <path
        d="M240 190 C 205 168, 140 162, 96 176 L 96 336 C 140 322, 205 328, 240 350 Z"
        fill="#FFFFFF"
        stroke="#1E2A5E"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <path
        d="M240 190 C 275 168, 340 162, 384 176 L 384 336 C 340 322, 275 328, 240 350 Z"
        fill="#FFFFFF"
        stroke="#1E2A5E"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <path d="M240 190 L 240 350" stroke="#1E2A5E" strokeWidth="4" />
      {/* page lines */}
      <path d="M116 202 L 216 224 M116 232 L 216 254 M116 262 L 216 284" stroke="#2FA88A" strokeWidth="4" strokeLinecap="round" opacity="0.6" />
      <path d="M264 224 L 364 202 M264 254 L 364 232 M264 284 L 364 262" stroke="#2FA88A" strokeWidth="4" strokeLinecap="round" opacity="0.6" />

      {/* graduation cap sitting above the book spine */}
      <g transform="translate(240 118)">
        <path d="M0 -34 L 74 -4 L 0 26 L -74 -4 Z" fill="#1E2A5E" />
        <path d="M-38 6 L -38 34 C -38 48, 38 48, 38 34 L 38 6 L 0 22 Z" fill="#141C42" />
        <line x1="52" y1="-8" x2="52" y2="30" stroke="#1E2A5E" strokeWidth="4" />
        <circle cx="52" cy="34" r="6" fill="#DA121A" />
      </g>

      {/* small ascending progress bars, bottom right — "readiness" motif */}
      <g transform="translate(300 300)">
        <rect x="0" y="40" width="16" height="30" rx="3" fill="#2FA88A" opacity="0.55" />
        <rect x="24" y="24" width="16" height="46" rx="3" fill="#2FA88A" opacity="0.75" />
        <rect x="48" y="4" width="16" height="66" rx="3" fill="#2FA88A" />
      </g>
    </svg>
  )
}
