import type { Metadata } from 'next'
import Script from 'next/script' // GA için gerekli Next.js bileşeni
import './globals.css'

export const metadata: Metadata = {
  title: 'Eller Havaya 🙌 | A Digital Art Installation by Ivo Isaev and Made in Pain',
  description: 'Yaşayan bir dijital insanlık tablosu. Mekanlardaki gizli seslerin görselleştiği interaktif internet sanatı.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr">
      <head>
        {/* 📊 GOOGLE ANALYTICS */}
        <Script
          strategy="afterInteractive"
          src={`https://www.googletagmanager.com/gtag/js?id=G-WFWL6L49KW`}
        />
        <Script
          id="google-analytics"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-WFWL6L49KW', {
                page_path: window.location.pathname,
              });
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}