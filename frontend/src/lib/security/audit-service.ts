import { prisma } from '@/lib/prisma';
import { AuditAction, AuditResource, Role } from '@prisma/client';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

export interface AuditLogData {
  userId?: string;
  userRole?: Role;
  userEmail?: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;
  oldValues?: any;
  newValues?: any;
  metadata?: any;
  isSuccess?: boolean;
  errorCode?: string;
  errorMessage?: string;
  phiAccessed?: boolean;
  phiFields?: string[];
  consentRequired?: boolean;
  consentGiven?: boolean;
  consentVersion?: string;
}

export class AuditService {
  private static instance: AuditService;
  private encryptionKey: string;

  constructor() {
    this.encryptionKey = process.env.AUDIT_ENCRYPTION_KEY || this.generateKey();
  }

  static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  private generateKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private encryptSensitiveData(data: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);
    cipher.setAAD(Buffer.from('audit-data'));
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
  }

  private extractRequestInfo(request: NextRequest) {
    const ipAddress = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const sessionId = request.headers.get('x-session-id') || 'unknown';
    
    return { ipAddress, userAgent, sessionId };
  }

  async logAuditEvent(
    data: AuditLogData,
    request?: NextRequest
  ): Promise<void> {
    try {
      const requestInfo = request ? this.extractRequestInfo(request) : {
        ipAddress: 'system',
        userAgent: 'system',
        sessionId: 'system'
      };

      // Encrypt sensitive data
      const encryptedEmail = data.userEmail ? 
        this.encryptSensitiveData(data.userEmail) : null;

      await prisma.auditLog.create({
        data: {
          userId: data.userId,
          userRole: data.userRole,
          userEmail: encryptedEmail,
          action: data.action,
          resource: data.resource,
          resourceId: data.resourceId,
          oldValues: data.oldValues,
          newValues: data.newValues,
          metadata: data.metadata,
          isSuccess: data.isSuccess ?? true,
          errorCode: data.errorCode,
          errorMessage: data.errorMessage,
          phiAccessed: data.phiAccessed ?? false,
          phiFields: data.phiFields ?? [],
          consentRequired: data.consentRequired ?? false,
          consentGiven: data.consentGiven ?? false,
          consentVersion: data.consentVersion,
          ipAddress: requestInfo.ipAddress,
          userAgent: requestInfo.userAgent,
          sessionId: requestInfo.sessionId,
        },
      });
    } catch (error) {
      console.error('Failed to log audit event:', error);
      // Don't throw error to avoid breaking the main flow
    }
  }

  async logUserAction(
    userId: string,
    userRole: Role,
    userEmail: string,
    action: AuditAction,
    resource: AuditResource,
    resourceId?: string,
    request?: NextRequest,
    additionalData?: Partial<AuditLogData>
  ): Promise<void> {
    await this.logAuditEvent({
      userId,
      userRole,
      userEmail,
      action,
      resource,
      resourceId,
      ...additionalData,
    }, request);
  }

  async logPHIAccess(
    userId: string,
    userRole: Role,
    userEmail: string,
    resource: AuditResource,
    resourceId: string,
    phiFields: string[],
    request?: NextRequest
  ): Promise<void> {
    await this.logAuditEvent({
      userId,
      userRole,
      userEmail,
      action: AuditAction.PHI_ACCESS,
      resource,
      resourceId,
      phiAccessed: true,
      phiFields,
    }, request);
  }

  async logConsentAction(
    userId: string,
    userRole: Role,
    userEmail: string,
    action: AuditAction.CONSENT_GRANTED | AuditAction.CONSENT_REVOKED,
    consentType: string,
    request?: NextRequest
  ): Promise<void> {
    await this.logAuditEvent({
      userId,
      userRole,
      userEmail,
      action,
      resource: AuditResource.USER,
      resourceId: userId,
      metadata: { consentType },
    }, request);
  }

  async logSystemEvent(
    action: AuditAction,
    resource: AuditResource,
    resourceId?: string,
    metadata?: any
  ): Promise<void> {
    await this.logAuditEvent({
      action,
      resource,
      resourceId,
      metadata,
    });
  }

  async getAuditLogs(
    userId?: string,
    resource?: AuditResource,
    startDate?: Date,
    endDate?: Date,
    limit: number = 100
  ) {
    const where: any = {};
    
    if (userId) where.userId = userId;
    if (resource) where.resource = resource;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    return await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
          }
        }
      }
    });
  }

  async getPHIAccessLogs(
    userId?: string,
    startDate?: Date,
    endDate?: Date
  ) {
    const where: any = {
      phiAccessed: true,
    };
    
    if (userId) where.userId = userId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    return await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
          }
        }
      }
    });
  }
}

export const auditService = AuditService.getInstance();
