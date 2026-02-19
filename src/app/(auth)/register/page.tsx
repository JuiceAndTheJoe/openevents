import { Metadata } from 'next'
import { RegisterForm } from '@/components/auth/RegisterForm'

export const metadata: Metadata = {
  title: 'Sign Up | OpenEvents',
  description: 'Create your OpenEvents account',
}

export default function RegisterPage() {
  return <RegisterForm />
}
