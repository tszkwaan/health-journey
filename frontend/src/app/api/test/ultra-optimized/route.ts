import { NextRequest, NextResponse } from 'next/server';
import { UltraOptimizedPipeline } from '@/lib/ultra-optimized-pipeline';

export async function POST(request: NextRequest) {
  try {
    const { data, streaming = false, chunkSize = 1000 } = await request.json();
    
    if (!data) {
      return NextResponse.json(
        { error: 'Data is required' },
        { status: 400 }
      );
    }

    const startTime = performance.now();
    
    if (Array.isArray(data)) {
      // Batch processing
      const results = UltraOptimizedPipeline.processBatch(data);
      const totalTime = performance.now() - startTime;
      
      return NextResponse.json({
        success: true,
        results,
        totalProcessingTime: totalTime,
        averageProcessingTime: totalTime / data.length,
        performance_stats: UltraOptimizedPipeline.getStats()
      });
    } else if (typeof data === 'string') {
      if (streaming) {
        // Streaming processing
        const results: any[] = [];
        const stream = UltraOptimizedPipeline.processStreaming(data, chunkSize);
        
        for (const result of stream) {
          results.push(result);
        }
        
        const totalTime = performance.now() - startTime;
        
        return NextResponse.json({
          success: true,
          results,
          totalProcessingTime: totalTime,
          performance_stats: UltraOptimizedPipeline.getStats()
        });
      } else {
        // Single item processing
        const result = UltraOptimizedPipeline.process(data);
        
        return NextResponse.json({
          success: true,
          redacted: result.redacted,
          processingTime: result.processingTime,
          performance_stats: UltraOptimizedPipeline.getStats()
        });
      }
    } else {
      return NextResponse.json(
        { error: 'Data must be a string or array of strings' },
        { status: 400 }
      );
    }
    
  } catch (error) {
    console.error('Error in ultra-optimized pipeline endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error during ultra-optimized processing' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Warm up the pipeline
    UltraOptimizedPipeline.warmup();
    
    const stats = UltraOptimizedPipeline.getStats();
    
    return NextResponse.json({
      success: true,
      performance_stats: stats,
      timestamp: new Date().toISOString(),
      message: 'Pipeline warmed up and ready for <100ms P95 processing'
    });
    
  } catch (error) {
    console.error('Error warming up ultra-optimized pipeline:', error);
    return NextResponse.json(
      { error: 'Internal server error warming up pipeline' },
      { status: 500 }
    );
  }
}
