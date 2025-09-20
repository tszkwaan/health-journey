import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { securityConfig } from './config';

export class SecurityUtils {
  // Generate secure random strings
  static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  // Generate secure random bytes
  static generateSecureBytes(length: number): Buffer {
    return crypto.randomBytes(length);
  }

  // Hash data for integrity verification
  static hashData(data: string, algorithm: string = 'sha256'): string {
    return crypto.createHash(algorithm).update(data).digest('hex');
  }

  // Verify data integrity
  static verifyDataIntegrity(data: string, hash: string, algorithm: string = 'sha256'): boolean {
    const computedHash = crypto.createHash(algorithm).update(data).digest('hex');
    return computedHash === hash;
  }

  // Sanitize input data
  static sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/['"]/g, '') // Remove quotes
      .replace(/[;]/g, '') // Remove semicolons
      .trim();
  }

  // Validate email format
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Validate password strength
  static validatePasswordStrength(password: string): {
    isValid: boolean;
    score: number;
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;

    if (password.length < 8) {
      feedback.push('Password must be at least 8 characters long');
    } else {
      score += 1;
    }

    if (!/[A-Z]/.test(password)) {
      feedback.push('Password must contain at least one uppercase letter');
    } else {
      score += 1;
    }

    if (!/[a-z]/.test(password)) {
      feedback.push('Password must contain at least one lowercase letter');
    } else {
      score += 1;
    }

    if (!/\d/.test(password)) {
      feedback.push('Password must contain at least one number');
    } else {
      score += 1;
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      feedback.push('Password must contain at least one special character');
    } else {
      score += 1;
    }

    return {
      isValid: score >= 4,
      score,
      feedback,
    };
  }

  // Extract client IP address
  static getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    const cfConnectingIP = request.headers.get('cf-connecting-ip');
    
    if (cfConnectingIP) return cfConnectingIP;
    if (realIP) return realIP;
    if (forwarded) return forwarded.split(',')[0].trim();
    
    return 'unknown';
  }

  // Check if request is from a trusted source
  static isTrustedSource(request: NextRequest): boolean {
    const clientIP = this.getClientIP(request);
    const userAgent = request.headers.get('user-agent') || '';
    
    // Check against known bot patterns
    const botPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
    ];
    
    if (botPatterns.some(pattern => pattern.test(userAgent))) {
      return false;
    }
    
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /sqlmap/i,
      /nikto/i,
      /nmap/i,
      /masscan/i,
    ];
    
    if (suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
      return false;
    }
    
    return true;
  }

  // Generate Content Security Policy header
  static generateCSPHeader(): string {
    const csp = securityConfig.csp;
    return Object.entries(csp)
      .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
      .join('; ');
  }

  // Mask sensitive data for logging
  static maskSensitiveData(data: string, type: 'email' | 'phone' | 'ssn' | 'name'): string {
    switch (type) {
      case 'email':
        const [local, domain] = data.split('@');
        return `${local.substring(0, 2)}***@${domain}`;
      
      case 'phone':
        return data.replace(/(\d{3})\d{3}(\d{4})/, '$1***$2');
      
      case 'ssn':
        return data.replace(/(\d{3})\d{2}(\d{4})/, '$1**$2');
      
      case 'name':
        const parts = data.split(' ');
        return parts.map(part => part.charAt(0) + '*'.repeat(part.length - 1)).join(' ');
      
      default:
        return '*'.repeat(data.length);
    }
  }

  // Check if data contains PHI
  static containsPHI(data: string): boolean {
    const phiPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b\d{3}\.\d{2}\.\d{4}\b/, // SSN with dots
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
      /\b\d{3}-\d{3}-\d{4}\b/, // Phone
      /\b\d{3}\.\d{3}\.\d{4}\b/, // Phone with dots
      /\b\d{3}\s\d{3}\s\d{4}\b/, // Phone with spaces
      /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/i, // Date
      /\b\d{1,2}\/\d{1,2}\/\d{4}\b/, // Date MM/DD/YYYY
      /\b\d{4}-\d{2}-\d{2}\b/, // Date YYYY-MM-DD
    ];
    
    return phiPatterns.some(pattern => pattern.test(data));
  }

  // Rate limiting helper
  static generateRateLimitKey(identifier: string, endpoint: string): string {
    return `rate_limit:${identifier}:${endpoint}`;
  }

  // Generate audit trail ID
  static generateAuditId(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString('hex');
    return `audit_${timestamp}_${random}`;
  }

  // Validate session token format
  static isValidSessionToken(token: string): boolean {
    // JWT format validation
    const jwtPattern = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;
    return jwtPattern.test(token);
  }

  // Check if request is internal
  static isInternalRequest(request: NextRequest): boolean {
    const internalHeader = request.headers.get('x-internal-call');
    const userAgent = request.headers.get('user-agent') || '';
    
    return internalHeader === 'true' || userAgent.includes('health-journey-internal');
  }

  // Generate secure filename
  static generateSecureFilename(originalName: string): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    const extension = originalName.split('.').pop() || '';
    return `file_${timestamp}_${random}.${extension}`;
  }

  // Check if data is JSON
  static isValidJSON(data: string): boolean {
    try {
      JSON.parse(data);
      return true;
    } catch {
      return false;
    }
  }

  // Escape HTML entities
  static escapeHTML(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}
