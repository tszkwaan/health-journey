import { Role } from '@prisma/client';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { auditService } from './audit-service';

export enum Permission {
  // User permissions
  USER_READ = 'user:read',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',
  
  // Reservation permissions
  RESERVATION_READ = 'reservation:read',
  RESERVATION_CREATE = 'reservation:create',
  RESERVATION_UPDATE = 'reservation:update',
  RESERVATION_DELETE = 'reservation:delete',
  
  // Medical background permissions
  MEDICAL_BACKGROUND_READ = 'medical_background:read',
  MEDICAL_BACKGROUND_UPDATE = 'medical_background:update',
  
  // Intake session permissions
  INTAKE_SESSION_READ = 'intake_session:read',
  INTAKE_SESSION_CREATE = 'intake_session:create',
  INTAKE_SESSION_UPDATE = 'intake_session:update',
  
  // Consultation permissions
  CONSULTATION_READ = 'consultation:read',
  CONSULTATION_CREATE = 'consultation:create',
  CONSULTATION_UPDATE = 'consultation:update',
  
  // Form permissions
  FORM_READ = 'form:read',
  FORM_CREATE = 'form:create',
  FORM_UPDATE = 'form:update',
  FORM_DELETE = 'form:delete',
  
  // Audit permissions
  AUDIT_READ = 'audit:read',
  AUDIT_EXPORT = 'audit:export',
  
  // System permissions
  SYSTEM_ADMIN = 'system:admin',
  SYSTEM_CONFIG = 'system:config',
}

export interface AccessContext {
  userId: string;
  userRole: Role;
  userEmail: string;
  resourceId?: string;
  resourceOwnerId?: string;
  request?: NextRequest;
}

export class RBACService {
  private static instance: RBACService;
  
  // Role-based permissions mapping
  private rolePermissions: Map<Role, Permission[]> = new Map([
    [Role.PATIENT, [
      Permission.USER_READ,
      Permission.USER_UPDATE,
      Permission.RESERVATION_READ,
      Permission.RESERVATION_CREATE,
      Permission.MEDICAL_BACKGROUND_READ,
      Permission.MEDICAL_BACKGROUND_UPDATE,
      Permission.INTAKE_SESSION_READ,
      Permission.INTAKE_SESSION_CREATE,
      Permission.INTAKE_SESSION_UPDATE,
      Permission.CONSULTATION_READ,
      Permission.FORM_READ,
    ]],
    [Role.DOCTOR, [
      Permission.USER_READ,
      Permission.USER_UPDATE,
      Permission.RESERVATION_READ,
      Permission.RESERVATION_UPDATE,
      Permission.MEDICAL_BACKGROUND_READ,
      Permission.INTAKE_SESSION_READ,
      Permission.CONSULTATION_READ,
      Permission.CONSULTATION_CREATE,
      Permission.CONSULTATION_UPDATE,
      Permission.FORM_READ,
      Permission.FORM_CREATE,
      Permission.FORM_UPDATE,
      Permission.FORM_DELETE,
    ]],
  ]);

  static getInstance(): RBACService {
    if (!RBACService.instance) {
      RBACService.instance = new RBACService();
    }
    return RBACService.instance;
  }

  private hasPermission(userRole: Role, permission: Permission): boolean {
    const permissions = this.rolePermissions.get(userRole) || [];
    return permissions.includes(permission);
  }

  private async logAccessDenied(
    context: AccessContext,
    permission: Permission,
    reason: string
  ): Promise<void> {
    await auditService.logAuditEvent({
      userId: context.userId,
      userRole: context.userRole,
      userEmail: context.userEmail,
      action: 'ACCESS_DENIED' as any,
      resource: 'SYSTEM' as any,
      resourceId: context.resourceId,
      isSuccess: false,
      errorMessage: `Access denied: ${reason}`,
      metadata: { permission, reason },
    }, context.request);
  }

