import { prisma } from '@/lib/prisma';
import { ConsentType, ConsentStatus, Role } from '@prisma/client';
import { NextRequest } from 'next/server';
import { auditService } from './audit-service';

// Re-export types for easier importing
export { ConsentType, ConsentStatus } from '@prisma/client';

export interface ConsentData {
  userId: string;
  userRole: Role;
  userEmail: string;
  consentType: ConsentType;
  consentText: string;
  version: string;
  expiresAt?: Date;
  request?: NextRequest;
}

export interface ConsentCheckResult {
  hasConsent: boolean;
  consentRecord?: any;
  requiredConsent?: ConsentType[];
}

export class ConsentService {
  private static instance: ConsentService;

  static getInstance(): ConsentService {
    if (!ConsentService.instance) {
      ConsentService.instance = new ConsentService();
    }
    return ConsentService.instance;
  }

  async grantConsent(data: ConsentData): Promise<any> {
    try {
      // Check if user already has this type of consent
      const existingConsent = await prisma.consentRecord.findFirst({
        where: {
          userId: data.userId,
          consentType: data.consentType,
          status: ConsentStatus.GRANTED,
        },
        orderBy: { createdAt: 'desc' }
      });

      if (existingConsent) {
        // Update existing consent
        const updatedConsent = await prisma.consentRecord.update({
          where: { id: existingConsent.id },
          data: {
            status: ConsentStatus.GRANTED,
            grantedAt: new Date(),
            revokedAt: null,
            expiresAt: data.expiresAt,
            version: data.version,
            consentText: data.consentText,
            ipAddress: data.request?.headers.get('x-forwarded-for') || 'unknown',
            userAgent: data.request?.headers.get('user-agent') || 'unknown',
            sessionId: data.request?.headers.get('x-session-id') || 'unknown',
          }
        });

        // Log consent action
        await auditService.logConsentAction(
          data.userId,
          data.userRole,
          data.userEmail,
          'CONSENT_GRANTED' as any,
          data.consentType,
          data.request
        );

        return updatedConsent;
      } else {
        // Create new consent record
        const newConsent = await prisma.consentRecord.create({
          data: {
            userId: data.userId,
            consentType: data.consentType,
            status: ConsentStatus.GRANTED,
            version: data.version,
            consentText: data.consentText,
            grantedAt: new Date(),
            expiresAt: data.expiresAt,
            ipAddress: data.request?.headers.get('x-forwarded-for') || 'unknown',
            userAgent: data.request?.headers.get('user-agent') || 'unknown',
            sessionId: data.request?.headers.get('x-session-id') || 'unknown',
          }
        });

        // Log consent action
        await auditService.logConsentAction(
          data.userId,
          data.userRole,
          data.userEmail,
          'CONSENT_GRANTED' as any,
          data.consentType,
          data.request
        );

        return newConsent;
      }
    } catch (error) {
      console.error('Error granting consent:', error);
      throw new Error('Failed to grant consent');
    }
  }

  async revokeConsent(
    userId: string,
    userRole: Role,
    userEmail: string,
    consentType: ConsentType,
    request?: NextRequest
  ): Promise<void> {
    try {
      const consentRecord = await prisma.consentRecord.findFirst({
        where: {
          userId,
          consentType,
          status: ConsentStatus.GRANTED,
        },
        orderBy: { createdAt: 'desc' }
      });

      if (consentRecord) {
        await prisma.consentRecord.update({
          where: { id: consentRecord.id },
          data: {
            status: ConsentStatus.REVOKED,
            revokedAt: new Date(),
          }
        });

        // Log consent revocation
        await auditService.logConsentAction(
          userId,
          userRole,
          userEmail,
          'CONSENT_REVOKED' as any,
          consentType,
          request
        );
      }
    } catch (error) {
      console.error('Error revoking consent:', error);
      throw new Error('Failed to revoke consent');
    }
  }

  async checkConsent(
    userId: string,
    consentType: ConsentType
  ): Promise<ConsentCheckResult> {
    try {
      const consentRecord = await prisma.consentRecord.findFirst({
        where: {
          userId,
          consentType,
          status: ConsentStatus.GRANTED,
        },
        orderBy: { createdAt: 'desc' }
      });

      if (!consentRecord) {
        return {
          hasConsent: false,
          requiredConsent: [consentType]
        };
      }

      // Check if consent has expired
      if (consentRecord.expiresAt && consentRecord.expiresAt < new Date()) {
        // Mark as expired
        await prisma.consentRecord.update({
          where: { id: consentRecord.id },
          data: { status: ConsentStatus.EXPIRED }
        });

        return {
          hasConsent: false,
          requiredConsent: [consentType]
        };
      }

      return {
        hasConsent: true,
        consentRecord
      };
    } catch (error) {
      console.error('Error checking consent:', error);
      return {
        hasConsent: false,
        requiredConsent: [consentType]
      };
    }
  }

