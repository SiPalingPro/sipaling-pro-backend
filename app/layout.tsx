import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "SiPaling.pro - Professional Live Streaming Platform",
  description:
    "Platform streaming live profesional dengan fitur upload video, RTMP server, dan kualitas hingga 4K. Streaming ke YouTube dan Facebook dengan mudah.",
  keywords: "live streaming, RTMP, YouTube streaming, Facebook streaming, video upload, streaming platform",
  authors: [{ name: "SiPalingpro", url: "https://SiPaling.pro" }],
  creator: "SiPalingpro",
  publisher: "SiPaling.pro",
  robots: "index, follow",
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "https://SiPaling.pro",
    siteName: "SiPaling.pro",
    title: "SiPaling.pro - Professional Live Streaming Platform",
    description: "Platform streaming live profesional dengan fitur upload video, RTMP server, dan kualitas hingga 4K.",
    images: [
      {
        url: "/images/logo.png",
        width: 1200,
        height: 630,
        alt: "SiPaling.pro Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SiPaling.pro - Professional Live Streaming Platform",
    description: "Platform streaming live profesional dengan fitur upload video, RTMP server, dan kualitas hingga 4K.",
    images: ["/images/logo.png"],
  },
  icons: {
    icon: "/images/logo.png",
    shortcut: "/images/logo.png",
    apple: "/images/logo.png",
  },
  manifest: "/manifest.json",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id" className="scroll-smooth">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": "https://SiPaling.pro/#organization",
                  name: "SiPaling.pro",
                  url: "https://SiPaling.pro",
                  logo: {
                    "@type": "ImageObject",
                    url: "https://SiPaling.pro/images/logo.png",
                  },
                  description:
                    "Platform streaming live profesional dengan fitur upload video, RTMP server, dan kualitas hingga 4K.",
                },
                {
                  "@type": "WebSite",
                  "@id": "https://SiPaling.pro/#website",
                  url: "https://SiPaling.pro",
                  name: "SiPaling.pro",
                  description:
                    "Platform streaming live profesional dengan fitur upload video, RTMP server, dan kualitas hingga 4K.",
                  publisher: {
                    "@id": "https://SiPaling.pro/#organization",
                  },
                  inLanguage: "id-ID",
                },
              ],
            }),
          }}
        />
        <script src="https://www.google.com/recaptcha/api.js" async defer></script>
      </head>
      <body className={`${inter.className} antialiased bg-gray-50`}>{children}</body>
    </html>
  )
}
