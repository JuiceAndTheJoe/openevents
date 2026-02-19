'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/lib/validations/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [isLoading, setIsLoading] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [verified, setVerified] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  // Auto-verify if token is present
  useEffect(() => {
    if (token && !verified && !isVerifying) {
      setIsVerifying(true)

      fetch(`/api/auth/verify-email?token=${token}`)
        .then(async (response) => {
          // The API returns a redirect, so we check the final URL
          if (response.redirected) {
            const url = new URL(response.url)
            if (url.searchParams.get('verified') === 'true') {
              setVerified(true)
              // Redirect to login after short delay
              setTimeout(() => router.push('/login?verified=true'), 1500)
            } else if (url.searchParams.get('error')) {
              const errorType = url.searchParams.get('error')
              if (errorType === 'token_expired') {
                setError('This verification link has expired. Please request a new one.')
              } else if (errorType === 'invalid_token') {
                setError('This verification link is invalid.')
              } else {
                setError('Verification failed. Please try again.')
              }
            } else if (url.searchParams.get('message') === 'already_verified') {
              setVerified(true)
              setTimeout(() => router.push('/login?message=already_verified'), 1500)
            }
          }
        })
        .catch(() => {
          setError('An error occurred during verification.')
        })
        .finally(() => {
          setIsVerifying(false)
        })
    }
  }, [token, verified, isVerifying, router])

  const onSubmit = async (data: ForgotPasswordInput) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.message || 'Failed to resend verification email')
        return
      }

      setSuccess(true)
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Show verifying state when token is present
  if (token && isVerifying) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-gray-500">Verifying your email...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Show verified success
  if (verified) {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center text-green-600">Email Verified!</CardTitle>
          <CardDescription className="text-center">
            Your email has been verified successfully
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-gray-600">
              Redirecting you to login...
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Link href="/login" className="w-full">
            <Button className="w-full">
              Go to Login
            </Button>
          </Link>
        </CardFooter>
      </Card>
    )
  }

  // Show error with option to resend (when token verification failed)
  if (token && error) {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center text-red-600">Verification Failed</CardTitle>
          <CardDescription className="text-center">
            {error}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Link href="/verify-email" className="w-full">
            <Button className="w-full">
              Request New Verification Link
            </Button>
          </Link>
          <Link href="/login" className="w-full">
            <Button variant="outline" className="w-full">
              Back to Login
            </Button>
          </Link>
        </CardFooter>
      </Card>
    )
  }

  // Resend email success
  if (success) {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center text-green-600">Email Sent</CardTitle>
          <CardDescription className="text-center">
            Check your inbox for the verification link
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-gray-600">
              If an account exists with the email you provided, we&apos;ve sent a verification link.
            </p>
            <p className="text-sm text-gray-500">
              The link will expire in 24 hours.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Link href="/login" className="w-full">
            <Button variant="outline" className="w-full">
              Back to Login
            </Button>
          </Link>
        </CardFooter>
      </Card>
    )
  }

  // Default: resend verification form
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-center">Verify your email</CardTitle>
        <CardDescription className="text-center">
          Enter your email to receive a new verification link
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Error Message */}
        {error && (
          <div className="p-3 rounded-md bg-red-50 text-red-700 text-sm border border-red-200">
            {error}
          </div>
        )}

        <div className="text-center space-y-4 mb-6">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm text-gray-600">
            Didn&apos;t receive the verification email? Enter your email address below and we&apos;ll send you a new one.
          </p>
        </div>

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

          <Button type="submit" className="w-full" isLoading={isLoading}>
            Resend verification email
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4">
        <div className="text-sm text-center text-gray-500">
          Already verified?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">
            Sign in
          </Link>
        </div>
      </CardFooter>
    </Card>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-gray-500">Loading...</p>
          </div>
        </CardContent>
      </Card>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}
