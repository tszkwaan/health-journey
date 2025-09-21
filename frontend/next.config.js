/** @type {import('next').NextConfig} */
const nextConfig = {
  // Security headers for TLS and other security measures
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Force HTTPS - Only in production
          ...(process.env.NODE_ENV === 'production' ? [{
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload'
          }] : []),
          // Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          // XSS Protection
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          // Prevent clickjacking
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          // Referrer Policy
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          // Content Security Policy - Allow localhost for development
          {
            key: 'Content-Security-Policy',
            value: process.env.NODE_ENV === 'production' 
              ? "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https: wss:; media-src 'self'; object-src 'none'; child-src 'self'; frame-src 'none'; worker-src 'self'; manifest-src 'self'; form-action 'self'; base-uri 'self';"
              : "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' 'self' https: http://localhost:8000 ws://localhost:8000 wss://localhost:8000 ws: wss:; media-src 'self'; object-src 'none'; child-src 'self'; frame-src 'none'; worker-src 'self'; manifest-src 'self'; form-action 'self'; base-uri 'self';"
          },
          // Permissions Policy - Allow microphone for voice input
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
          }
        ]
      }
    ]
  },
  // Environment variables validation
  env: {
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    ENCRYPTION_MASTER_KEY: process.env.ENCRYPTION_MASTER_KEY,
    AUDIT_ENCRYPTION_KEY: process.env.AUDIT_ENCRYPTION_KEY,
  },
  // Redirect HTTP to HTTPS in production only
  async redirects() {
    if (process.env.NODE_ENV === 'production') {
      return [
        {
          source: '/(.*)',
          has: [
            {
              type: 'header',
              key: 'x-forwarded-proto',
              value: 'http',
            },
          ],
          destination: 'https://health-journey.vercel.app/:path*',
          permanent: true,
        },
      ]
    }
    return []
  },
}

module.exports = nextConfig
