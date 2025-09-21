/**
 * Worker Threads PHI Redaction
 * 
 * This module provides parallel processing using Node.js Worker Threads
 * for maximum performance in PHI redaction operations.
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { PHIPattern } from './phi-redaction';

export interface WorkerRedactionResult {
  redactedText: string;
  processingTime: number;
  patternsApplied: number;
  workerId: number;
}

export interface WorkerBatchResult {
  results: WorkerRedactionResult[];
  totalProcessingTime: number;
  averageProcessingTime: number;
  workersUsed: number;
}

export class WorkerRedactionManager {
  private workers: Worker[] = [];
  private maxWorkers: number;
  private workerIdCounter = 0;
  private isInitialized = false;

  constructor(maxWorkers: number = 4) {
    this.maxWorkers = Math.min(maxWorkers, require('os').cpus().length);
  }

  /**
   * Initialize worker threads
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log(`Initializing ${this.maxWorkers} worker threads for PHI redaction...`);

    for (let i = 0; i < this.maxWorkers; i++) {
      const worker = new Worker(__filename, {
        workerData: { workerId: i }
      });

      worker.on('error', (error) => {
        console.error(`Worker ${i} error:`, error);
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          console.error(`Worker ${i} stopped with exit code ${code}`);
        }
      });

      this.workers.push(worker);
    }

    this.isInitialized = true;
    console.log(`Successfully initialized ${this.workers.length} worker threads`);
  }

  /**
   * Redact text using worker threads
   */
  async redact(text: string): Promise<WorkerRedactionResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const worker = this.getAvailableWorker();
      const workerId = this.workerIdCounter++ % this.workers.length;

      const timeout = setTimeout(() => {
        reject(new Error('Worker redaction timeout'));
      }, 5000);

      worker.postMessage({
        type: 'redact',
        data: text,
        workerId
      });

      worker.once('message', (result: WorkerRedactionResult) => {
        clearTimeout(timeout);
        resolve(result);
      });

      worker.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Batch redact using multiple workers
   */
  async batchRedact(texts: string[]): Promise<WorkerBatchResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = performance.now();
    const chunkSize = Math.ceil(texts.length / this.workers.length);
    const chunks = this.chunkArray(texts, chunkSize);

    console.log(`Processing ${texts.length} texts using ${chunks.length} workers`);

    const promises = chunks.map((chunk, index) => 
      this.processChunk(chunk, index)
    );

    const results = await Promise.all(promises);
    const allResults = results.flat();
    const totalTime = performance.now() - startTime;

    return {
      results: allResults,
      totalProcessingTime: totalTime,
      averageProcessingTime: totalTime / texts.length,
      workersUsed: chunks.length
    };
  }

  /**
   * Process a chunk of texts using a single worker
   */
  private async processChunk(texts: string[], workerIndex: number): Promise<WorkerRedactionResult[]> {
    const worker = this.workers[workerIndex];
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Worker ${workerIndex} chunk processing timeout`));
      }, 10000);

      worker.postMessage({
        type: 'batch',
        data: texts,
        workerId: workerIndex
      });

      worker.once('message', (results: WorkerRedactionResult[]) => {
        clearTimeout(timeout);
        resolve(results);
      });

      worker.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Get an available worker (round-robin)
   */
  private getAvailableWorker(): Worker {
    return this.workers[this.workerIdCounter % this.workers.length];
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Get worker statistics
   */
  getStats() {
    return {
      isInitialized: this.isInitialized,
      maxWorkers: this.maxWorkers,
      activeWorkers: this.workers.length,
      workerIds: this.workers.map((_, index) => index)
    };
  }

  /**
   * Terminate all workers
   */
  async terminate(): Promise<void> {
    console.log('Terminating worker threads...');
    
    const terminationPromises = this.workers.map(worker => 
      new Promise<void>((resolve) => {
        worker.terminate().then(() => resolve());
      })
    );

    await Promise.all(terminationPromises);
    this.workers = [];
    this.isInitialized = false;
    
    console.log('All worker threads terminated');
  }
}

// Worker thread implementation
if (!isMainThread) {
  const { workerId } = workerData;
  
  // PHI patterns for worker processing
  const patterns: PHIPattern[] = [
    {
      name: 'SSN',
      pattern: /\b\d{3}-?\d{2}-?\d{4}\b/g,
      replacement: '[REDACTED_SSN]',
      category: 'identifier'
    },
    {
      name: 'Phone Numbers',
      pattern: /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
      replacement: '[REDACTED_PHONE]',
      category: 'contact'
    },
    {
      name: 'Email Addresses',
      pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      replacement: '[REDACTED_EMAIL]',
      category: 'contact'
    },
    {
      name: 'Full Name',
      pattern: /\b[A-Z][a-z]+ [A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g,
      replacement: '[REDACTED_NAME]',
      category: 'name'
    },
    {
      name: 'Date Patterns',
      pattern: /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g,
      replacement: '[REDACTED_DATE]',
      category: 'date'
    },
    {
      name: 'Medical Record Numbers',
      pattern: /\b(?:MRN|Medical Record|Record #?)\s*:?\s*[A-Z0-9-]{6,}\b/gi,
      replacement: '[REDACTED_MRN]',
      category: 'identifier'
    }
  ];

  /**
   * Redact text using worker patterns
   */
  function redactText(text: string): WorkerRedactionResult {
    const startTime = performance.now();
    
    if (!text || typeof text !== 'string') {
      return {
        redactedText: text,
        processingTime: 0,
        patternsApplied: 0,
        workerId
      };
    }

    // Fast PHI detection
    if (!likelyContainsPHI(text)) {
      return {
        redactedText: text,
        processingTime: performance.now() - startTime,
        patternsApplied: 0,
        workerId
      };
    }

    let redacted = text;
    let patternsApplied = 0;

    for (const pattern of patterns) {
      const original = redacted;
      redacted = redacted.replace(pattern.pattern, pattern.replacement);
      if (redacted !== original) {
        patternsApplied++;
      }
    }

    const processingTime = performance.now() - startTime;

    return {
      redactedText: redacted,
      processingTime,
      patternsApplied,
      workerId
    };
  }

  /**
   * Check if text likely contains PHI
   */
  function likelyContainsPHI(text: string): boolean {
    if (text.length < 10) return false;
    
    return text.includes('@') || // Email
           text.includes('SSN') || // SSN keyword
           text.includes('DOB') || // DOB keyword
           text.includes('MRN') || // Medical record
           text.includes('(555)') || // Phone pattern
           (text.match(/\d/g) || []).length > 5; // Lots of numbers
  }

  // Listen for messages from main thread
  parentPort?.on('message', (message) => {
    const { type, data, workerId: messageWorkerId } = message;

    try {
      if (type === 'redact') {
        const result = redactText(data);
        parentPort?.postMessage(result);
      } else if (type === 'batch') {
        const results = data.map((text: string) => redactText(text));
        parentPort?.postMessage(results);
      }
    } catch (error) {
      parentPort?.postMessage({
        error: error instanceof Error ? error.message : 'Unknown error',
        workerId: messageWorkerId || workerId
      });
    }
  });

  console.log(`Worker thread ${workerId} initialized and ready`);
}
