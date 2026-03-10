'use client'

import { useEffect, useRef, useState } from 'react'
import { COUNTRIES } from '@/lib/pricing/countries'

interface CountryComboboxProps {
  id?: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  error?: string
  placeholder?: string
  className?: string
  required?: boolean
}

export function CountryCombobox({
  id,
  value,
  onChange,
  onBlur,
  error,
  placeholder = 'Country',
  className,
  required,
}: CountryComboboxProps) {
  const [inputValue, setInputValue] = useState(value)
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const errorId = error && id ? `${id}-error` : undefined

  // Keep display in sync when parent resets / loads initial data
  useEffect(() => {
    setInputValue(value)
  }, [value])

  const filtered = inputValue.trim()
    ? COUNTRIES.filter((c) =>
        c.name.toLowerCase().startsWith(inputValue.trim().toLowerCase())
      )
    : COUNTRIES

  function selectCountry(name: string) {
    setInputValue(name)
    onChange(name)
    setIsOpen(false)
    setHighlightedIndex(-1)
    inputRef.current?.focus()
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setInputValue(v)
    setIsOpen(true)
    setHighlightedIndex(-1)
    onChange(v)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true)
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      if (isOpen && highlightedIndex >= 0 && filtered[highlightedIndex]) {
        e.preventDefault()
        selectCountry(filtered[highlightedIndex].name)
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  // Scroll the highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement
      item?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightedIndex])

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        autoComplete="off"
        required={required}
        value={inputValue}
        placeholder={placeholder}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          // Delay so a mousedown on a list item can fire first
          setTimeout(() => {
            setIsOpen(false)
            onBlur?.()
          }, 150)
        }}
        onKeyDown={handleKeyDown}
        className={[
          'h-[40px] w-full rounded-[10px] border-[0.8px] bg-[#f9fafb] px-4 py-3 text-base placeholder-[#828283] outline-none transition focus:border-[#5c8bd9] focus:ring-0',
          error ? 'border-red-500' : 'border-[#e5e7eb]',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
      />

      {isOpen && filtered.length > 0 && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-[10px] border border-[#e5e7eb] bg-white shadow-lg"
          style={{ fontFamily: 'var(--font-outfit), sans-serif' }}
        >
          {filtered.map((c, i) => (
            <li
              key={c.code}
              role="option"
              aria-selected={i === highlightedIndex}
              onMouseDown={() => selectCountry(c.name)}
              className={[
                'cursor-pointer px-4 py-2 text-sm text-black',
                i === highlightedIndex ? 'bg-blue-50' : 'hover:bg-gray-50',
              ].join(' ')}
            >
              {c.name}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p id={errorId} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
