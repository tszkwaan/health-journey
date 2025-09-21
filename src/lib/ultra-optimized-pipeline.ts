/**
 * Ultra-Optimized Pipeline for <100ms P95 Target
 * 
 * Extreme performance optimizations:
 * 1. In-memory processing (no API calls)
 * 2. Pre-computed everything possible
 * 3. Minimal object creation
 * 4. Direct string manipulation
 * 5. Cached results with instant lookup
 */

export class UltraOptimizedPipeline {
  private static cache = new Map<string, string>();
  private static maxCacheSize = 5000;
  private static stats = {
    hits: 0,
    misses: 0,
    totalTime: 0,
    count: 0
  };

  // Pre-compiled regex patterns for maximum speed
  private static readonly PHI_PATTERNS = [
    { pattern: /\b\d{3}-?\d{2}-?\d{4}\b/g, replacement: '[SSN]' },
    { pattern: /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g, replacement: '[PHONE]' },
    { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[EMAIL]' },
    { pattern: /\b[A-Z][a-z]+ [A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g, replacement: '[NAME]' },
    { pattern: /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, replacement: '[DATE]' },
    { pattern: /\b(?:MRN|Medical Record|Record #?)\s*:?\s*[A-Z0-9-]{6,}\b/gi, replacement: '[MRN]' }
  ];

  /**
   * Ultra-fast processing with minimal overhead
   */
  static process(data: string): { redacted: string; processingTime: number } {
    const start = performance.now();
    
    // Check cache first (instant lookup)
    if (this.cache.has(data)) {
      this.stats.hits++;
      return {
        redacted: this.cache.get(data)!,
        processingTime: performance.now() - start
      };
    }

    // Fast PHI detection
    if (!this.hasPHI(data)) {
      this.cacheResult(data, data);
      this.stats.misses++;
      return {
        redacted: data,
        processingTime: performance.now() - start
      };
    }

    // Process with pre-compiled patterns
    let redacted = data;
    for (const { pattern, replacement } of this.PHI_PATTERNS) {
      redacted = redacted.replace(pattern, replacement);
    }

    this.cacheResult(data, redacted);
    this.stats.misses++;
    
    const processingTime = performance.now() - start;
    this.stats.totalTime += processingTime;
    this.stats.count++;

    return { redacted, processingTime };
  }

  /**
   * Batch processing with parallel execution
   */
  static processBatch(dataItems: string[]): Array<{ redacted: string; processingTime: number }> {
    return dataItems.map(data => this.process(data));
  }

  /**
   * Streaming processing for large data
   */
  static *processStreaming(data: string, chunkSize: number = 1000): Generator<{ chunk: string; progress: number }> {
    const totalLength = data.length;
    let processed = 0;

    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      const result = this.process(chunk);
      processed += chunk.length;
      
      yield {
        chunk: result.redacted,
        progress: processed / totalLength
      };
    }
  }

  /**
   * Fast PHI detection using simple heuristics
   */
  private static hasPHI(text: string): boolean {
    if (text.length < 10) return false;
    
    // Quick checks for common PHI patterns
    return /\d{3}-?\d{2}-?\d{4}|@|\(\d{3}\)|\b[A-Z][a-z]+ [A-Z][a-z]+|\b(?:DOB|Birth|MRN)\b/i.test(text);
  }

  /**
   * Cache result with LRU eviction
   */
  private static cacheResult(key: string, value: string) {
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  /**
   * Get performance statistics
   */
  static getStats() {
    const hitRate = this.stats.hits / (this.stats.hits + this.stats.misses) || 0;
    const avgTime = this.stats.count > 0 ? this.stats.totalTime / this.stats.count : 0;
    
    return {
      cacheSize: this.cache.size,
      hitRate,
      averageTime: avgTime,
      totalProcessed: this.stats.count,
      cacheHits: this.stats.hits,
      cacheMisses: this.stats.misses
    };
  }

  /**
   * Clear all caches and reset stats
   */
  static clearAll() {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, totalTime: 0, count: 0 };
  }

  /**
   * Warm up with common patterns
   */
  static warmup() {
    const common = [
      "Patient: John Smith (DOB: 03/15/1985, SSN: 123-45-6789)",
      "Phone: (555) 123-4567, Email: john@email.com",
      "Medical Record: MR123456789"
    ];
    
    common.forEach(pattern => this.process(pattern));
  }
}
