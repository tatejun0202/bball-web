import type { NextConfig } from 'next'
import withPWA from 'next-pwa'
import runtimeCaching from './src/pwa-runtime-caching'

const nextConfig: NextConfig = {
  experimental: { typedRoutes: true }
}

export default withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  runtimeCaching
})(nextConfig)
