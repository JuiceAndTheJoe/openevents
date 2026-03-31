export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className="auth-gradient flex min-h-[70vh] flex-col items-center justify-center px-3 py-6 sm:min-h-[75vh] sm:px-6 sm:py-10 lg:px-8 lg:py-12"
    >
      <div className="w-full max-w-xl">
        {children}
      </div>
    </div>
  )
}
