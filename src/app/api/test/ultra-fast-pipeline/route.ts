import { NextRequest, NextResponse } from 'next/server';
import { UltraFastPipeline } from '@/lib/ultra-fast-pipeline';

export async function POST(request: NextRequest) {
  try {
    const { data, streaming = false, chunkSize = 500 } = await request.json();
    
    if (!data) {
      return NextResponse.json(
        { error: 'Data is required' },
        { status: 400 }
      );
    }

    const startTime = performance.now();
    
    if (Array.isArray(data)) {
      // Batch processing
      const results = UltraFastPipeline.processBatch(data);
      const processingTime = performance.now() - startTime;
      
      return NextResponse.json({
        success: true,
        results,
        totalProcessingTime: processingTime,
        averageProcessingTime: processingTime / data.length,
        performance_stats: UltraFastPipeline.getStats()
      });
    } else if (typeof data === 'string') {
      if (streaming) {
        // Streaming processing
        const results: any[] = [];
        const stream = UltraFastPipeline.processStreaming(data, chunkSize);
        
        for (const result of stream) {
          results.push(result);
        }
        
        const processingTime = performance.now() - startTime;
        
        return NextResponse.json({
          success: true,
          results,
          totalProcessingTime: processingTime,
          performance_stats: UltraFastPipeline.getStats()
        });
      } else {
        // Single item processing
        const result = UltraFastPipeline.process(data);
        
        return NextResponse.json({
          success: true,
          ...result,
          performance_stats: UltraFastPipeline.getStats()
        });
      }
    } else {
      return NextResponse.json(
        { error: 'Data must be a string or array of strings' },
        { status: 400 }
      );
    }
    
  } catch (error) {
    console.error('Error in ultra-fast pipeline endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error during ultra-fast processing' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Return performance statistics
    const stats = UltraFastPipeline.getStats();
    
    return NextResponse.json({
      success: true,
      performance_stats: stats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error getting ultra-fast pipeline stats:', error);
    return NextResponse.json(
      { error: 'Internal server error getting stats' },
      { status: 500 }
    );
  }
}
