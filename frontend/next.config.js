/** @type {import('next').NextConfig} */
const nextConfig = {
  // Security headers for TLS and other security measures
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
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
