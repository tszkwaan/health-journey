import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { rbacService, Permission, AccessContext } from './rbac-service';
import { consentService, ConsentType } from './consent-service';
import { auditService } from './audit-service';
import { encryptionService } from './encryption-service';

export interface SecurityConfig {
  requiredPermissions: Permission[];
  requiredConsents?: ConsentType[];
  allowPHIAccess?: boolean;
  encryptData?: boolean;
  logAccess?: boolean;
}

export class SecurityMiddleware {
  private static instance: SecurityMiddleware;

  static getInstance(): SecurityMiddleware {
    if (!SecurityMiddleware.instance) {
      SecurityMiddleware.instance = new SecurityMiddleware();
    }
    return SecurityMiddleware.instance;
  }

  async authenticate(request: NextRequest): Promise<AccessContext | null> {
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

  async authorize(
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

  async protectPHI(
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

  async encryptSensitiveData(data: any): Promise<any> {
    try {
      if (typeof data === 'string') {
        return await encryptionService.encryptSensitiveData(data);
      } else if (typeof data === 'object' && data !== null) {
        return await encryptionService.encryptPHIData(data);
      }
      return data;
    } catch (error) {
      console.error('Encryption error:', error);
      return data; // Return original data if encryption fails
    }
  }

  async decryptSensitiveData(data: any): Promise<any> {
    try {
      if (typeof data === 'string') {
        // This would need the key information to decrypt
        return data; // For now, return as-is
      } else if (typeof data === 'object' && data !== null) {
        return await encryptionService.decryptPHIData(data);
      }
      return data;
    } catch (error) {
      console.error('Decryption error:', error);
      return data; // Return original data if decryption fails
    }
  }

  // Main security wrapper for API routes
  async secureRoute(
    request: NextRequest,
    config: SecurityConfig,
    handler: (context: AccessContext, request: NextRequest) => Promise<NextResponse>
  ): Promise<NextResponse> {
    try {
      // Step 1: Authenticate
      const context = await this.authenticate(request);
      if (!context) {
        await auditService.logSystemEvent(
          'ACCESS_DENIED' as any,
          'SYSTEM' as any,
          undefined,
          { reason: 'Authentication failed', ip: request.headers.get('x-forwarded-for') }
        );
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Step 2: Authorize
      const authResult = await this.authorize(context, config);
      if (!authResult.authorized) {
        return NextResponse.json({ error: authResult.error }, { status: 403 });
      }

      // Step 3: PHI Protection (if required)
      if (config.allowPHIAccess) {
        const phiResult = await this.protectPHI(context, ['name', 'email', 'dateOfBirth']);
        if (!phiResult.authorized) {
          return NextResponse.json({ error: phiResult.error }, { status: 403 });
        }
      }

      // Step 4: Execute handler
      const response = await handler(context, request);

      // Step 5: Log successful access
      if (config.logAccess) {
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

      return response;
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
          ip: request.headers.get('x-forwarded-for')
        }
      );

      return NextResponse.json(
        { error: 'Internal server error' }, 
        { status: 500 }
      );
    }
  }

  // Helper method for common API patterns
  async withSecurity(
    request: NextRequest,
    config: SecurityConfig,
    handler: (context: AccessContext, request: NextRequest) => Promise<NextResponse>
  ): Promise<NextResponse> {
    return this.secureRoute(request, config, handler);
  }
}

export const securityMiddleware = SecurityMiddleware.getInstance();

// Convenience functions for common security patterns
export async function withAuthentication(
  request: NextRequest,
  handler: (context: AccessContext, request: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  return securityMiddleware.withSecurity(request, {
    requiredPermissions: [],
    logAccess: true,
  }, handler);
}

export async function withDoctorAccess(
  request: NextRequest,
  handler: (context: AccessContext, request: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  return securityMiddleware.withSecurity(request, {
    requiredPermissions: [Permission.MEDICAL_BACKGROUND_READ],
    requiredConsents: [ConsentType.DATA_PROCESSING],
    allowPHIAccess: true,
    logAccess: true,
  }, handler);
}

export async function withPatientAccess(
  request: NextRequest,
  handler: (context: AccessContext, request: NextResponse) => Promise<NextResponse>
): Promise<NextResponse> {
  return securityMiddleware.withSecurity(request, {
    requiredPermissions: [Permission.USER_READ],
    requiredConsents: [ConsentType.DATA_PROCESSING],
    logAccess: true,
  }, handler);
}
