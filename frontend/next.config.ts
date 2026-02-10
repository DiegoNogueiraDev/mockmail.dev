import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'origin-when-cross-origin'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()'
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "object-src 'none'",
      "base-uri 'self'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self' http://localhost:3000 https://api.mockmail.dev https://api.homologacao.mockmail.dev",
      "frame-ancestors 'none'",
    ].join('; ')
  }
];

const nextConfig: NextConfig = {
  // Habilitar output standalone para Docker
  output: 'standalone',

  async headers() {
    return [
      {
        // Aplicar headers a todas as rotas
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  // Desabilitar powered-by header
  poweredByHeader: false,
};

export default nextConfig;
