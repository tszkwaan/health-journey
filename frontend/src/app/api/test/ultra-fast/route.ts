import { NextRequest, NextResponse } from 'next/server';
import { UltraOptimizedPipeline } from '@/lib/ultra-optimized-pipeline';

export async function POST(request: NextRequest) {
  try {
    const { data } = await request.json();
    
    if (!data) {
      return NextResponse.json(
        { error: 'Data is required' },
        { status: 400 }
      );
    }

    const startTime = performance.now();
    
    // ULTRA-FAST: Direct processing without HTTP overhead
    const result = UltraOptimizedPipeline.process(data);
    const totalTime = performance.now() - startTime;
    
    return NextResponse.json({
      success: true,
      redacted: result.redacted,
      processingTime: result.processingTime,
      totalTime: totalTime,
      performance_stats: UltraOptimizedPipeline.getStats(),
      optimization: 'ultra-fast-direct-processing'
    });
    
  } catch (error) {
    console.error('Error in ultra-fast endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
