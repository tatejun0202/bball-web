type Handler = 'NetworkFirst' | 'StaleWhileRevalidate' | 'CacheFirst'
type RuntimeCaching = {
  urlPattern:
    | RegExp
    | ((ctx: { request: Request; url: URL }) => boolean)
  handler: Handler
  options?: Record<string, unknown>
}

const runtimeCaching: RuntimeCaching[] = [
  {
    urlPattern: ({ request }) => request.mode === 'navigate',
    handler: 'NetworkFirst',
    options: {
      cacheName: 'pages',
      expiration: { maxEntries: 50, maxAgeSeconds: 7 * 24 * 3600 },
      networkTimeoutSeconds: 3
    }
  },
  {
    urlPattern: ({ request }) =>
      ['style', 'script', 'worker'].includes(request.destination),
    handler: 'StaleWhileRevalidate',
    options: {
      cacheName: 'static-assets',
      expiration: { maxEntries: 80, maxAgeSeconds: 30 * 24 * 3600 }
    }
  },
  {
    urlPattern: ({ request, url }) =>
      request.destination === 'image' || url.pathname.startsWith('/images/'),
    handler: 'CacheFirst',
    options: {
      cacheName: 'images',
      expiration: { maxEntries: 60, maxAgeSeconds: 30 * 24 * 3600 }
    }
  },
  {
    urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
    handler: 'NetworkFirst',
    options: {
      cacheName: 'api',
      expiration: { maxEntries: 50, maxAgeSeconds: 7 * 24 * 3600 }
    }
  }
]

export default runtimeCaching
