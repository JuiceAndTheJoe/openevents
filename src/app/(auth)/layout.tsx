export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8" style={{ background: 'linear-gradient(180deg, #86A7E7 0%, #BBD4F4 47.6%, #DFEBFE 100%)' }}>
      <div className="w-full max-w-xl">
        {children}
      </div>
    </div>
  )
}
