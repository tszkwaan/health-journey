import { NextRequest } from 'next/server';
import { SecurityUtils } from './security-utils';
import { securityConfig } from './config';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private static instance: RateLimiter;
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime < now) {
        this.store.delete(key);
      }
    }
  }

  private getKey(identifier: string, endpoint: string): string {
    return SecurityUtils.generateRateLimitKey(identifier, endpoint);
  }

  isAllowed(identifier: string, endpoint: string): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
  } {
    const key = this.getKey(identifier, endpoint);
    const now = Date.now();
    const windowMs = securityConfig.rateLimit.windowMs;
    const maxRequests = securityConfig.rateLimit.maxRequests;

    const entry = this.store.get(key);

    if (!entry || entry.resetTime < now) {
      // Create new entry or reset expired entry
      this.store.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });

      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetTime: now + windowMs,
      };
    }

    if (entry.count >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
      };
    }

    // Increment count
    entry.count++;
    this.store.set(key, entry);

    return {
      allowed: true,
      remaining: maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  getRemainingTime(identifier: string, endpoint: string): number {
    const key = this.getKey(identifier, endpoint);
    const entry = this.store.get(key);
    
    if (!entry) return 0;
    
    const now = Date.now();
    return Math.max(0, entry.resetTime - now);
  }

  reset(identifier: string, endpoint: string): void {
    const key = this.getKey(identifier, endpoint);
    this.store.delete(key);
  }

  // Cleanup on process exit
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

export const rateLimiter = RateLimiter.getInstance();

// Rate limiting middleware
export async function withRateLimit(
  request: NextRequest,
  handler: (request: NextRequest) => Promise<Response>
): Promise<Response> {
  const identifier = SecurityUtils.getClientIP(request);
  const endpoint = new URL(request.url).pathname;
  
  const result = rateLimiter.isAllowed(identifier, endpoint);
  
  if (!result.allowed) {
    const retryAfter = Math.ceil(result.resetTime / 1000);
    
    return new Response(
      JSON.stringify({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': securityConfig.rateLimit.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': result.resetTime.toString(),
        },
      }
    );
  }

  const response = await handler(request);
  
  // Add rate limit headers to response
  response.headers.set('X-RateLimit-Limit', securityConfig.rateLimit.maxRequests.toString());
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
  response.headers.set('X-RateLimit-Reset', result.resetTime.toString());
  
  return response;
}
