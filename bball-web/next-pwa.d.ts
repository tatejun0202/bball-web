declare module 'next-pwa' {
  import { NextConfig } from 'next'
  type PWAOptions = {
    dest?: string
    register?: boolean
    skipWaiting?: boolean
    disable?: boolean
    [key: string]: any
  }
  export default function withPWA(options?: PWAOptions): (nextConfig: NextConfig) => NextConfig
}
