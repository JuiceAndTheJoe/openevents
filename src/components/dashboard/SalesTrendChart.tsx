'use client'

import Link from 'next/link'
import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'

type SalesTrendChartProps = {
  title: string
  noDataText: string
  data: Array<{ date: string; revenue: number | string | null; ticketsSold?: number | string | null }>
  currency?: string
  showCreateEventCta?: boolean
}

// SVG coordinate system
const VB_W = 820
const VB_H = 300
const M = { top: 16, right: 54, bottom: 44, left: 64 }
const PLOT_W = VB_W - M.left - M.right
const PLOT_H = VB_H - M.top - M.bottom

const REV_COLOR = '#75bc0a'
const TICK_COLOR = '#4a77be'

function niceMax(maxValue: number): number {
  if (maxValue <= 0) return 4
  const intervals = 4 // gives 5 ticks: 0, step, 2*step, 3*step, 4*step
  const rawStep = maxValue / intervals
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const norm = rawStep / magnitude
  let nice: number
  if (norm <= 1) nice = 1
  else if (norm <= 2) nice = 2
  else if (norm <= 2.5) nice = 2.5
  else if (norm <= 5) nice = 5
  else nice = 10
  return nice * magnitude * intervals
}

function yTicks(max: number): number[] {
  const step = max / 4
  return [0, step, step * 2, step * 3, max]
}

function formatRevTick(v: number): string {
  if (v >= 1_000_000) return `${v / 1_000_000}M`
  if (v >= 1000) return `${v / 1000}k`
  return String(v)
}

