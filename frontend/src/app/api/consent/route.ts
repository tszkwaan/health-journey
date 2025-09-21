import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { consentService, ConsentType } from '@/lib/security/consent-service';
import { auditService } from '@/lib/security/audit-service';
import { withAuthentication } from '@/lib/security/security-middleware-enhanced';

// GET /api/consent - Get user's consent status
export async function GET(request: NextRequest) {
  return withAuthentication(request, async (context, req) => {
    try {
      const consentHistory = await consentService.getConsentHistory(context.userId);
      
      return NextResponse.json({
        success: true,
        data: consentHistory
      });
    } catch (error) {
      console.error('Error fetching consent history:', error);
      return NextResponse.json(
        { error: 'Failed to fetch consent history' },
        { status: 500 }
      );
    }
  });
}

// POST /api/consent - Grant consent
export async function POST(request: NextRequest) {
  return withAuthentication(request, async (context, req) => {
    try {
      const { consentType, version, expiresAt } = await request.json();

      if (!consentType || !version) {
        return NextResponse.json(
          { error: 'Consent type and version are required' },
          { status: 400 }
        );
      }

      // Validate consent type
      if (!Object.values(ConsentType).includes(consentType)) {
        return NextResponse.json(
          { error: 'Invalid consent type' },
          { status: 400 }
        );
      }

      // Get consent text
      const consentText = await consentService.getConsentText(consentType);

      // Grant consent
      const consentRecord = await consentService.grantConsent({
        userId: context.userId,
        userRole: context.userRole,
        userEmail: context.userEmail,
        consentType,
        consentText,
        version,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        request: req
      });

      return NextResponse.json({
        success: true,
        data: consentRecord
      });
    } catch (error) {
      console.error('Error granting consent:', error);
      return NextResponse.json(
        { error: 'Failed to grant consent' },
        { status: 500 }
      );
    }
  });
}

// DELETE /api/consent - Revoke consent
export async function DELETE(request: NextRequest) {
  return withAuthentication(request, async (context, req) => {
    try {
      const { consentType } = await request.json();

      if (!consentType) {
        return NextResponse.json(
          { error: 'Consent type is required' },
          { status: 400 }
        );
      }

      // Validate consent type
      if (!Object.values(ConsentType).includes(consentType)) {
        return NextResponse.json(
          { error: 'Invalid consent type' },
          { status: 400 }
        );
      }

      // Revoke consent
      await consentService.revokeConsent(
        context.userId,
        context.userRole,
        context.userEmail,
        consentType,
        req
      );

      return NextResponse.json({
        success: true,
        message: 'Consent revoked successfully'
      });
    } catch (error) {
      console.error('Error revoking consent:', error);
      return NextResponse.json(
        { error: 'Failed to revoke consent' },
        { status: 500 }
      );
    }
  });
}
