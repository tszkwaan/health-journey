/**
 * Parallel Processing Pipeline for Redaction and Provenance
 * 
 * Performance optimizations:
 * 1. Parallel execution of redaction and provenance
 * 2. Streaming results for large data
 * 3. Batch processing with worker-like behavior
 * 4. Result caching and deduplication
 */

import { OptimizedPHIRedactor } from './phi-redaction-optimized';
import { OptimizedProvenanceGenerator } from './provenance-optimized';

export interface PipelineResult {
  originalData: string;
  redactedData: string;
  provenance: any;
  processingTime: number;
  cacheHit: boolean;
}

export interface BatchPipelineResult {
  results: PipelineResult[];
  totalProcessingTime: number;
  averageProcessingTime: number;
  cacheHitRate: number;
}

export class ParallelPipeline {
  private static cache = new Map<string, PipelineResult>();
  private static cacheHits = 0;
  private static cacheMisses = 0;
  private static maxCacheSize = 500;

  /**
   * Process single data item with parallel redaction and provenance
   */
  static async process(data: string): Promise<PipelineResult> {
    const startTime = performance.now();
    
    // Check cache first
    const cacheKey = this.getCacheKey(data);
    if (this.cache.has(cacheKey)) {
      this.cacheHits++;
      const cached = this.cache.get(cacheKey)!;
      return {
        ...cached,
        cacheHit: true
      };
    }

    // Run redaction and provenance generation in parallel
    const [redactedData, provenance] = await Promise.all([
      this.redactData(data),
      this.generateProvenance(data)
    ]);

    const processingTime = performance.now() - startTime;

    const result: PipelineResult = {
      originalData: data,
      redactedData,
      provenance,
      processingTime,
      cacheHit: false
    };

    // Cache result
    this.cacheResult(cacheKey, result);
    this.cacheMisses++;

    return result;
  }

  /**
   * Process multiple data items in parallel batches
   */
  static async processBatch(dataItems: string[], batchSize: number = 10): Promise<BatchPipelineResult> {
    const startTime = performance.now();
    const results: PipelineResult[] = [];

    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < dataItems.length; i += batchSize) {
      const batch = dataItems.slice(i, i + batchSize);
      const batchPromises = batch.map(data => this.process(data));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    const totalProcessingTime = performance.now() - startTime;
    const averageProcessingTime = totalProcessingTime / dataItems.length;
    const cacheHitRate = this.cacheHits / (this.cacheHits + this.cacheMisses) || 0;

    return {
      results,
      totalProcessingTime,
      averageProcessingTime,
      cacheHitRate
    };
  }

  /**
   * Stream processing for large data (chunked processing)
   */
  static async *processStream(data: string, chunkSize: number = 1000): AsyncGenerator<PipelineResult> {
    const chunks = this.chunkString(data, chunkSize);
    
    for (const chunk of chunks) {
      yield await this.process(chunk);
    }
  }

  /**
   * Process with immediate streaming results
   */
  static async processWithStreaming(
    data: string, 
    onResult: (result: PipelineResult) => void,
    chunkSize: number = 1000
  ): Promise<void> {
    const chunks = this.chunkString(data, chunkSize);
    
    // Process chunks in parallel but yield results as they complete
    const promises = chunks.map(async (chunk, index) => {
      const result = await this.process(chunk);
      onResult({ ...result, chunkIndex: index });
      return result;
    });

    await Promise.all(promises);
  }

  /**
   * Redact data using optimized redactor
   */
  private static async redactData(data: string): Promise<string> {
    return OptimizedPHIRedactor.redact(data);
  }

  /**
   * Generate provenance using optimized generator
   */
  private static async generateProvenance(data: string): Promise<any> {
    return OptimizedProvenanceGenerator.generate(data);
  }

  /**
   * Split string into chunks for processing
   */
  private static chunkString(str: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < str.length; i += chunkSize) {
      chunks.push(str.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Generate cache key for data
   */
  private static getCacheKey(data: string): string {
    // Use data length and first/last 50 chars for cache key
    const prefix = data.substring(0, 50);
    const suffix = data.substring(Math.max(0, data.length - 50));
    return `${data.length}_${prefix}_${suffix}`;
  }

  /**
   * Cache result with LRU eviction
   */
  private static cacheResult(key: string, result: PipelineResult) {
    if (this.cache.size >= this.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, result);
  }

  /**
   * Get performance statistics
   */
  static getStats() {
    return {
      cacheSize: this.cache.size,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0,
      redactionStats: OptimizedPHIRedactor.getStats(),
      provenanceStats: OptimizedProvenanceGenerator.getStats()
    };
  }

  /**
   * Clear all caches
   */
  static clearCaches() {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    OptimizedPHIRedactor.clearCache();
    OptimizedProvenanceGenerator.clearCache();
  }
}
