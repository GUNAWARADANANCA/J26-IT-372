function extent(values) {
  const numbers = values.filter((value) => Number.isFinite(value))
  if (!numbers.length) return [0, 1]
  const low = Math.min(...numbers)
  const high = Math.max(...numbers)
  if (low === high) return [low - 1, high + 1]
  const pad = (high - low) * 0.08
  return [low - pad, high + pad]
}

export function ChartLegend({ items }) {
  return (
    <p className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
      {items.map((item) => (
        <span key={item.label}>
          <span className="mr-1 inline-block h-2 w-4 align-middle" style={{ background: item.color, borderBottom: item.dashed ? '2px dashed #2f6fed' : undefined }} />
          {item.label}
        </span>
      ))}
    </p>
  )
}

function pieSlice(cx, cy, radius, start, end) {
  const large = end - start > Math.PI ? 1 : 0
  const x1 = cx + radius * Math.cos(start)
  const y1 = cy + radius * Math.sin(start)
  const x2 = cx + radius * Math.cos(end)
  const y2 = cy + radius * Math.sin(end)
  return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`
}

export function WorkPie({ completed, remaining, assigned, percent, ariaLabel, className = 'h-40 w-40' }) {
  const slices = [
    { name: 'Completed', value: Number(completed) || 0, color: '#0f766e' },
    { name: 'Remaining', value: Number(remaining) || 0, color: '#94a3b8' },
  ].filter((item) => item.value > 0)
  const total = slices.reduce((sum, item) => sum + item.value, 0)
  if (!total) return <p className="text-sm text-slate-500">No work counts to chart.</p>
  const cx = 110
  const cy = 110
  const radius = 78
  const gap = slices.length > 1 ? 0.03 : 0
  let cursor = -Math.PI / 2
  const drawn = slices.map((item) => {
    const sweep = (item.value / total) * Math.PI * 2
    const start = cursor + gap / 2
    const end = cursor + sweep - gap / 2
    cursor += sweep
    const mid = (start + end) / 2
    return {
      ...item,
      path: pieSlice(cx, cy, radius, start, Math.max(end, start + 0.01)),
      labelX: cx + (radius + 18) * Math.cos(mid),
      labelY: cy + (radius + 18) * Math.sin(mid),
      share: Math.round((item.value / total) * 1000) / 10,
    }
  })
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <svg viewBox="0 0 220 220" className={className} role="img" aria-label={ariaLabel}>
        {drawn.map((item) => (
          <g key={item.name}>
            <path d={item.path} fill={item.color}>
              <title>{`${item.name}: ${item.value} of ${assigned} (${item.share}%)`}</title>
            </path>
            <text x={item.labelX} y={item.labelY} textAnchor="middle" fontSize="11" fill="#12315c">{drawn.length > 1 ? `${item.share}%` : ''}</text>
          </g>
        ))}
      </svg>
      <dl className="grid w-full max-w-xs grid-cols-3 gap-2 text-center sm:grid-cols-1 sm:text-left">
        <div className="rounded-lg bg-teal-50 px-3 py-2">
          <dt className="text-xs text-slate-500">Completed</dt>
          <dd className="text-lg font-semibold text-[#0f766e]">{completed}</dd>
        </div>
        <div className="rounded-lg bg-slate-100 px-3 py-2">
          <dt className="text-xs text-slate-500">Remaining</dt>
          <dd className="text-lg font-semibold text-[#12315c]">{remaining}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 px-3 py-2">
          <dt className="text-xs text-slate-500">Assigned</dt>
          <dd className="text-lg font-semibold text-[#12315c]">{assigned}</dd>
          <dd className="text-xs text-slate-500">{percent == null ? 'Rate not available' : `${percent}% complete`}</dd>
        </div>
      </dl>
    </div>
  )
}

export function Donut({ slices, ariaLabel, centerLabel, centerValue, className = 'h-36 w-36' }) {
  const total = slices.reduce((sum, item) => sum + (Number(item.value) || 0), 0)
  if (!total) return <p className="py-4 text-center text-sm text-[#64748B]">No records available to display chart.</p>
  const radius = 42
  const circumference = 2 * Math.PI * radius
  let offset = 0
  return (
    <div className="flex flex-col items-center justify-around gap-4 sm:flex-row">
      <div className="relative flex shrink-0 items-center justify-center">
        <svg viewBox="0 0 120 120" className={className} role="img" aria-label={ariaLabel}>
          {slices.map((item) => {
            const value = Number(item.value) || 0
            if (value <= 0) return null
            const length = (value / total) * circumference
            const circle = (
              <circle
                key={item.name}
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth="14"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 60 60)"
                strokeLinecap="round"
              >
                <title>{`${item.name}: ${value} (${Math.round((value / total) * 100)}%)`}</title>
              </circle>
            )
            offset += length
            return circle
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xl font-bold tracking-tight text-[#172B4D]">
            {centerValue !== undefined ? centerValue : total}
          </span>
          <span className="text-[10px] font-medium text-[#64748B] uppercase">
            {centerLabel || 'Total'}
          </span>
        </div>
      </div>
      <ul className="space-y-1.5 text-xs text-[#172B4D] w-full max-w-[200px]">
        {slices.map((item) => {
          const val = Number(item.value) || 0
          const pct = total ? Math.round((val / total) * 100) : 0
          return (
            <li key={item.name} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 truncate">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="truncate text-[#64748B]">{item.name}</span>
              </span>
              <span className="font-semibold text-[#172B4D]">
                {val} <span className="font-normal text-[#64748B]/70 text-[10px]">({pct}%)</span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}


export function HorizontalStack({ rows, keys, ariaLabel, percent = false }) {
  if (!rows.length) return <p className="text-sm text-slate-500">No rows to chart.</p>
  return (
    <div className="space-y-3" role="img" aria-label={ariaLabel}>
      {rows.map((row) => {
        const parts = keys.map((item) => ({ ...item, value: Number(row[item.key]) || 0 }))
        const total = parts.reduce((sum, item) => sum + item.value, 0)
        return (
          <div key={row.label}>
            <div className="mb-1 flex justify-between text-xs text-[#12315c]">
              <span>{row.label}</span>
              <span>{percent ? (total ? '100%' : 'No assigned work') : total}</span>
            </div>
            <div className="flex h-4 overflow-hidden rounded-full bg-slate-100" title={parts.map((item) => `${item.name}: ${item.value}`).join(', ')}>
              {total === 0 ? null : parts.map((item) => (
                <div key={item.key} style={{ width: `${(item.value / total) * 100}%`, background: item.color }} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function LineChart({ labels, series, ariaLabel, className = 'h-56 w-full' }) {
  if (!labels.length) return <p className="text-sm text-slate-500">No points to chart.</p>
  const width = 680
  const height = 220
  const pad = { left: 36, right: 12, top: 16, bottom: 28 }
  const values = series.flatMap((item) => item.points)
  const [low, high] = extent(values)
  const xAt = (index) => pad.left + (index * (width - pad.left - pad.right)) / Math.max(labels.length - 1, 1)
  const yAt = (value) => pad.top + ((high - value) / (high - low || 1)) * (height - pad.top - pad.bottom)
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} className={className}>
      {[0, 0.5, 1].map((step) => {
        const value = low + (high - low) * (1 - step)
        const y = pad.top + step * (height - pad.top - pad.bottom)
        return (
          <g key={step}>
            <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#e2e8f0" />
            <text x="4" y={y + 4} fontSize="10" fill="#64748b">{value.toFixed(0)}</text>
          </g>
        )
      })}
      {series.map((item) => (
        <g key={item.name}>
          <polyline
            fill="none"
            stroke={item.color}
            strokeWidth="2.5"
            strokeDasharray={item.dashed ? '6 4' : undefined}
            points={item.points.map((value, index) => (Number.isFinite(value) ? `${xAt(index)},${yAt(value)}` : null)).filter(Boolean).join(' ')}
          />
          {item.points.map((value, index) => (
            Number.isFinite(value) ? (
              <circle key={`${item.name}-${index}`} cx={xAt(index)} cy={yAt(value)} r="3.5" fill={item.color}>
                <title>{`${labels[index]} · ${item.name}: ${value}`}</title>
              </circle>
            ) : null
          ))}
        </g>
      ))}
      {labels.map((label, index) => (
        index % Math.ceil(labels.length / 6) === 0 ? (
          <text key={`${label}-${index}`} x={xAt(index)} y={height - 8} fontSize="10" textAnchor="middle" fill="#64748b">{label}</text>
        ) : null
      ))}
    </svg>
  )
}

export function GroupedBars({ groups, series, ariaLabel, className = 'h-56 w-full' }) {
  if (!groups.length) return <p className="text-sm text-slate-500">No bars to chart.</p>
  const width = 680
  const height = 220
  const pad = { left: 36, right: 12, top: 12, bottom: 36 }
  const values = groups.flatMap((group) => group.values.filter((value) => Number.isFinite(value)))
  const high = Math.max(...values, 1)
  const slot = (width - pad.left - pad.right) / groups.length
  const bar = Math.min(16, (slot - 8) / series.length)
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} className={className}>
      {groups.map((group, index) => (
        <g key={`${group.label}-${index}`}>
          {group.values.map((value, seriesIndex) => {
            if (!Number.isFinite(value)) return null
            const barHeight = (value / high) * (height - pad.top - pad.bottom)
            const x = pad.left + index * slot + 4 + seriesIndex * (bar + 2)
            const y = height - pad.bottom - barHeight
            return (
              <rect key={series[seriesIndex].name} x={x} y={y} width={bar} height={barHeight} rx="2" fill={series[seriesIndex].color}>
                <title>{`${group.label} · ${series[seriesIndex].name}: ${value}`}</title>
              </rect>
            )
          })}
          <text x={pad.left + index * slot + slot / 2} y={height - 14} fontSize="10" textAnchor="middle" fill="#64748b">{group.label}</text>
        </g>
      ))}
    </svg>
  )
}

export function Histogram({ values, ariaLabel, caption }) {
  const bins = Array.from({ length: 10 }, (_, index) => ({ label: `${index * 10}`, count: 0 }))
  values.forEach((value) => {
    if (!Number.isFinite(value)) return
    const index = Math.min(9, Math.max(0, Math.floor(value / 10)))
    bins[index].count += 1
  })
  const high = Math.max(...bins.map((bin) => bin.count), 1)
  return (
    <div>
      <svg viewBox="0 0 640 180" role="img" aria-label={ariaLabel} className="h-48 w-full">
        {bins.map((bin, index) => {
          const height = (bin.count / high) * 130
          return (
            <g key={bin.label}>
              <rect x={24 + index * 60} y={150 - height} width="40" height={height} rx="3" fill="#2f6fed">
                <title>{`${bin.label}–${Number(bin.label) + 10}: ${bin.count}`}</title>
              </rect>
              <text x={44 + index * 60} y="168" fontSize="10" textAnchor="middle" fill="#64748b">{bin.label}</text>
            </g>
          )
        })}
      </svg>
      {caption ? <p className="text-xs text-slate-500">{caption}</p> : null}
    </div>
  )
}

export function Heatmap({ cells, ariaLabel }) {
  const numbers = cells.map((cell) => cell.value).filter((value) => Number.isFinite(value))
  const high = Math.max(...numbers, 1)
  return (
    <div className="grid grid-cols-7 gap-2" role="img" aria-label={ariaLabel}>
      {cells.map((cell) => {
        const shade = Number.isFinite(cell.value) ? 0.15 + (cell.value / high) * 0.85 : 0
        return (
          <div key={cell.label} className="rounded-lg border border-slate-200 p-2 text-center" style={{ background: `rgba(47, 111, 237, ${shade})` }} title={Number.isFinite(cell.value) ? `${cell.label}: ${cell.value}` : `${cell.label}: no record`}>
            <p className="text-[10px] text-slate-700">{cell.label.slice(0, 3)}</p>
            <p className="text-sm font-semibold text-slate-900">{Number.isFinite(cell.value) ? cell.value : '—'}</p>
          </div>
        )
      })}
    </div>
  )
}

export function ImportanceBars({ features }) {
  const top = features.slice(0, 8)
  const high = Math.max(...top.map((item) => item.importance), 0.01)
  return (
    <div className="space-y-2">
      {top.map((item) => (
        <div key={item.name}>
          <div className="mb-1 flex justify-between text-xs text-slate-600">
            <span>{item.name}</span>
            <span>{item.importance}</span>
          </div>
          <div className="h-2 rounded bg-slate-100">
            <div className="h-2 rounded bg-[#12315c]" style={{ width: `${(item.importance / high) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}
