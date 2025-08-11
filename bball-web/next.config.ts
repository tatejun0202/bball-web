// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  // 開発モードでPWAを無効化してエラーを回避
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'offlineCache',
        expiration: {
          maxEntries: 200,
        },
      },
    },
  ],
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 他の設定があればここに
}

module.exports = withPWA(nextConfig)