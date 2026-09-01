interface MasteryRingProps {
  percent: number
  size?: number
  strokeWidth?: number
  label?: string
}

export function MasteryRing({ percent, size = 56, strokeWidth = 5, label }: MasteryRingProps) {
  const validPercent = isNaN(percent) ? 0 : percent
  const clamped = Math.max(0, Math.min(100, validPercent))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference

  const color = clamped >= 75 ? '#2FA88A' : clamped >= 40 ? '#C9762E' : '#C0432F'

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E3E7F1" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <span className="absolute font-display font-semibold text-ink" style={{ fontSize: size * 0.26 }}>
        {label ?? `${Math.round(clamped)}%`}
      </span>
    </div>
  )
}