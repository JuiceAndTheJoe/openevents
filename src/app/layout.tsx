import type { Metadata } from "next"
import { Outfit } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/Providers"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { getPlatformSettings } from "@/lib/platform-settings"

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "700"],
})

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPlatformSettings({
    platform_name: 'OpenEvents',
  })
  const name = settings.platform_name

  return {
    title: {
      default: `${name} - Event Management & Ticketing`,
      template: `%s | ${name}`,
    },
    description:
      `Create, manage, and sell tickets to your events. Powered by ${name}.`,
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
      siteName: name,
      title: `${name} - Event Management & Ticketing`,
      description:
        `Create, manage, and sell tickets to your events. Powered by ${name}.`,
      images: [
        {
          url: "/hero-image.jpg",
          width: 1200,
          height: 630,
          alt: `${name} - Event Management Platform`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} - Event Management & Ticketing`,
      description:
        `Create, manage, and sell tickets to your events. Powered by ${name}.`,
      images: ["/hero-image.jpg"],
    },
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const settings = await getPlatformSettings({
    platform_theme: 'light',
    platform_brand_color: '#5C8BD9',
    platform_name: 'OpenEvents',
    platform_logo: '',
    platform_favicon: '',
    footer_tagline: 'Organizing events starts here',
    footer_links: '',
  })

  const theme = settings.platform_theme
  const brandColor = settings.platform_brand_color
  const favicon = settings.platform_favicon ? '/api/platform/image/favicon' : ''

  return (
    <html lang="en" data-theme={theme}>
      <head>
        {favicon && (
          <link rel="icon" href={favicon} />
        )}
        {brandColor !== '#5C8BD9' && (
          <style dangerouslySetInnerHTML={{ __html: `
            :root {
              --brand-color: ${brandColor};
              --brand-color-hover: color-mix(in srgb, ${brandColor} 85%, black);
            }
          `}} />
        )}
      </head>
      <body className={`${outfit.variable} font-sans antialiased`} suppressHydrationWarning>
        <Providers>
          <div className="flex min-h-screen flex-col">
            <Header
              platformName={settings.platform_name}
              platformLogo={settings.platform_logo ? '/api/platform/image/logo' : ''}
              brandColor={brandColor}
            />
            <main className="flex-1">{children}</main>
            <Footer
              platformName={settings.platform_name}
              tagline={settings.footer_tagline}
              links={settings.footer_links ? JSON.parse(settings.footer_links) : undefined}
            />
          </div>
        </Providers>
      </body>
    </html>
  )
}
