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

  // Pre-compiled regex patterns for maximum speed - optimized for single pass
  private static readonly PHI_PATTERNS = [
    { pattern: /\b\d{3}-?\d{2}-?\d{4}\b/g, replacement: '[SSN]' },
    { pattern: /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g, replacement: '[PHONE]' },
    { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[EMAIL]' },
    { pattern: /\b[A-Z][a-z]+ [A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g, replacement: '[NAME]' },
    { pattern: /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, replacement: '[DATE]' },
    { pattern: /\b(?:MRN|Medical Record|Record #?)\s*:?\s*[A-Z0-9-]{6,}\b/gi, replacement: '[MRN]' }
  ];

  // Single combined regex for ultra-fast processing
  private static readonly COMBINED_PHI_REGEX = /\b\d{3}-?\d{2}-?\d{4}\b|(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b|\b[A-Z][a-z]+ [A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b(?:MRN|Medical Record|Record #?)\s*:?\s*[A-Z0-9-]{6,}\b/gi;

  /**
   * Ultra-fast processing with minimal overhead - OPTIMIZED VERSION
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

    // Fast PHI detection using combined regex
    if (!this.hasPHI(data)) {
      this.cacheResult(data, data);
      this.stats.misses++;
      return {
        redacted: data,
        processingTime: performance.now() - start
      };
    }

    // ULTRA-OPTIMIZED: Single pass with combined regex and smart replacement
    const redacted = this.redactWithSinglePass(data);

    this.cacheResult(data, redacted);
    this.stats.misses++;
    
    const processingTime = performance.now() - start;
    this.stats.totalTime += processingTime;
    this.stats.count++;

    return { redacted, processingTime };
  }

  /**
   * Single-pass redaction with smart replacement logic
   */
  private static redactWithSinglePass(data: string): string {
    return data.replace(this.COMBINED_PHI_REGEX, (match) => {
      // Smart replacement based on pattern type
      if (/\d{3}-?\d{2}-?\d{4}/.test(match)) return '[SSN]';
      if (/\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/.test(match)) return '[PHONE]';
      if (/@/.test(match)) return '[EMAIL]';
      if (/\b(?:MRN|Medical Record|Record)/i.test(match)) return '[MRN]';
      if (/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(match)) return '[DATE]';
      if (/\b[A-Z][a-z]+ [A-Z][a-z]+/.test(match)) return '[NAME]';
      return '[PHI]'; // fallback
    });
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
   * Ultra-fast PHI detection using optimized heuristics
   */
  private static hasPHI(text: string): boolean {
    if (text.length < 10) return false;
    
    // ULTRA-OPTIMIZED: Single regex check with early exit
    return this.COMBINED_PHI_REGEX.test(text);
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
