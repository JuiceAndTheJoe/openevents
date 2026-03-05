'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Category = { id: string; name: string; slug: string }

type HeroSearchBarProps = {
  categories: Category[]
  showCategoryPills?: boolean
  initial?: {
    search?: string
    dateFrom?: string
    dateTo?: string
    location?: string
    category?: string
  }
}

export function HeroSearchBar({ categories, showCategoryPills = true, initial }: HeroSearchBarProps) {
  const router = useRouter()

  const [search, setSearch] = useState(initial?.search ?? '')
  const [dateFrom, setDateFrom] = useState<Date | null>(
    initial?.dateFrom ? new Date(initial.dateFrom) : null
  )
  const [dateTo, setDateTo] = useState<Date | null>(
    initial?.dateTo ? new Date(initial.dateTo) : null
  )
  const [location, setLocation] = useState(initial?.location ?? '')
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    initial?.category ? (categories.find(c => c.slug === initial.category) ?? null) : null
  )
  const [openPanel, setOpenPanel] = useState<'date' | 'location' | 'category' | null>(null)
  const [calendarDate, setCalendarDate] = useState(
    initial?.dateFrom ? new Date(initial.dateFrom) : new Date()
  )

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenPanel(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const togglePanel = (panel: 'date' | 'location' | 'category') => {
    setOpenPanel(prev => (prev === panel ? null : panel))
  }

  const handleSearch = () => {
    const params = new URLSearchParams()
    if (search.trim()) params.set('search', search.trim())
    if (dateFrom) params.set('startDate', dateFrom.toISOString().split('T')[0])
    if (dateTo) params.set('endDate', dateTo.toISOString().split('T')[0])
    if (location.trim()) params.set('location', location.trim())
    if (selectedCategory) params.set('category', selectedCategory.slug)
    router.push(`/events${params.toString() ? '?' + params.toString() : ''}`)
  }

  // ── Calendar helpers ──────────────────────────────────────────────────────
  const year = calendarDate.getFullYear()
  const month = calendarDate.getMonth()

  // Locale-aware month label
  const monthLabel = new Intl.DateTimeFormat('en', { month: 'long' }).format(calendarDate)

  // Locale-aware weekday abbreviations (Sunday-first)
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat('en', { weekday: 'short' }).format(new Date(2024, 0, 7 + i))
  )

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startDay = new Date(year, month, 1).getDay()

  const calendarCells: (number | null)[] = [
    ...Array(startDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (calendarCells.length % 7 !== 0) calendarCells.push(null)

  const today = new Date()
  const isToday = (d: number) =>
    today.getFullYear() === year &&
    today.getMonth() === month &&
    today.getDate() === d

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()

  const isRangeStart = (d: number) => !!dateFrom && isSameDay(dateFrom, new Date(year, month, d))
  const isRangeEnd = (d: number) => !!dateTo && isSameDay(dateTo, new Date(year, month, d))
  const isInRange = (d: number) => {
    if (!dateFrom || !dateTo) return false
    const t = new Date(year, month, d).getTime()
    return t > dateFrom.getTime() && t < dateTo.getTime()
  }

  const selectDay = (d: number) => {
    const clicked = new Date(year, month, d)
    if (!dateFrom || dateTo) {
      // Start a fresh selection
      setDateFrom(clicked)
      setDateTo(null)
    } else {
      // dateFrom set, awaiting dateTo
      if (clicked >= dateFrom) {
        setDateTo(clicked)
        setOpenPanel(null)
        const params = new URLSearchParams()
        if (search.trim()) params.set('search', search.trim())
        params.set('startDate', dateFrom.toISOString().split('T')[0])
        params.set('endDate', clicked.toISOString().split('T')[0])
        if (location.trim()) params.set('location', location.trim())
        if (selectedCategory) params.set('category', selectedCategory.slug)
        router.push(`/events?${params.toString()}`)
      } else {
        // Clicked before dateFrom — restart with new dateFrom
        setDateFrom(clicked)
        setDateTo(null)
      }
    }
  }

  const formatShort = (d: Date) =>
    new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(d)

  const dateLabel = dateFrom && dateTo
    ? `${formatShort(dateFrom)} – ${formatShort(dateTo)}`
    : dateFrom
      ? `From ${formatShort(dateFrom)}`
      : 'Date'

  return (
    <div ref={containerRef}>
      {/* ── Pill bar ───────────────────────────────────────────────────────── */}
      <div className="flex items-center bg-[#f2f2f4] rounded-[29px] h-[58px] px-3">
        {/* Search text */}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Search for events"
          className="flex-1 min-w-0 bg-transparent outline-none text-[16px] text-black placeholder-[#828283] px-4 font-['Outfit',sans-serif]"
        />

        {/* ── Date ─────────────────────────────────────────────────────────── */}
        <div className="relative flex items-center h-full">
          <div className="h-6 w-px bg-[#d1d5dc] shrink-0" />
          <button
            onClick={() => togglePanel('date')}
            className="flex items-center gap-1.5 px-5 py-2 text-[16px] text-black rounded-full hover:bg-black/[0.06] transition-colors whitespace-nowrap font-['Outfit',sans-serif]"
          >
            {dateLabel}
            <ChevronDown />
          </button>

          {openPanel === 'date' && (
            <div className="absolute top-[calc(100%+12px)] left-0 z-50 bg-white rounded-2xl shadow-2xl p-5 w-[320px]">
              {/* Step hint */}
              <p className="text-[12px] font-semibold text-[#5c8bd9] uppercase tracking-wide mb-3">
                {!dateFrom || dateTo ? 'Select start date' : 'Select end date'}
              </p>
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setCalendarDate(new Date(year, month - 1, 1))}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                  aria-label="Previous month"
                >
                  <ChevronLeft />
                </button>
                <span className="font-semibold text-gray-900 text-[15px]">
                  {monthLabel} {year}
                </span>
                <button
                  onClick={() => setCalendarDate(new Date(year, month + 1, 1))}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
                  aria-label="Next month"
                >
                  <ChevronRight />
                </button>
              </div>

              {/* Weekday headers */}
              <div className="grid grid-cols-7 mb-1">
                {weekdays.map(d => (
                  <div key={d} className="text-center text-[11px] font-semibold text-gray-400 py-1 uppercase tracking-wide">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day grid */}
              <div className="grid grid-cols-7">
                {calendarCells.map((day, i) => {
                  if (!day) return <div key={i} className="h-10" />
                  const start = isRangeStart(day)
                  const end = isRangeEnd(day)
                  const inRange = isInRange(day)
                  const singleDay = start && end
                  return (
                    <div
                      key={i}
                      className={`relative h-10 flex items-center justify-center
                        ${!singleDay && (inRange || (start && dateTo) || (end && dateFrom))
                          ? 'bg-[#5c8bd9]/15' : ''}
                        ${!singleDay && start && dateTo ? 'rounded-l-full' : ''}
                        ${!singleDay && end ? 'rounded-r-full' : ''}
                      `}
                    >
                      <button
                        onClick={() => selectDay(day)}
                        className={`w-9 h-9 rounded-full text-[14px] font-medium transition-colors flex items-center justify-center z-10
                          ${start || end
                            ? 'bg-[#5c8bd9] text-white'
                            : inRange
                              ? 'text-[#5c8bd9] hover:bg-[#5c8bd9]/25'
                              : isToday(day)
                                ? 'border-2 border-[#5c8bd9] text-[#5c8bd9] hover:bg-[#5c8bd9]/10'
                                : 'text-gray-800 hover:bg-gray-100'
                          }`}
                      >
                        {day}
                      </button>
                    </div>
                  )
                })}
              </div>

              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(null); setDateTo(null) }}
                  className="mt-4 w-full text-center text-[13px] font-medium text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 rounded-lg transition-colors py-2"
                >
                  Clear dates
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Location ─────────────────────────────────────────────────────── */}
        <div className="relative flex items-center h-full">
          <div className="h-6 w-px bg-[#d1d5dc] shrink-0" />
          <button
            onClick={() => togglePanel('location')}
            className="flex items-center gap-1.5 px-5 py-2 text-[16px] text-black rounded-full hover:bg-black/[0.06] transition-colors whitespace-nowrap max-w-[160px] font-['Outfit',sans-serif]"
          >
            <span className="truncate">{location || 'Location'}</span>
            <ChevronDown />
          </button>

          {openPanel === 'location' && (
            <div className="absolute top-[calc(100%+12px)] left-0 z-50 bg-white rounded-2xl shadow-2xl p-5 w-[280px]">
              <label className="block text-[13px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Location
              </label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { setOpenPanel(null); handleSearch() }
                }}
                placeholder="City, venue, country..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-[#5c8bd9] focus:border-transparent"
                autoFocus
              />
              {location && (
                <button
                  onClick={() => setLocation('')}
                  className="mt-2 text-[13px] text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Category ─────────────────────────────────────────────────────── */}
        <div className="relative flex items-center h-full">
          <div className="h-6 w-px bg-[#d1d5dc] shrink-0" />
          <button
            onClick={() => togglePanel('category')}
            className="flex items-center gap-1.5 px-5 py-2 text-[16px] text-black rounded-full hover:bg-black/[0.06] transition-colors whitespace-nowrap font-['Outfit',sans-serif]"
          >
            {selectedCategory?.name || 'Category'}
            <ChevronDown />
          </button>

          {openPanel === 'category' && (
            <div className="absolute top-[calc(100%+12px)] right-0 z-50 bg-white rounded-2xl shadow-2xl py-2 w-[220px] max-h-72 overflow-y-auto">
              <button
                onClick={() => { setSelectedCategory(null); setOpenPanel(null) }}
                className={`w-full text-left px-4 py-3 text-[14px] transition-colors hover:bg-gray-50
                  ${!selectedCategory ? 'font-semibold text-[#5c8bd9]' : 'text-gray-700'}`}
              >
                All Categories
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategory(cat)
                    setOpenPanel(null)
                    // Immediately navigate with category filter (#204)
                    const params = new URLSearchParams()
                    if (search.trim()) params.set('search', search.trim())
                    if (dateFrom) params.set('startDate', dateFrom.toISOString().split('T')[0])
                    if (dateTo) params.set('endDate', dateTo.toISOString().split('T')[0])
                    if (location.trim()) params.set('location', location.trim())
                    params.set('category', cat.slug)
                    router.push(`/events?${params.toString()}`)
                  }}
                  className={`w-full text-left px-4 py-3 text-[14px] transition-colors hover:bg-gray-50
                    ${selectedCategory?.id === cat.id ? 'font-semibold text-[#5c8bd9]' : 'text-gray-700'}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Search icon ───────────────────────────────────────────────────── */}
        <button
          onClick={handleSearch}
          aria-label="Search events"
          className="ml-2 mr-1 w-10 h-10 flex items-center justify-center rounded-full hover:bg-black/[0.06] transition-colors shrink-0 text-gray-600"
        >
          <SearchIcon />
        </button>
      </div>

      {/* ── Category pills ─────────────────────────────────────────────────── */}
      {showCategoryPills && <div className="flex items-center gap-4 mt-3 overflow-x-auto pb-1 scrollbar-hide">
        <FilterIcon />
        <div className="flex items-center gap-3 flex-nowrap">
          <button
            onClick={() => {
              setSelectedCategory(null)
              const params = new URLSearchParams()
              if (search.trim()) params.set('search', search.trim())
              if (dateFrom) params.set('startDate', dateFrom.toISOString().split('T')[0])
              if (dateTo) params.set('endDate', dateTo.toISOString().split('T')[0])
              if (location.trim()) params.set('location', location.trim())
              router.push(`/events${params.toString() ? '?' + params.toString() : ''}`)
            }}
            className={`h-10 px-5 rounded-full text-[16px] font-medium font-['Outfit',sans-serif] whitespace-nowrap transition-colors shrink-0
              ${!selectedCategory
                ? 'bg-[#5c8bd9] text-white shadow-md'
                : 'bg-[#f3f4f6] text-[#364153] hover:bg-[#e8eaed]'
              }`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat)
                const params = new URLSearchParams()
                if (search.trim()) params.set('search', search.trim())
                if (dateFrom) params.set('startDate', dateFrom.toISOString().split('T')[0])
                if (dateTo) params.set('endDate', dateTo.toISOString().split('T')[0])
                if (location.trim()) params.set('location', location.trim())
                params.set('category', cat.slug)
                router.push(`/events?${params.toString()}`)
              }}
              className={`h-10 px-5 rounded-full text-[16px] font-medium font-['Outfit',sans-serif] whitespace-nowrap transition-colors shrink-0
                ${selectedCategory?.id === cat.id
                  ? 'bg-[#5c8bd9] text-white shadow-md'
                  : 'bg-[#f3f4f6] text-[#364153] hover:bg-[#e8eaed]'
                }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>}
    </div>
  )
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────

function FilterIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-[#364153]">
      <path d="M22 3H2l8 9.46V19l4 2V12.46L22 3z" />
    </svg>
  )
}

function ChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}