  async checkPermission(
    context: AccessContext,
    permission: Permission
  ): Promise<boolean> {
    try {
      // Check if user has the required permission
      if (!this.hasPermission(context.userRole, permission)) {
        await this.logAccessDenied(
          context,
          permission,
          `User role ${context.userRole} does not have permission ${permission}`
        );
        return false;
      }

      // Additional resource-specific checks
      if (context.resourceOwnerId && context.resourceOwnerId !== context.userId) {
        // Check if user can access resources owned by others
        const canAccessOthersResources = this.canAccessOthersResources(
          context.userRole,
          permission
        );
        
        if (!canAccessOthersResources) {
          await this.logAccessDenied(
            context,
            permission,
            `User cannot access resources owned by others`
          );
          return false;
        }
      }

      // Log successful access
      await auditService.logAuditEvent({
        userId: context.userId,
        userRole: context.userRole,
        userEmail: context.userEmail,
        action: 'READ' as any,
        resource: this.getResourceFromPermission(permission),
        resourceId: context.resourceId,
        isSuccess: true,
        metadata: { permission },
      }, context.request);

      return true;
    } catch (error) {
      console.error('Error checking permission:', error);
      await this.logAccessDenied(
        context,
        permission,
        `Error checking permission: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return false;
    }
  }

  private canAccessOthersResources(userRole: Role, permission: Permission): boolean {
    // Doctors can access patient resources for medical purposes
    if (userRole === Role.DOCTOR) {
      const doctorPermissions = [
        Permission.RESERVATION_READ,
        Permission.MEDICAL_BACKGROUND_READ,
        Permission.INTAKE_SESSION_READ,
        Permission.CONSULTATION_READ,
        Permission.CONSULTATION_CREATE,
        Permission.CONSULTATION_UPDATE,
        Permission.FORM_READ,
        Permission.FORM_CREATE,
        Permission.FORM_UPDATE,
        Permission.FORM_DELETE,
      ];
      return doctorPermissions.includes(permission);
    }

    // Patients can only access their own resources
    return false;
  }

  private getResourceFromPermission(permission: Permission): string {
    const [resource] = permission.split(':');
    return resource.toUpperCase();
  }

  async requirePermission(
    context: AccessContext,
    permission: Permission
  ): Promise<void> {
    const hasAccess = await this.checkPermission(context, permission);
    if (!hasAccess) {
      throw new Error(`Access denied: Insufficient permissions for ${permission}`);
    }
  }

  async getContextFromRequest(request: NextRequest): Promise<AccessContext | null> {
    try {
      const session = await getServerSession(authOptions);
      
      if (!session?.user?.id) {
        return null;
      }

      return {
        userId: session.user.id,
        userRole: (session.user as any).role,
        userEmail: session.user.email || '',
        request,
      };
    } catch (error) {
      console.error('Error getting context from request:', error);
      return null;
    }
  }

  async checkPHIAccess(
    context: AccessContext,
    phiFields: string[]
  ): Promise<boolean> {
    // Log PHI access
    await auditService.logPHIAccess(
      context.userId,
      context.userRole,
      context.userEmail,
      'MEDICAL_BACKGROUND' as any,
      context.resourceId || '',
      phiFields,
      context.request
    );

    // Check if user has permission to access PHI
    return await this.checkPermission(context, Permission.MEDICAL_BACKGROUND_READ);
  }

  async checkConsentRequired(
    context: AccessContext,
    consentType: string
  ): Promise<boolean> {
    // This would check if the user has given consent for the specific action
    // For now, we'll assume consent is required for PHI access
    const phiPermissions = [
      Permission.MEDICAL_BACKGROUND_READ,
      Permission.MEDICAL_BACKGROUND_UPDATE,
      Permission.CONSULTATION_READ,
      Permission.FORM_READ,
    ];

    return phiPermissions.some(permission => 
      this.hasPermission(context.userRole, permission)
    );
  }

  // Middleware for API routes
  static async withPermission(
    request: NextRequest,
    permission: Permission,
    additionalChecks?: (context: AccessContext) => Promise<boolean>
  ): Promise<{ context: AccessContext; hasAccess: boolean }> {
    const rbac = RBACService.getInstance();
    const context = await rbac.getContextFromRequest(request);
    
    if (!context) {
      return { context: {} as AccessContext, hasAccess: false };
    }

    let hasAccess = await rbac.checkPermission(context, permission);
    
    if (hasAccess && additionalChecks) {
      hasAccess = await additionalChecks(context);
    }

    return { context, hasAccess };
  }
}

export const rbacService = RBACService.getInstance();
