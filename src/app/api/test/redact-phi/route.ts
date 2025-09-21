import { NextRequest, NextResponse } from 'next/server';
import { OptimizedPHIRedactor } from '@/lib/phi-redaction-optimized';

export async function POST(request: NextRequest) {
  try {
    const { data } = await request.json();
    
    if (!data || typeof data !== 'string') {
      return NextResponse.json(
        { error: 'Data is required and must be a string' },
        { status: 400 }
      );
    }
    
    // Use the optimized PHI redaction function
    const redacted_data = OptimizedPHIRedactor.redact(data);
    const stats = OptimizedPHIRedactor.getStats();
    
    return NextResponse.json({
      success: true,
      original_data: data,
      redacted_data: redacted_data,
      redaction_applied: data !== redacted_data,
      performance_stats: stats
    });
    
  } catch (error) {
    console.error('Error in PHI redaction test endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error during PHI redaction' },
      { status: 500 }
    );
  }
}