  async checkMultipleConsents(
    userId: string,
    consentTypes: ConsentType[]
  ): Promise<ConsentCheckResult> {
    try {
      const consentRecords = await prisma.consentRecord.findMany({
        where: {
          userId,
          consentType: { in: consentTypes },
          status: ConsentStatus.GRANTED,
        },
        orderBy: { createdAt: 'desc' }
      });

      const grantedConsents = new Set(consentRecords.map(r => r.consentType));
      const missingConsents = consentTypes.filter(type => !grantedConsents.has(type));

      // Check for expired consents
      const expiredConsents = consentRecords.filter(record => 
        record.expiresAt && record.expiresAt < new Date()
      );

      if (expiredConsents.length > 0) {
        // Mark expired consents
        await prisma.consentRecord.updateMany({
          where: {
            id: { in: expiredConsents.map(r => r.id) }
          },
          data: { status: ConsentStatus.EXPIRED }
        });

        const expiredTypes = expiredConsents.map(r => r.consentType);
        missingConsents.push(...expiredTypes);
      }

      return {
        hasConsent: missingConsents.length === 0,
        consentRecord: consentRecords[0], // Return first record for reference
        requiredConsent: missingConsents
      };
    } catch (error) {
      console.error('Error checking multiple consents:', error);
      return {
        hasConsent: false,
        requiredConsent: consentTypes
      };
    }
  }

  async getConsentHistory(userId: string): Promise<any[]> {
    try {
      return await prisma.consentRecord.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      console.error('Error getting consent history:', error);
      return [];
    }
  }

  async getConsentText(consentType: ConsentType): Promise<string> {
    const consentTexts: Record<ConsentType, string> = {
      [ConsentType.DATA_PROCESSING]: `
        I consent to the processing of my personal data for the purpose of providing healthcare services.
        This includes storing my medical information, appointment details, and consultation records.
        I understand that this data will be used solely for my medical care and will be kept confidential.
      `,
      [ConsentType.VOICE_AI]: `
        I consent to the use of voice recognition technology during my consultations.
        This includes recording and transcribing my voice for the purpose of creating medical records.
        I understand that these recordings will be processed securely and used only for my medical care.
      `,
      [ConsentType.MEDICAL_RECORDS_ACCESS]: `
        I consent to healthcare providers accessing my medical records for the purpose of providing care.
        This includes my medical history, current medications, allergies, and other health information.
        I understand that this access is necessary for proper medical treatment and care coordination.
      `,
      [ConsentType.FORM_GENERATION]: `
        I consent to the use of artificial intelligence to generate medical forms and summaries.
        This includes automated creation of consultation notes, treatment plans, and patient summaries.
        I understand that all AI-generated content will be reviewed by healthcare providers.
      `,
      [ConsentType.EXTERNAL_SHARING]: `
        I consent to sharing my medical information with other healthcare providers when necessary.
        This includes specialists, laboratories, and other medical facilities involved in my care.
        I understand that this sharing is limited to what is necessary for my medical treatment.
      `,
      [ConsentType.RESEARCH_PARTICIPATION]: `
        I consent to the use of my anonymized medical data for research purposes.
        This includes contributing to medical research studies and improving healthcare outcomes.
        I understand that my personal identity will not be disclosed in any research.
      `,
    };

    return consentTexts[consentType] || 'Consent text not available.';
  }

  async requireConsent(
    userId: string,
    userRole: Role,
    userEmail: string,
    consentType: ConsentType,
    request?: NextRequest
  ): Promise<boolean> {
    const result = await this.checkConsent(userId, consentType);
    
    if (!result.hasConsent) {
      // Log that consent was required but not given
      await auditService.logAuditEvent({
        userId,
        userRole,
        userEmail,
        action: 'ACCESS_DENIED' as any,
        resource: 'USER' as any,
        resourceId: userId,
        isSuccess: false,
        errorMessage: `Consent required for ${consentType} but not granted`,
        consentRequired: true,
        consentGiven: false,
        metadata: { requiredConsent: result.requiredConsent }
      }, request);
    }

    return result.hasConsent;
  }
}

export const consentService = ConsentService.getInstance();
