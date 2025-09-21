import { NextRequest, NextResponse } from 'next/server';
import { WorkerRedactionManager } from '@/lib/worker-redaction';

// Global worker manager instance
let workerManager: WorkerRedactionManager | null = null;

async function getWorkerManager(): Promise<WorkerRedactionManager> {
  if (!workerManager) {
    workerManager = new WorkerRedactionManager(4); // Use 4 workers
    await workerManager.initialize();
  }
  return workerManager;
}

export async function POST(request: NextRequest) {
  try {
    const { data, batch = false } = await request.json();
    
    if (!data) {
      return NextResponse.json(
        { error: 'Data is required' },
        { status: 400 }
      );
    }

    const manager = await getWorkerManager();
    const startTime = performance.now();
    
    if (batch && Array.isArray(data)) {
      // Batch processing with worker threads
      const result = await manager.batchRedact(data);
      const totalTime = performance.now() - startTime;
      
      return NextResponse.json({
        success: true,
        ...result,
        totalProcessingTime: totalTime,
        method: 'WORKER_BATCH'
      });
    } else if (typeof data === 'string') {
      // Single item processing
      const result = await manager.redact(data);
      
      return NextResponse.json({
        success: true,
        ...result,
        method: 'WORKER'
      });
    } else {
      return NextResponse.json(
        { error: 'Data must be a string or array of strings' },
        { status: 400 }
      );
    }
    
  } catch (error) {
    console.error('Error in worker redaction endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error during worker redaction' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const manager = await getWorkerManager();
    const stats = manager.getStats();
    
    return NextResponse.json({
      success: true,
      message: 'Worker threads initialized',
      stats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error getting worker stats:', error);
    return NextResponse.json(
      { error: 'Failed to get worker statistics' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (workerManager) {
      await workerManager.terminate();
      workerManager = null;
    }
    
    return NextResponse.json({
      success: true,
      message: 'Worker threads terminated',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error terminating workers:', error);
    return NextResponse.json(
      { error: 'Failed to terminate worker threads' },
      { status: 500 }
    );
  }
}
