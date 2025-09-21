import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { rbacService, Permission, AccessContext } from './rbac-service';
import { consentService, ConsentType } from './consent-service';
import { auditService } from './audit-service';
import { encryptionService } from './encryption-service';
import { rateLimiter } from './rate-limiter';
import { SecurityUtils } from './security-utils';
import { securityConfig } from './config';

export interface SecurityConfig {
  requiredPermissions: Permission[];
  requiredConsents?: ConsentType[];
  allowPHIAccess?: boolean;
  encryptData?: boolean;
  logAccess?: boolean;
  rateLimit?: boolean;
  validateInput?: boolean;
  sanitizeOutput?: boolean;
}

export class EnhancedSecurityMiddleware {
  private static instance: EnhancedSecurityMiddleware;

  static getInstance(): EnhancedSecurityMiddleware {
    if (!EnhancedSecurityMiddleware.instance) {
      EnhancedSecurityMiddleware.instance = new EnhancedSecurityMiddleware();
    }
    return EnhancedSecurityMiddleware.instance;
  }

  // Add security headers to response
  private addSecurityHeaders(response: NextResponse): NextResponse {
    Object.entries(securityConfig.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    // Add CSP header
    response.headers.set('Content-Security-Policy', SecurityUtils.generateCSPHeader());

    return response;
  }

  // Validate and sanitize request data
  private async validateRequest(request: NextRequest): Promise<{
    isValid: boolean;
    sanitizedData?: any;
    error?: string;
  }> {
    try {
      // Check if request is from trusted source
      if (!SecurityUtils.isTrustedSource(request)) {
        return {
          isValid: false,
          error: 'Request from untrusted source'
        };
      }

      // Check if request is internal
      if (SecurityUtils.isInternalRequest(request)) {
        return { isValid: true };
      }

      // Validate request size
      const contentLength = request.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) { // 10MB limit
        return {
          isValid: false,
          error: 'Request too large'
        };
      }

      // Validate JSON if present
      if (request.method !== 'GET' && request.headers.get('content-type')?.includes('application/json')) {
        try {
          const body = await request.clone().text();
          if (body && !SecurityUtils.isValidJSON(body)) {
            return {
              isValid: false,
              error: 'Invalid JSON format'
            };
          }
        } catch (error) {
          return {
            isValid: false,
            error: 'Invalid request body'
          };
        }
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: 'Request validation failed'
      };
    }
  }

  // Authenticate user
  private async authenticate(request: NextRequest): Promise<AccessContext | null> {
    try {
      const session = await getServerSession(authOptions);
      
      if (!session?.user?.id) {
        return null;
      }

      const context: AccessContext = {
        userId: session.user.id,
        userRole: (session.user as any).role,
        userEmail: session.user.email || '',
        request,
      };

      // Log authentication
      await auditService.logUserAction(
        context.userId,
        context.userRole,
        context.userEmail,
        'LOGIN' as any,
        'USER' as any,
        context.userId,
        request
      );

      return context;
    } catch (error) {
      console.error('Authentication error:', error);
      return null;
    }
  }

