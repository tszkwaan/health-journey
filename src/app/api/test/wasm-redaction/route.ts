import { NextRequest, NextResponse } from 'next/server';
import { initWasmRedactor, redactWithWasm, redactWithWasmStats, batchRedactWithWasm } from '@/lib/wasm-redaction';

export async function POST(request: NextRequest) {
  try {
    const { data, withStats = false, batch = false } = await request.json();
    
    if (!data) {
      return NextResponse.json(
        { error: 'Data is required' },
        { status: 400 }
      );
    }

    const startTime = performance.now();
    
    if (batch && Array.isArray(data)) {
      // Batch processing with WASM
      const results = await batchRedactWithWasm(data);
      const totalTime = performance.now() - startTime;
      
      return NextResponse.json({
        success: true,
        results,
        totalProcessingTime: totalTime,
        averageProcessingTime: totalTime / data.length,
        method: 'WASM_BATCH'
      });
    } else if (typeof data === 'string') {
      if (withStats) {
        // Single item with statistics
        const result = await redactWithWasmStats(data);
        
        return NextResponse.json({
          success: true,
          ...result,
          method: 'WASM_STATS'
        });
      } else {
        // Single item processing
        const redacted = await redactWithWasm(data);
        
        return NextResponse.json({
          success: true,
          redacted_text: redacted,
          processing_time_ms: performance.now() - startTime,
          method: 'WASM'
        });
      }
    } else {
      return NextResponse.json(
        { error: 'Data must be a string or array of strings' },
        { status: 400 }
      );
    }
    
  } catch (error) {
    console.error('Error in WASM redaction endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error during WASM redaction' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Initialize WASM module
    const redactor = await initWasmRedactor();
    
    return NextResponse.json({
      success: true,
      message: 'WASM redaction module initialized',
      patternCount: redactor.getPatternCount(),
      patternNames: redactor.getPatternNames(),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error initializing WASM redaction:', error);
    return NextResponse.json(
      { error: 'Failed to initialize WASM redaction module' },
      { status: 500 }
    );
  }
}
