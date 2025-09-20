import { NextRequest, NextResponse } from 'next/server';
import { auditService } from '@/lib/security/audit-service';
import { withDoctorAccess } from '@/lib/security/security-middleware-enhanced';

// GET /api/audit - Get audit logs (doctor/admin only)
export async function GET(request: NextRequest) {
  return withDoctorAccess(request, async (context, req) => {
    try {
      const { searchParams } = new URL(req.url);
      const userId = searchParams.get('userId');
      const resource = searchParams.get('resource') as any;
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');
      const limit = parseInt(searchParams.get('limit') || '100');

      const auditLogs = await auditService.getAuditLogs(
        userId || undefined,
        resource,
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined,
        limit
      );

      return NextResponse.json({
        success: true,
        data: auditLogs
      });
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch audit logs' },
        { status: 500 }
      );
    }
  });
}
