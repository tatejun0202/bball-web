// server
import './globals.css'
import SwipeStage from '@/components/SwipeStage'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        {/* 既存 */}
        <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#1c1c1c" />

        {/* ★ iOS用 */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="BBall" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body>
        <div id="app-viewport">
          <div id="app-phone" style={{ position:'relative', overflow:'hidden' }}>
            <SwipeStage>{children}</SwipeStage>
          </div>
        </div>
      </body>
    </html>
  )
}
