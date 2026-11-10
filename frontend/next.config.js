/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // No exponer variables sensibles al cliente
  // Solo las prefijadas con NEXT_PUBLIC_ están disponibles en el browser
  env: {},

  // Redirects y rewrites para assets estáticos
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/favicon.ico',
          destination: '/favicon.svg',
        },
      ],
    };
  },

  // Headers de seguridad adicionales
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            // Permitir micrófono solo para Push To Talk
            value: 'microphone=(self), camera=(), geolocation=()',
          },
        ],
      },
      // Cache headers para manifest
      {
        source: '/manifest.json',
        headers: [
          { key: 'Content-Type', value: 'application/manifest+json' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
      // Cache headers para favicon
      {
        source: '/favicon.svg',
        headers: [
          { key: 'Content-Type', value: 'image/svg+xml' },
          { key: 'Cache-Control', value: 'public, max-age=31536000' },
        ],
      },
    ];
  },

  // Optimizaciones de producción
  poweredByHeader: false,   // No revelar que usamos Next.js
  compress: true,
};

module.exports = nextConfig;
