'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { registerSchema, type RegisterInput } from '@/lib/validations/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

function PasswordStrengthIndicator({ password }: { password: string }) {
  const getStrength = (pass: string): { score: number; label: string; color: string } => {
    let score = 0
    if (pass.length >= 8) score++
    if (pass.length >= 12) score++
    if (/[A-Z]/.test(pass)) score++
    if (/[a-z]/.test(pass)) score++
    if (/[0-9]/.test(pass)) score++
    if (/[^A-Za-z0-9]/.test(pass)) score++

    if (score <= 2) return { score: 1, label: 'Weak', color: 'bg-red-500' }
    if (score <= 4) return { score: 2, label: 'Fair', color: 'bg-yellow-500' }
    if (score <= 5) return { score: 3, label: 'Good', color: 'bg-blue-500' }
    return { score: 4, label: 'Strong', color: 'bg-green-500' }
  }

  const strength = getStrength(password)

  if (!password) return null

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={`h-1 flex-1 rounded-full ${
              level <= strength.score ? strength.color : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      <p className={`text-xs ${
        strength.score <= 1 ? 'text-red-600' :
        strength.score <= 2 ? 'text-yellow-600' :
        strength.score <= 3 ? 'text-blue-600' :
        'text-green-600'
      }`}>
        Password strength: {strength.label}
      </p>
    </div>
  )
}

export function RegisterForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: 'ATTENDEE',
    },
  })

  const role = watch('role', 'ATTENDEE')
  const password = watch('password', '')

  const onSubmit = async (data: RegisterInput) => {
    if (!acceptedTerms) {
      setError('Please accept the terms and conditions')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.message || 'Registration failed')
        return
      }

      setSuccess(true)
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center text-green-600">Check your email</CardTitle>
          <CardDescription className="text-center">
            We&apos;ve sent you a verification link
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-gray-600">
              Please check your email inbox and click on the verification link to activate your account.
            </p>
            <p className="text-sm text-gray-500">
              The link will expire in 24 hours.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push('/login')}
          >
            Go to Login
          </Button>
          <p className="text-sm text-center text-gray-500">
            Didn&apos;t receive the email?{' '}
            <Link href="/verify-email" className="text-blue-600 hover:underline">
              Resend verification
            </Link>
          </p>
        </CardFooter>
      </Card>
    )
  }

  return (
    <div className="space-y-0">
      <div className="relative z-10 flex items-end gap-1 px-2">
        <button
          type="button"
          onClick={() => setValue('role', 'ATTENDEE', { shouldValidate: true })}
          className={`relative flex-1 rounded-t-[1.75rem] border px-6 text-left transition-all duration-200 ${
            role === 'ATTENDEE'
              ? 'z-20 -mb-px scale-[1.08] border-gray-300 border-b-white bg-white py-5 text-gray-900 shadow-[0_14px_30px_-16px_rgba(17,24,39,0.35)]'
              : 'z-0 scale-[0.97] translate-y-2 border-gray-300 bg-gray-100 py-4 text-gray-500 hover:bg-gray-200'
          }`}
        >
          <p className="text-3xl font-semibold leading-tight tracking-tight">Attendee</p>
        </button>
        <button
          type="button"
          onClick={() => setValue('role', 'ORGANIZER', { shouldValidate: true })}
          className={`relative flex-1 rounded-t-[1.75rem] border px-6 text-left transition-all duration-200 ${
            role === 'ORGANIZER'
              ? 'z-20 -mb-px scale-[1.08] border-gray-300 border-b-white bg-white py-5 text-gray-900 shadow-[0_14px_30px_-16px_rgba(17,24,39,0.35)]'
              : 'z-0 scale-[0.97] translate-y-2 border-gray-300 bg-gray-100 py-4 text-gray-500 hover:bg-gray-200'
          }`}
        >
          <p className="text-3xl font-semibold leading-tight tracking-tight">Organizer</p>
        </button>
      </div>
      <Card className="relative z-20 rounded-[1.75rem] border border-t-0 border-gray-300 shadow-xl">
      <CardHeader className="space-y-2 pt-9">
        <CardTitle className="text-3xl text-center font-semibold tracking-tight">Create your account</CardTitle>
        <CardDescription className="text-center text-base">
          {role === 'ORGANIZER'
            ? 'Set up your organizer account to publish events.'
            : 'Create an attendee account to discover and join events.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Error Message */}
        {error && (
          <div className="p-3 rounded-md bg-red-50 text-red-700 text-sm border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...register('role')} />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName" required>First Name</Label>
              <Input
                id="firstName"
                placeholder="John"
                autoComplete="given-name"
                disabled={isLoading}
                error={errors.firstName?.message}
                required
                {...register('firstName')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName" required>Last Name</Label>
              <Input
                id="lastName"
                placeholder="Doe"
                autoComplete="family-name"
                disabled={isLoading}
                error={errors.lastName?.message}
                required
                {...register('lastName')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" required>Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              autoComplete="email"
              disabled={isLoading}
              error={errors.email?.message}
              required
              {...register('email')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" required>Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                disabled={isLoading}
                error={errors.password?.message}
                required
                className="pr-10"
                {...register('password')}
              />
              <button
                type="button"
                className="absolute right-3 top-5 -translate-y-1/2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                disabled={isLoading}
              >
                {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>
            <PasswordStrengthIndicator password={password} />
            <p className="text-xs text-gray-500">
              Must be at least 8 characters with uppercase, lowercase, and numbers
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" required>Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                disabled={isLoading}
                error={errors.confirmPassword?.message}
                required
                className="pr-10"
                {...register('confirmPassword')}
              />
              <button
                type="button"
                className="absolute right-3 top-5 -translate-y-1/2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                onClick={() => setShowConfirmPassword((value) => !value)}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                disabled={isLoading}
              >
                {showConfirmPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-start space-x-2">
            <input
              type="checkbox"
              id="terms"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="terms" className="text-sm text-gray-600">
              I agree to the <span className="text-red-500">*</span>{' '}
              <Link href="/terms" className="text-blue-600 hover:underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-blue-600 hover:underline">
                Privacy Policy
              </Link>
            </label>
          </div>

          <Button type="submit" className="w-full" isLoading={isLoading}>
            Create account
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4">
        <div className="text-sm text-center text-gray-500">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">
            Sign in
          </Link>
        </div>
      </CardFooter>
      </Card>
    </div>
  )
}
