'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { loginSchema, type LoginInput } from '@/lib/validations/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  // Check for messages from URL params
  const verified = searchParams.get('verified')
  const urlError = searchParams.get('error')
  const message = searchParams.get('message')

  const getInitialMessage = () => {
    if (verified === 'true') {
      return { type: 'success', text: 'Email verified successfully! You can now log in.' }
    }
    if (message === 'already_verified') {
      return { type: 'info', text: 'Your email is already verified. Please log in.' }
    }
    if (urlError === 'token_expired') {
      return { type: 'error', text: 'Verification link has expired. Please request a new one.' }
    }
    if (urlError === 'invalid_token') {
      return { type: 'error', text: 'Invalid verification link.' }
    }
    return null
  }

  const initialMessage = getInitialMessage()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      })

      if (result?.error) {
        setError(result.error)
      } else {
        // Get the callback URL or default to dashboard
        const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
        router.push(callbackUrl)
        router.refresh()
      }
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-center">Sign in</CardTitle>
        <CardDescription className="text-center">
          Enter your email and password to sign in
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Messages */}
        {initialMessage && (
          <div
            className={`p-3 rounded-md text-sm ${
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

        {/* Error Message */}
        {error && (
          <div className="p-3 rounded-md bg-red-50 text-red-700 text-sm border border-red-200">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              autoComplete="email"
              disabled={isLoading}
              error={errors.email?.message}
              {...register('email')}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-sm text-blue-600 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                disabled={isLoading}
                error={errors.password?.message}
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
          </div>
          <Button type="submit" className="w-full" isLoading={isLoading}>
            Sign in
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4">
        <div className="text-sm text-center text-gray-500">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-blue-600 hover:underline">
            Sign up
          </Link>
        </div>
      </CardFooter>
    </Card>
  )
}
