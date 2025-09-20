import { NextRequest, NextResponse } from 'next/server';
import { auditService } from '@/lib/security/audit-service';
import { withDoctorAccess } from '@/lib/security/security-middleware-enhanced';

// GET /api/audit/phi - Get PHI access logs (doctor/admin only)
export async function GET(request: NextRequest) {
  return withDoctorAccess(request, async (context, req) => {
    try {
      const { searchParams } = new URL(req.url);
      const userId = searchParams.get('userId');
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');

      const phiLogs = await auditService.getPHIAccessLogs(
        userId || undefined,
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined
      );

      return NextResponse.json({
        success: true,
        data: phiLogs
      });
    } catch (error) {
      console.error('Error fetching PHI access logs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch PHI access logs' },
        { status: 500 }
      );
    }
  });
}
