import type { HandicapDataPoint } from '@/lib/supabase/player-profile-actions'

interface HandicapChartProps {
  data: HandicapDataPoint[]
}

export function HandicapChart({ data }: HandicapChartProps) {
  if (data.length < 2) {
    return null
  }

  const width = 320
  const height = 100
  const paddingX = 8
  const paddingY = 12

  const chartWidth = width - paddingX * 2
  const chartHeight = height - paddingY * 2

  const handicaps = data.map(d => d.handicap)
  const minVal = Math.min(...handicaps) - 1
  const maxVal = Math.max(...handicaps) + 1
  const range = maxVal - minVal || 1

  // Build points
  const points = data.map((d, i) => {
    const x = paddingX + (i / (data.length - 1)) * chartWidth
    const y = paddingY + chartHeight - ((d.handicap - minVal) / range) * chartHeight
    return { x, y, handicap: d.handicap, tripName: d.tripName }
  })

  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ')

  // Gradient fill path
  const areaPath = [
    `M ${points[0].x},${paddingY + chartHeight}`,
    `L ${points[0].x},${points[0].y}`,
    ...points.slice(1).map(p => `L ${p.x},${p.y}`),
    `L ${points[points.length - 1].x},${paddingY + chartHeight}`,
    'Z',
  ].join(' ')

  const currentHandicap = data[data.length - 1].handicap
  const previousHandicap = data[data.length - 2].handicap
  const trend = currentHandicap - previousHandicap
  const trendColor = trend < 0 ? '#10B981' : trend > 0 ? '#EF4444' : '#A1A1AA'

  return (
    <div className="rounded-card-sm bg-bg-2 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wide text-text-2">
          Handicap Trend
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-text-0">
            {currentHandicap.toFixed(1)}
          </span>
          {trend !== 0 && (
            <span
              className="text-xs font-medium"
              style={{ color: trendColor }}
            >
              {trend > 0 ? '↑' : '↓'}{Math.abs(trend).toFixed(1)}
            </span>
          )}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="hcp-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.5, 1].map((pct, i) => (
          <line
            key={i}
            x1={paddingX}
            y1={paddingY + chartHeight * pct}
            x2={width - paddingX}
            y2={paddingY + chartHeight * pct}
            stroke="#3A3A3C"
            strokeWidth="0.5"
            strokeDasharray="4 4"
          />
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="url(#hcp-gradient)" />

        {/* Line */}
        <polyline
          points={polylinePoints}
          fill="none"
          stroke="#F59E0B"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dots */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3"
            fill="#0A0A0A"
            stroke="#F59E0B"
            strokeWidth="1.5"
          />
        ))}

        {/* Min/max labels */}
        <text
          x={width - paddingX}
          y={paddingY - 2}
          textAnchor="end"
          className="fill-text-2"
          fontSize="9"
        >
          {maxVal.toFixed(1)}
        </text>
        <text
          x={width - paddingX}
          y={paddingY + chartHeight + 10}
          textAnchor="end"
          className="fill-text-2"
          fontSize="9"
        >
          {minVal.toFixed(1)}
        </text>
      </svg>
      <div className="mt-1 flex justify-between text-[9px] text-text-2">
        {data.length <= 5 ? (
          data.map((d, i) => (
            <span key={i} className="truncate max-w-[60px]">{d.tripName}</span>
          ))
        ) : (
          <>
            <span className="truncate max-w-[60px]">{data[0].tripName}</span>
            <span className="truncate max-w-[60px]">{data[data.length - 1].tripName}</span>
          </>
        )}
      </div>
    </div>
  )
}
