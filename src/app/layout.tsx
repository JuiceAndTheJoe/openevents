import type { Metadata } from "next"
import "./globals.css"
import { Providers } from "@/components/Providers"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"

export const metadata: Metadata = {
  title: {
    default: "OpenEvents - Event Management & Ticketing",
    template: "%s | OpenEvents",
  },
  description:
    "Create, manage, and sell tickets to your events. An open-source event management platform.",
  keywords: ["events", "ticketing", "event management", "conferences", "meetups"],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  )
}
