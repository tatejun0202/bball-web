
const runtimeCaching: any[] = [
  {
    urlPattern: ({ request }: { request: Request }) => request.mode === 'navigate',
    handler: 'NetworkFirst',
    options: {
      cacheName: 'pages',
      expiration: { maxEntries: 50, maxAgeSeconds: 7 * 24 * 3600 },
      networkTimeoutSeconds: 3
    }
  },
  {
    urlPattern: ({ request }: { request: Request }) =>
      ['style', 'script', 'worker'].includes(request.destination),
    handler: 'StaleWhileRevalidate',
    options: {
      cacheName: 'static-assets',
      expiration: { maxEntries: 80, maxAgeSeconds: 30 * 24 * 3600 }
    }
  },
  {
    urlPattern: ({ request, url }: { request: Request; url: URL }) =>
      request.destination === 'image' || url.pathname.startsWith('/images/'),
    handler: 'CacheFirst',
    options: {
      cacheName: 'images',
      expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 3600 }
    }
  },
  {
    urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith('/api/'),
    handler: 'NetworkFirst',
    options: {
      cacheName: 'api',
      expiration: { maxEntries: 50, maxAgeSeconds: 7 * 24 * 3600 }
    }
  }
]

export default runtimeCaching