  // Authorize user
  private async authorize(
    context: AccessContext,
    config: SecurityConfig
  ): Promise<{ authorized: boolean; error?: string }> {
    try {
      // Check permissions
      for (const permission of config.requiredPermissions) {
        const hasPermission = await rbacService.checkPermission(context, permission);
        if (!hasPermission) {
          return {
            authorized: false,
            error: `Insufficient permissions: ${permission} required`
          };
        }
      }

      // Check consents
      if (config.requiredConsents) {
        for (const consentType of config.requiredConsents) {
          const hasConsent = await consentService.requireConsent(
            context.userId,
            context.userRole,
            context.userEmail,
            consentType,
            context.request
          );
          
          if (!hasConsent) {
            return {
              authorized: false,
              error: `Consent required: ${consentType}`
            };
          }
        }
      }

      return { authorized: true };
    } catch (error) {
      console.error('Authorization error:', error);
      return {
        authorized: false,
        error: `Authorization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Protect PHI data
  private async protectPHI(
    context: AccessContext,
    phiFields: string[]
  ): Promise<{ authorized: boolean; error?: string }> {
    try {
      // Check PHI access permission
      const hasPHIAccess = await rbacService.checkPHIAccess(
        context,
        phiFields
      );

      if (!hasPHIAccess) {
        return {
          authorized: false,
          error: 'Access to PHI not authorized'
        };
      }

      // Check data processing consent
      const hasConsent = await consentService.requireConsent(
        context.userId,
        context.userRole,
        context.userEmail,
        ConsentType.DATA_PROCESSING,
        context.request
      );

      if (!hasConsent) {
        return {
          authorized: false,
          error: 'Data processing consent required'
        };
      }

      return { authorized: true };
    } catch (error) {
      console.error('PHI protection error:', error);
      return {
        authorized: false,
        error: `PHI access failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Apply rate limiting
  private async applyRateLimit(request: NextRequest): Promise<{
    allowed: boolean;
    error?: string;
  }> {
    try {
      const identifier = SecurityUtils.getClientIP(request);
      const endpoint = new URL(request.url).pathname;
      
      const result = rateLimiter.isAllowed(identifier, endpoint);
      
      if (!result.allowed) {
        return {
          allowed: false,
          error: 'Rate limit exceeded'
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error('Rate limiting error:', error);
      return { allowed: true }; // Allow on error to avoid blocking legitimate requests
    }
  }

  // Main security wrapper
  async secureRoute(
    request: NextRequest,
    config: SecurityConfig,
    handler: (context: AccessContext, request: NextRequest) => Promise<NextResponse>
  ): Promise<NextResponse> {
    try {
      // Step 1: Validate request
      const validation = await this.validateRequest(request);
      if (!validation.isValid) {
        await auditService.logSystemEvent(
          'ACCESS_DENIED' as any,
          'SYSTEM' as any,
          undefined,
          { reason: 'Request validation failed', error: validation.error }
        );
        return NextResponse.json(
          { error: 'Invalid request', details: validation.error },
          { status: 400 }
        );
      }

      // Step 2: Apply rate limiting
      if (config.rateLimit !== false) {
        const rateLimitResult = await this.applyRateLimit(request);
        if (!rateLimitResult.allowed) {
          await auditService.logSystemEvent(
            'ACCESS_DENIED' as any,
            'SYSTEM' as any,
            undefined,
            { reason: 'Rate limit exceeded', ip: SecurityUtils.getClientIP(request) }
          );
          return NextResponse.json(
            { error: 'Too many requests', message: 'Please try again later' },
            { status: 429 }
          );
        }
      }

      // Step 3: Authenticate
      const context = await this.authenticate(request);
      if (!context) {
        await auditService.logSystemEvent(
          'ACCESS_DENIED' as any,
          'SYSTEM' as any,
          undefined,
          { reason: 'Authentication failed', ip: SecurityUtils.getClientIP(request) }
        );
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Step 4: Authorize
      const authResult = await this.authorize(context, config);
      if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: 403 });
      }

      // Step 5: PHI Protection (if required)
      if (config.allowPHIAccess) {
        const phiResult = await this.protectPHI(context, ['name', 'email', 'dateOfBirth']);
        if (!phiResult.authorized) {
          return NextResponse.json({ error: phiResult.error }, { status: 403 });
        }
      }

      // Step 6: Execute handler
      const response = await handler(context, request);

      // Step 7: Add security headers
      const securedResponse = this.addSecurityHeaders(response);

      // Step 8: Log successful access
      if (config.logAccess !== false) {
        await auditService.logUserAction(
          context.userId,
          context.userRole,
          context.userEmail,
          'READ' as any,
          'API' as any,
          undefined,
          request
        );
      }

      return securedResponse;
    } catch (error) {
      console.error('Security middleware error:', error);
      
      // Log error
      await auditService.logSystemEvent(
        'ACCESS_DENIED' as any,
        'SYSTEM' as any,
        undefined,
        { 
          reason: 'Security middleware error', 
          error: error instanceof Error ? error.message : 'Unknown error',
          ip: SecurityUtils.getClientIP(request)
        }
      );

      return NextResponse.json(
        { error: 'Internal server error' }, 
        { status: 500 }
      );
    }
  }

  // Convenience method
  async withSecurity(
    request: NextRequest,
    config: SecurityConfig,
    handler: (context: AccessContext, request: NextRequest) => Promise<NextResponse>
  ): Promise<NextResponse> {
    return this.secureRoute(request, config, handler);
  }
}

export const enhancedSecurityMiddleware = EnhancedSecurityMiddleware.getInstance();

// Convenience functions for common security patterns
export async function withAuthentication(
  request: NextRequest,
  handler: (context: AccessContext, request: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  return enhancedSecurityMiddleware.withSecurity(request, {
    requiredPermissions: [],
    logAccess: true,
    rateLimit: true,
  }, handler);
}

export async function withDoctorAccess(
  request: NextRequest,
  handler: (context: AccessContext, request: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  return enhancedSecurityMiddleware.withSecurity(request, {
    requiredPermissions: [Permission.MEDICAL_BACKGROUND_READ],
    requiredConsents: [ConsentType.DATA_PROCESSING],
    allowPHIAccess: true,
    logAccess: true,
    rateLimit: true,
  }, handler);
}

export async function withPatientAccess(
  request: NextRequest,
  handler: (context: AccessContext, request: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  return enhancedSecurityMiddleware.withSecurity(request, {
    requiredPermissions: [Permission.USER_READ],
    requiredConsents: [ConsentType.DATA_PROCESSING],
    logAccess: true,
    rateLimit: true,
  }, handler);
}

export async function withPHIAccess(
  request: NextRequest,
  handler: (context: AccessContext, request: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  return enhancedSecurityMiddleware.withSecurity(request, {
    requiredPermissions: [Permission.MEDICAL_BACKGROUND_READ],
    requiredConsents: [ConsentType.DATA_PROCESSING, ConsentType.MEDICAL_RECORDS_ACCESS],
    allowPHIAccess: true,
    logAccess: true,
    rateLimit: true,
  }, handler);
}
