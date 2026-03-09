'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { choosePasswordSchema, type ChoosePasswordInput } from '@/lib/validations/auth'

export function ChoosePasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { update } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChoosePasswordInput>({
    resolver: zodResolver(choosePasswordSchema),
  })

  const onSubmit = async (data: ChoosePasswordInput) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/choose-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()
      if (!response.ok) {
        setError(result?.message || 'Could not update password.')
        return
      }

      const updatedSession = await update()

      const callbackUrl = searchParams.get('callbackUrl')
      if (callbackUrl) {
        router.push(callbackUrl)
        router.refresh()
        return
      }

      const roles = updatedSession?.user?.roles || []
      const isOrganizerOrAdmin =
        roles.includes('ORGANIZER') || roles.includes('SUPER_ADMIN')

      router.push(isOrganizerOrAdmin ? '/dashboard' : '/events')
      router.refresh()
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="rounded-2xl bg-white px-4 py-6 shadow-[0px_10px_30px_0px_rgba(0,0,0,0.12)] sm:rounded-3xl sm:px-8 sm:py-10 lg:px-12 lg:py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-black sm:text-4xl">Choose new password</h1>
        <p className="mt-2 text-base text-[#4a5565] sm:text-lg">
          You must set a new password before continuing.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5 sm:gap-6">
        <div className="flex flex-col gap-2">
          <label className="text-base font-semibold text-black">
            New password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#828283]" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Create a new password"
              autoComplete="new-password"
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
              {showPassword ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
            </button>
          </div>
          {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-base font-semibold text-black">
            Confirm password <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#828283]" />
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirm your password"
              autoComplete="new-password"
              disabled={isLoading}
              className="h-12 w-full rounded-[10px] bg-[#f2f2f4] pl-12 pr-12 text-base placeholder:text-[#828283] focus:outline-none focus:ring-2 focus:ring-[#5c8bd9] disabled:opacity-50"
              {...register('confirmPassword')}
            />
            <button
              type="button"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#828283] hover:text-gray-700 disabled:opacity-50"
              onClick={() => setShowConfirmPassword((v) => !v)}
              aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              disabled={isLoading}
            >
              {showConfirmPassword ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
            </button>
          </div>
          {errors.confirmPassword && <p className="text-sm text-red-600">{errors.confirmPassword.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="flex h-12 w-full items-center justify-center rounded-[10px] bg-[#5c8bd9] text-base font-semibold text-white shadow-[0px_4px_6px_0px_rgba(0,0,0,0.1),0px_2px_4px_0px_rgba(0,0,0,0.1)] transition-colors hover:bg-[#4a7ac8] disabled:cursor-not-allowed disabled:opacity-50 sm:h-[52px] sm:text-lg"
        >
          {isLoading ? (
            <svg
              className="h-5 w-5 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            'Save new password'
          )}
        </button>
      </form>
    </div>
  )
}
