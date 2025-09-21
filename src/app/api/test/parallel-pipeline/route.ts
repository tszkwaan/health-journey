import { NextRequest, NextResponse } from 'next/server';
import { ParallelPipeline } from '@/lib/parallel-pipeline';

export async function POST(request: NextRequest) {
  try {
    const { data, batchSize = 10 } = await request.json();
    
    if (!data) {
      return NextResponse.json(
        { error: 'Data is required' },
        { status: 400 }
      );
    }

    let result;
    
    if (Array.isArray(data)) {
      // Batch processing
      result = await ParallelPipeline.processBatch(data, batchSize);
    } else if (typeof data === 'string') {
      // Single item processing
      const singleResult = await ParallelPipeline.process(data);
      result = {
        results: [singleResult],
        totalProcessingTime: singleResult.processingTime,
        averageProcessingTime: singleResult.processingTime,
        cacheHitRate: singleResult.cacheHit ? 1 : 0
      };
    } else {
      return NextResponse.json(
        { error: 'Data must be a string or array of strings' },
        { status: 400 }
      );
    }

    const stats = ParallelPipeline.getStats();
    
    return NextResponse.json({
      success: true,
      ...result,
      performance_stats: stats
    });
    
  } catch (error) {
    console.error('Error in parallel pipeline test endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error during parallel processing' },
      { status: 500 }
    );
  }
}
