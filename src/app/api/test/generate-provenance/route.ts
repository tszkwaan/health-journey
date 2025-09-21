import { NextRequest, NextResponse } from 'next/server';
import { OptimizedProvenanceGenerator } from '@/lib/provenance-optimized';

export async function POST(request: NextRequest) {
  try {
    const { data } = await request.json();
    
    if (!data || typeof data !== 'string') {
      return NextResponse.json(
        { error: 'Data is required and must be a string' },
        { status: 400 }
      );
    }
    
    // Generate provenance using optimized generator
    const provenance = OptimizedProvenanceGenerator.generate(data);
    const stats = OptimizedProvenanceGenerator.getStats();
    
    return NextResponse.json({
      success: true,
      provenance,
      data_length: data.length,
      checksum: provenance.checksum,
      performance_stats: stats
    });
    
  } catch (error) {
    console.error('Error in provenance generation test endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error during provenance generation' },
      { status: 500 }
    );
  }
}
