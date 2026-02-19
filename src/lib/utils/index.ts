import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import slugify from 'slugify'
import { v4 as uuidv4 } from 'uuid'

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generate a URL-friendly slug from a string
 */
export function generateSlug(text: string): string {
  return slugify(text, {
    lower: true,
    strict: true,
    trim: true,
  })
}

/**
 * Generate a unique slug by appending a short ID
 */
export function generateUniqueSlug(text: string): string {
  const baseSlug = generateSlug(text)
  const shortId = uuidv4().substring(0, 8)
  return `${baseSlug}-${shortId}`
}

/**
 * Generate a unique order number
 */
export function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `OE-${timestamp}-${random}`
}

/**
 * Generate a unique ticket code
 */
export function generateTicketCode(): string {
  return uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase()
}

/**
 * Generate a secure token for email verification, password reset, etc.
 */
export function generateToken(): string {
  return uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '')
}

/**
 * Format currency amount
 */
export function formatCurrency(
  amount: number | string,
  currency: string = 'SEK',
  locale: string = 'en-US'
): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(numAmount)
}

/**
 * Format date for display
 */
export function formatDate(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  })
}

/**
 * Format date and time for display
 */
export function formatDateTime(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...options,
  })
}

/**
 * Check if a date is in the past
 */
export function isPastDate(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date
  return d < new Date()
}

/**
 * Check if cancellation deadline has passed
 */
export function isCancellationDeadlinePassed(
  eventDate: Date | string,
  deadlineHours: number
): boolean {
  const event = typeof eventDate === 'string' ? new Date(eventDate) : eventDate
  const deadline = new Date(event.getTime() - deadlineHours * 60 * 60 * 1000)
  return new Date() > deadline
}

/**
 * Calculate remaining capacity for a ticket type
 */
export function getRemainingCapacity(
  maxCapacity: number | null,
  soldCount: number,
  reservedCount: number = 0
): number | null {
  if (maxCapacity === null) return null // Unlimited
  return Math.max(0, maxCapacity - soldCount - reservedCount)
}

/**
 * Check if ticket type is available for purchase
 */
export function isTicketAvailable(
  salesStartDate: Date | null,
  salesEndDate: Date | null,
  maxCapacity: number | null,
  soldCount: number,
  reservedCount: number = 0
): boolean {
  const now = new Date()

  // Check sales window
  if (salesStartDate && now < salesStartDate) return false
  if (salesEndDate && now > salesEndDate) return false

  // Check capacity
  const remaining = getRemainingCapacity(maxCapacity, soldCount, reservedCount)
  if (remaining !== null && remaining <= 0) return false

  return true
}

/**
 * Truncate text to a maximum length
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

/**
 * Extract initials from a name
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .substring(0, 2)
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return function executedFunction(...args: Parameters<T>) {
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(() => {
      func(...args)
    }, wait)
  }
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
