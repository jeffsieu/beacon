interface Props {
  percent: number
  size?: number
  strokeWidth?: number
  color?: string
}

export default function ProgressRing({ percent, size = 80, strokeWidth = 6, color = 'var(--c-accent)' }: Props) {
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const clamped = Math.min(100, Math.max(0, percent))
  const offset = circ * (1 - clamped / 100)
  const cx = size / 2

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--c-border)" strokeWidth={strokeWidth} />
      <circle
        cx={cx} cy={cx} r={r} fill="none"
        stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cx})`}
        style={{ transition: 'stroke-dashoffset 0.4s ease' }}
      />
    </svg>
  )
}
