'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSession, signIn } from 'next-auth/react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Mail, Lock } from 'lucide-react'
import { loginSchema, type LoginInput } from '@/lib/validations/auth'

const REMEMBER_EMAIL_COOKIE = 'oe_remember_email'

function readRememberedEmail(): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${REMEMBER_EMAIL_COOKIE}=([^;]*)`)
  )
  return match ? decodeURIComponent(match[1]) : ''
}

function saveRememberedEmail(email: string) {
  const expires = new Date()
  expires.setDate(expires.getDate() + 30)
  document.cookie = `${REMEMBER_EMAIL_COOKIE}=${encodeURIComponent(email)};expires=${expires.toUTCString()};path=/;SameSite=Lax`
}

function clearRememberedEmail() {
  document.cookie = `${REMEMBER_EMAIL_COOKIE}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Lax`
}

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  const verified = searchParams.get('verified')
  const urlError = searchParams.get('error')
  const message = searchParams.get('message')

  const getInitialMessage = () => {
    if (verified === 'true')
      return { type: 'success', text: 'Email verified successfully! You can now log in.' }
    if (message === 'already_verified')
      return { type: 'info', text: 'Your email is already verified. Please log in.' }
    if (urlError === 'token_expired')
      return { type: 'error', text: 'Verification link has expired. Please request a new one.' }
    if (urlError === 'invalid_token')
      return { type: 'error', text: 'Invalid verification link.' }
    return null
  }

  const initialMessage = getInitialMessage()

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  useEffect(() => {
    const email = readRememberedEmail()
    if (email) {
      setValue('email', email)
      setRememberMe(true)
    }
  }, [setValue])

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true)
    setError(null)

    if (rememberMe) {
      saveRememberedEmail(data.email)
    } else {
      clearRememberedEmail()
    }

    let redirecting = false

    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      })

      if (result?.error) {
        setError(result.error)
      } else {
        redirecting = true
        setIsRedirecting(true)

        const callbackUrl = searchParams.get('callbackUrl')
        if (callbackUrl) {
          router.push(callbackUrl)
          router.refresh()
          return
        }

        const session = await getSession()
        const roles = session?.user?.roles || []
        const isOrganizerOrAdmin =
          roles.includes('ORGANIZER') || roles.includes('SUPER_ADMIN')
        router.push(isOrganizerOrAdmin ? '/dashboard' : '/events')
        router.refresh()
      }
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      if (!redirecting) setIsLoading(false)
    }
  }

  if (isRedirecting) {
    return (
      <div className="fixed inset-0 z-50 bg-white animate-pulse">
        {/* Navbar skeleton */}
        <div className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="h-7 w-32 rounded-lg bg-gray-200" />
            <div className="flex items-center gap-4">
              <div className="h-5 w-24 rounded bg-gray-200" />
              <div className="h-5 w-16 rounded bg-gray-200" />
              <div className="h-9 w-9 rounded-full bg-gray-200" />
            </div>
          </div>
        </div>

        {/* Page content skeleton */}
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Page header */}
          <div className="mb-6 space-y-2">
            <div className="h-8 w-48 rounded-lg bg-gray-200" />
            <div className="h-5 w-64 rounded bg-gray-200" />
          </div>

          {/* Stats row */}
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 p-5">
                <div className="h-4 w-20 rounded bg-gray-200" />
                <div className="mt-2 h-7 w-12 rounded bg-gray-200" />
              </div>
            ))}
          </div>

          {/* Content blocks */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-5">
              <div className="mb-4 h-5 w-32 rounded bg-gray-200" />
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-white px-3 py-3">
                    <div className="space-y-1.5">
                      <div className="h-4 w-36 rounded bg-gray-200" />
                      <div className="h-3 w-24 rounded bg-gray-200" />
                    </div>
                    <div className="h-5 w-14 rounded-full bg-gray-200" />
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-5">
              <div className="mb-4 h-5 w-28 rounded bg-gray-200" />
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div className="space-y-1.5">
                      <div className="h-4 w-32 rounded bg-gray-200" />
                      <div className="h-3 w-20 rounded bg-gray-200" />
                    </div>
                    <div className="h-4 w-14 rounded bg-gray-200" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-3xl shadow-[0px_10px_30px_0px_rgba(0,0,0,0.12)] px-12 py-12">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-black">Welcome back</h1>
        <p className="mt-2 text-lg text-[#4a5565]">Log in to your OpenEvents account</p>
      </div>

      {/* URL-based status messages */}
      {initialMessage && (
        <div
          className={`mb-4 rounded-md p-3 text-sm ${
            initialMessage.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : initialMessage.type === 'error'
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-blue-50 text-blue-700 border border-blue-200'
          }`}
        >
          {initialMessage.text}
        </div>
      )}

      {/* Sign-in error */}
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        {/* Email */}
        <div className="flex flex-col gap-2">
          <label className="text-base font-semibold text-black">Email address</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#828283] pointer-events-none" />
            <input
              type="email"
              placeholder="your@email.com"
              autoComplete="email"
              disabled={isLoading}
              className="h-12 w-full rounded-[10px] bg-[#f2f2f4] pl-12 pr-4 text-base placeholder:text-[#828283] focus:outline-none focus:ring-2 focus:ring-[#5c8bd9] disabled:opacity-50"
              {...register('email')}
            />
          </div>
          {errors.email && (
            <p className="text-sm text-red-600">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div className="flex flex-col gap-2">
          <label className="text-base font-semibold text-black">Password</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#828283] pointer-events-none" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              autoComplete="current-password"
              disabled={isLoading}
              className="h-12 w-full rounded-[10px] bg-[#f2f2f4] pl-12 pr-12 text-base placeholder:text-[#828283] focus:outline-none focus:ring-2 focus:ring-[#5c8bd9] disabled:opacity-50"
              {...register('password')}
            />
            <button
              type="button"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#828283] hover:text-gray-700 disabled:opacity-50"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              disabled={isLoading}
            >
              {showPassword ? (
                <Eye className="h-5 w-5" />
              ) : (
                <EyeOff className="h-5 w-5" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="text-sm text-red-600">{errors.password.message}</p>
          )}
        </div>

        {/* Remember me + Forgot password */}
        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-[18px] w-[18px] cursor-pointer rounded accent-[#5c8bd9]"
            />
            <span className="text-sm font-medium text-[#4a5565]">Remember me</span>
          </label>
          <Link
            href="/forgot-password"
            className="text-sm text-[#5c8bd9] hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        {/* Login button */}
        <button
          type="submit"
          disabled={isLoading}
          className="flex h-[52px] w-full items-center justify-center rounded-[10px] bg-[#5c8bd9] text-lg font-semibold text-white shadow-[0px_4px_6px_0px_rgba(0,0,0,0.1),0px_2px_4px_0px_rgba(0,0,0,0.1)] transition-colors hover:bg-[#4a7ac8] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <svg
              className="h-5 w-5 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            'Log in'
          )}
        </button>

        {/* Divider */}
        <div className="border-t border-[#d1d5dc]" />

        {/* Sign up link */}
        <p className="text-center text-base text-[#4a5565]">
          Don&apos;t have an account?{' '}
          <Link
            href="/register"
            className="font-semibold text-[#5c8bd9] hover:underline"
          >
            Sign up
          </Link>
        </p>
      </form>
    </div>
  )
}
