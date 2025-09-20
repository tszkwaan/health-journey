export const securityConfig = {
  // Encryption settings
  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16,
    tagLength: 16,
  },
  
  // Audit settings
  audit: {
    retentionDays: 2555, // 7 years
    logLevel: 'info',
    encryptSensitiveData: true,
    maxLogSize: 10000, // Max logs per query
  },
  
  // PHI protection
  phi: {
    maskingEnabled: true,
    encryptionEnabled: true,
    fields: [
      'name', 'email', 'phone', 'dateOfBirth', 'address',
      'socialSecurityNumber', 'medicalRecordNumber'
    ],
  },
  
  // Consent management
  consent: {
    version: '1.0',
    expiryDays: 365,
    requiredConsents: [
      'DATA_PROCESSING',
      'VOICE_AI',
      'MEDICAL_RECORDS_ACCESS',
      'FORM_GENERATION'
    ],
  },
  
  // Rate limiting
  rateLimit: {
    maxRequests: 100,
    windowMs: 15 * 60 * 1000, // 15 minutes
    skipSuccessfulRequests: false,
  },
  
  // Session security
  session: {
    maxAge: 24 * 60 * 60, // 24 hours
    updateAge: 60 * 60, // 1 hour
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict' as const,
  },
  
  // CORS settings
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://health-journey.vercel.app']
      : ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-ID'],
  },
  
  // Security headers
  headers: {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
  },
  
  // Content Security Policy
  csp: {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-eval'", "'unsafe-inline'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'https:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", 'https:'],
    'media-src': ["'self'"],
    'object-src': ["'none'"],
    'child-src': ["'self'"],
    'frame-src': ["'none'"],
    'worker-src': ["'self'"],
    'manifest-src': ["'self'"],
    'form-action': ["'self'"],
    'base-uri': ["'self'"],
  },
};