function shortDate(iso: string): string {
  const parts = iso.split('-')
  if (parts.length < 3) return iso
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[parseInt(parts[1], 10) - 1]} ${parseInt(parts[2], 10)}`
}

function toRevenueValue(value: number | string | null): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function toCountValue(value: number | string | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

type View = 'daily' | 'weekly'

export function SalesTrendChart({ title, noDataText, data, currency = 'SEK', showCreateEventCta = false }: SalesTrendChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const [view, setView] = useState<View>('daily')

  const normalizedData = data.map((d) => ({
    date: d.date,
    revenue: toRevenueValue(d.revenue),
    ticketsSold: toCountValue(d.ticketsSold),
  }))

  const visibleData = view === 'weekly' ? normalizedData.slice(-7) : normalizedData

  const hasData = normalizedData.some((d) => d.revenue > 0 || d.ticketsSold > 0)

  function handleViewChange(next: View) {
    setView(next)
    setHoveredIdx(null)
  }

  const btnClass = (active: boolean) =>
    `text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
      active ? 'bg-[#5c8bd9] text-white' : 'bg-[#E5E7EB] text-[#4A5565]'
    }`

  if (!hasData) {
    return (
      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-md">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500 mt-1">Revenue and ticket sales over time</p>
          </div>
          <div className="flex items-center gap-2">
            <button className={btnClass(view === 'daily')} onClick={() => handleViewChange('daily')}>
              Daily (30 days)
            </button>
            <button className={btnClass(view === 'weekly')} onClick={() => handleViewChange('weekly')}>
              Weekly
            </button>
          </div>
        </div>
        <div className="mt-8 flex flex-col items-center justify-center py-8">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-gray-900 font-medium">{noDataText}</p>
          <p className="mt-1 text-sm text-gray-500 text-center max-w-xs">
            Data will appear here once you receive orders.
          </p>
          {showCreateEventCta && (
            <Link href="/create-event" className="mt-4 inline-flex rounded-md bg-[#5C8BD9] px-4 py-2 text-sm font-medium text-white hover:bg-[#4a7bc9]">
              Create Your First Event
            </Link>
          )}
        </div>
      </section>
    )
  }

  const n = visibleData.length
  const xStep = n > 1 ? PLOT_W / (n - 1) : PLOT_W

  const revMax = niceMax(Math.max(...visibleData.map((d) => d.revenue)))
  const tickMax = niceMax(Math.max(...visibleData.map((d) => d.ticketsSold)))

  const revTicks = yTicks(revMax)
  const tickTicks = yTicks(tickMax)

  const xOf = (i: number) => M.left + i * xStep
  const yOfRev = (v: number) => M.top + PLOT_H - (revMax > 0 ? (v / revMax) * PLOT_H : 0)
  const yOfTick = (v: number) => M.top + PLOT_H - (tickMax > 0 ? (v / tickMax) * PLOT_H : 0)

  const revPath = visibleData
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i).toFixed(1)} ${yOfRev(d.revenue).toFixed(1)}`)
    .join(' ')
  const tickPath = visibleData
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i).toFixed(1)} ${yOfTick(d.ticketsSold).toFixed(1)}`)
    .join(' ')

  // Show date label every N points to avoid crowding
  const labelEvery = Math.ceil(n / 15)

  const hovered = hoveredIdx !== null ? visibleData[hoveredIdx] : null
  const hoveredX = hoveredIdx !== null ? xOf(hoveredIdx) : 0
  // Tooltip flips to left side when near the right edge
  const tooltipFlip = hoveredIdx !== null && hoveredIdx > n * 0.7

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-md">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-2xl font-bold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500 mt-1">Revenue and ticket sales over time</p>
        </div>
        <div className="flex items-center gap-2">
          <button className={btnClass(view === 'daily')} onClick={() => handleViewChange('daily')}>
            Daily (30 days)
          </button>
          <button className={btnClass(view === 'weekly')} onClick={() => handleViewChange('weekly')}>
            Weekly
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="relative" onMouseLeave={() => setHoveredIdx(null)}>
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          width="100%"
          style={{ display: 'block', overflow: 'visible' }}
        >
          {/* Horizontal grid lines */}
          {revTicks.map((v, i) => (
            <line
              key={i}
              x1={M.left}
              x2={M.left + PLOT_W}
              y1={yOfRev(v)}
              y2={yOfRev(v)}
              stroke="#e5e7eb"
              strokeWidth={0.8}
              strokeDasharray="4 3"
            />
          ))}

          {/* Left Y-axis line */}
          <line
            x1={M.left} x2={M.left}
            y1={M.top} y2={M.top + PLOT_H}
            stroke="#d1d5db" strokeWidth={1}
          />

          {/* Left Y-axis ticks & labels */}
          {revTicks.map((v, i) => (
            <text
              key={i}
              x={M.left - 6}
              y={yOfRev(v) + 4}
              textAnchor="end"
              fontSize={11}
              fill="#6b7280"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              {formatRevTick(v)}
            </text>
          ))}

          {/* Left axis title */}
          <text
            x={13}
            y={M.top + PLOT_H / 2}
            textAnchor="middle"
            fontSize={11}
            fill="#808080"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            transform={`rotate(-90 13 ${M.top + PLOT_H / 2})`}
          >
            Revenue ({currency})
          </text>

          {/* Right Y-axis line */}
          <line
            x1={M.left + PLOT_W} x2={M.left + PLOT_W}
            y1={M.top} y2={M.top + PLOT_H}
            stroke="#d1d5db" strokeWidth={1}
          />

          {/* Right Y-axis ticks & labels */}
          {tickTicks.map((v, i) => (
            <text
              key={i}
              x={M.left + PLOT_W + 6}
              y={yOfTick(v) + 4}
              textAnchor="start"
              fontSize={11}
              fill="#6b7280"
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              {v}
            </text>
          ))}

          {/* Right axis title */}
          <text
            x={VB_W - 11}
            y={M.top + PLOT_H / 2}
            textAnchor="middle"
            fontSize={11}
            fill="#808080"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            transform={`rotate(90 ${VB_W - 11} ${M.top + PLOT_H / 2})`}
          >
            Tickets
          </text>

          {/* X-axis line */}
          <line
            x1={M.left} x2={M.left + PLOT_W}
            y1={M.top + PLOT_H} y2={M.top + PLOT_H}
            stroke="#d1d5db" strokeWidth={1}
          />

          {/* X-axis date labels */}
          {visibleData.map((d, i) => {
            const lastRegular = Math.floor((n - 1) / labelEvery) * labelEvery
            const showLast = i === n - 1 && n - 1 - lastRegular >= labelEvery
            if (i % labelEvery !== 0 && !showLast) return null
            return (
              <text
                key={i}
                x={xOf(i)}
                y={M.top + PLOT_H + 14}
                textAnchor="middle"
                fontSize={11}
                fill="#6b7280"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
              >
                {shortDate(d.date)}
              </text>
            )
          })}

          {/* Revenue line */}
          <path
            d={revPath}
            fill="none"
            stroke={REV_COLOR}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Tickets line */}
          <path
            d={tickPath}
            fill="none"
            stroke={TICK_COLOR}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Revenue dots (squares) */}
          {visibleData.map((d, i) => (
            <rect
              key={i}
              x={xOf(i) - 4}
              y={yOfRev(d.revenue) - 4}
              width={8}
              height={8}
              fill={REV_COLOR}
              stroke="white"
              strokeWidth={1.5}
              style={{ pointerEvents: 'none' }}
            />
          ))}

          {/* Tickets dots (circles) */}
          {visibleData.map((d, i) => (
            <circle
              key={i}
              cx={xOf(i)}
              cy={yOfTick(d.ticketsSold)}
              r={4}
              fill={TICK_COLOR}
              stroke="white"
              strokeWidth={1.5}
              style={{ pointerEvents: 'none' }}
            />
          ))}

          {/* Hover crosshair */}
          {hoveredIdx !== null && (
            <line
              x1={hoveredX} x2={hoveredX}
              y1={M.top} y2={M.top + PLOT_H}
              stroke="#9ca3af"
              strokeWidth={1}
              strokeDasharray="4 2"
              style={{ pointerEvents: 'none' }}
            />
          )}

          {/* Invisible hover zones (one per data point) */}
          {visibleData.map((_, i) => {
            const x = xOf(i)
            const zoneW = xStep
            const zoneX = i === 0 ? M.left : x - zoneW / 2
            return (
              <rect
                key={i}
                x={zoneX}
                y={M.top}
                width={i === 0 || i === n - 1 ? zoneW / 2 : zoneW}
                height={PLOT_H}
                fill="transparent"
                onMouseEnter={() => setHoveredIdx(i)}
                style={{ cursor: 'crosshair' }}
              />
            )
          })}
        </svg>

        {/* Tooltip */}
        {hoveredIdx !== null && hovered && (
          <div
            className="absolute top-4 z-10 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg text-sm pointer-events-none"
            style={{
              left: tooltipFlip
                ? `calc(${((hoveredX / VB_W) * 100).toFixed(1)}% - 8px)`
                : `calc(${((hoveredX / VB_W) * 100).toFixed(1)}% + 8px)`,
              transform: tooltipFlip ? 'translateX(-100%)' : 'none',
            }}
          >
            <p className="font-semibold text-gray-700 mb-1.5">{shortDate(hovered.date)}</p>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-3 shrink-0 rounded-sm" style={{ background: REV_COLOR }} />
              <span className="text-gray-600">{formatCurrency(hovered.revenue, currency)}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-block w-3 h-3 shrink-0 rounded-full" style={{ background: TICK_COLOR }} />
              <span className="text-gray-600">{hovered.ticketsSold} tickets</span>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-3">
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 shrink-0 rounded-sm" style={{ background: REV_COLOR }} />
          <span className="text-sm" style={{ color: REV_COLOR }}>Revenue ({currency})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 shrink-0 rounded-full" style={{ background: TICK_COLOR }} />
          <span className="text-sm" style={{ color: TICK_COLOR }}>Tickets Sold</span>
        </div>
      </div>
    </section>
  )
}
