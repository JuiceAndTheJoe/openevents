import { Suspense } from 'react'
import { Metadata } from 'next'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata: Metadata = {
  title: 'Sign In | OpenEvents',
  description: 'Sign in to your OpenEvents account',
}

function LoginFormWrapper() {
  return <LoginForm />
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
      <LoginFormWrapper />
    </Suspense>
  )
}
