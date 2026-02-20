'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Category = { id: string; name: string; slug: string }

export function HeroSearchBar({ categories }: { categories: Category[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [location, setLocation] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [openPanel, setOpenPanel] = useState<'date' | 'location' | 'category' | null>(null)
  const [calendarDate, setCalendarDate] = useState(new Date())

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
    if (selectedDate) params.set('startDate', selectedDate.toISOString().split('T')[0])
    if (location.trim()) params.set('location', location.trim())
    if (selectedCategory) params.set('category', selectedCategory.slug)
    router.push(`/events${params.toString() ? '?' + params.toString() : ''}`)
  }

  // ── Calendar helpers ──────────────────────────────────────────────────────
  const year = calendarDate.getFullYear()
  const month = calendarDate.getMonth()
  const monthLabel = calendarDate.toLocaleString('default', { month: 'long' })

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startDay = new Date(year, month, 1).getDay()

  const calendarCells: (number | null)[] = [
    ...Array(startDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (calendarCells.length % 7 !== 0) calendarCells.push(null)

  const today = new Date()
  const isSelectedDay = (d: number) =>
    selectedDate?.getFullYear() === year &&
    selectedDate?.getMonth() === month &&
    selectedDate?.getDate() === d
  const isToday = (d: number) =>
    today.getFullYear() === year &&
    today.getMonth() === month &&
    today.getDate() === d

  const selectDay = (d: number) => {
    setSelectedDate(new Date(year, month, d))
    setOpenPanel(null)
  }

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div ref={containerRef} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      {/* ── Pill bar ───────────────────────────────────────────────────────── */}
      <div className="flex items-center bg-[#f0f0f0] rounded-[29px] h-[58px] px-3">
        {/* Search text */}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Search for events"
          className="flex-1 min-w-0 bg-transparent outline-none text-[16px] text-black placeholder-gray-500 px-4"
        />

        {/* ── Date ─────────────────────────────────────────────────────────── */}
        <div className="relative flex items-center h-full">
          <div className="h-6 w-px bg-gray-300 shrink-0" />
          <button
            onClick={() => togglePanel('date')}
            className="flex items-center gap-1.5 px-5 py-2 text-[16px] text-black rounded-full hover:bg-black/[0.06] transition-colors whitespace-nowrap"
          >
            {selectedDate ? formatDate(selectedDate) : 'Date'}
            <ChevronDown />
          </button>

          {openPanel === 'date' && (
            <div className="absolute top-[calc(100%+12px)] left-0 z-50 bg-white rounded-2xl shadow-2xl p-5 w-[320px]">
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
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                  <div key={d} className="text-center text-[11px] font-semibold text-gray-400 py-1 uppercase tracking-wide">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day grid */}
              <div className="grid grid-cols-7 gap-y-0.5">
                {calendarCells.map((day, i) => (
                  <div key={i} className="flex justify-center">
                    {day ? (
                      <button
                        onClick={() => selectDay(day)}
                        className={`w-10 h-10 rounded-full text-[14px] font-medium transition-colors flex items-center justify-center
                          ${isSelectedDay(day)
                            ? 'bg-blue-600 text-white'
                            : isToday(day)
                              ? 'border-2 border-blue-500 text-blue-600 hover:bg-blue-50'
                              : 'text-gray-800 hover:bg-gray-100'
                          }`}
                      >
                        {day}
                      </button>
                    ) : (
                      <div className="w-10 h-10" />
                    )}
                  </div>
                ))}
              </div>

              {selectedDate && (
                <button
                  onClick={() => setSelectedDate(null)}
                  className="mt-3 w-full text-center text-[13px] text-gray-400 hover:text-gray-600 transition-colors py-1"
                >
                  Clear date
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Location ─────────────────────────────────────────────────────── */}
        <div className="relative flex items-center h-full">
          <div className="h-6 w-px bg-gray-300 shrink-0" />
          <button
            onClick={() => togglePanel('location')}
            className="flex items-center gap-1.5 px-5 py-2 text-[16px] text-black rounded-full hover:bg-black/[0.06] transition-colors whitespace-nowrap max-w-[160px] truncate"
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
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          <div className="h-6 w-px bg-gray-300 shrink-0" />
          <button
            onClick={() => togglePanel('category')}
            className="flex items-center gap-1.5 px-5 py-2 text-[16px] text-black rounded-full hover:bg-black/[0.06] transition-colors whitespace-nowrap"
          >
            {selectedCategory?.name || 'Category'}
            <ChevronDown />
          </button>

          {openPanel === 'category' && (
            <div className="absolute top-[calc(100%+12px)] right-0 z-50 bg-white rounded-2xl shadow-2xl py-2 w-[220px] max-h-72 overflow-y-auto">
              <button
                onClick={() => { setSelectedCategory(null); setOpenPanel(null) }}
                className={`w-full text-left px-4 py-3 text-[14px] transition-colors hover:bg-gray-50
                  ${!selectedCategory ? 'font-semibold text-blue-600' : 'text-gray-700'}`}
              >
                All Categories
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => { setSelectedCategory(cat); setOpenPanel(null) }}
                  className={`w-full text-left px-4 py-3 text-[14px] transition-colors hover:bg-gray-50
                    ${selectedCategory?.id === cat.id ? 'font-semibold text-blue-600' : 'text-gray-700'}`}
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
    </div>
  )
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────

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
