import type { Metadata } from "next"
import { Outfit } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/Providers"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { getPlatformSetting } from "@/lib/platform-settings"

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "700"],
})

export const metadata: Metadata = {
  title: {
    default: "OpenEvents - Event Management & Ticketing",
    template: "%s | OpenEvents",
  },
  description:
    "Create, manage, and sell tickets to your events. An open-source event management platform.",
  keywords: ["events", "ticketing", "event management", "conferences", "meetups"],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "OpenEvents",
    title: "OpenEvents - Event Management & Ticketing",
    description:
      "Create, manage, and sell tickets to your events. An open-source event management platform.",
    images: [
      {
        url: "/hero-image.jpg",
        width: 1200,
        height: 630,
        alt: "OpenEvents - Event Management Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "OpenEvents - Event Management & Ticketing",
    description:
      "Create, manage, and sell tickets to your events. An open-source event management platform.",
    images: ["/hero-image.jpg"],
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const theme = await getPlatformSetting('platform_theme', 'light')

  return (
    <html lang="en" data-theme={theme}>
      <body className={`${outfit.variable} font-sans antialiased`} suppressHydrationWarning>
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
