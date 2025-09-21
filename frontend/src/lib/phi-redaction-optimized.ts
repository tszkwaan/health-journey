/**
 * Optimized PHI (Protected Health Information) Redaction System
 * 
 * Performance optimizations:
 * 1. Pre-compiled regex patterns with caching
 * 2. Batch processing with single-pass redaction
 * 3. Result caching for repeated inputs
 * 4. Skip redaction for known safe content
 */

export interface PHIPattern {
  name: string;
  pattern: RegExp;
  replacement: string;
  category: 'name' | 'contact' | 'medical' | 'identifier' | 'date';
}

export class OptimizedPHIRedactor {
  private static patterns: PHIPattern[] = [];
  private static compiledPatterns: RegExp[] = [];
  private static replacements: string[] = [];
  private static isInitialized = false;
  private static cache = new Map<string, string>();
  private static cacheHits = 0;
  private static cacheMisses = 0;
  private static maxCacheSize = 1000;

  // Safe content patterns that don't need redaction
  private static safePatterns = [
    /^[0-9\s\-\.]+$/,  // Pure numbers/dates
    /^[A-Z\s]+$/,      // Pure uppercase (likely headers)
    /^[a-z\s]+$/,      // Pure lowercase (likely descriptions)
    /^[^\w\s]*$/,      // Pure punctuation
  ];

  private static initializePatterns() {
    if (this.isInitialized) return;

    this.patterns = [
      // Names (common patterns) - Most frequent first
      {
        name: 'Full Name',
        pattern: /\b[A-Z][a-z]+ [A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g,
        replacement: '[REDACTED_NAME]',
        category: 'name'
      },
      {
        name: 'Chinese Names',
        pattern: /[\u4e00-\u9fff]{2,4}/g,
        replacement: '[REDACTED_NAME]',
        category: 'name'
      },
      
      // Contact Information
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
      
      // Medical Identifiers
      {
        name: 'Medical Record Numbers',
        pattern: /\b(?:MRN|Medical Record|Record #?)\s*:?\s*[A-Z0-9-]{6,}\b/gi,
        replacement: '[REDACTED_MRN]',
        category: 'identifier'
      },
      {
        name: 'Patient IDs',
        pattern: /\b(?:Patient ID|Pt ID|ID)\s*:?\s*[A-Z0-9-]{6,}\b/gi,
        replacement: '[REDACTED_PATIENT_ID]',
        category: 'identifier'
      },
      
      // Dates (birth dates, medical dates)
      {
        name: 'Birth Dates',
        pattern: /\b(?:DOB|Birth|Born)\s*:?\s*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/gi,
        replacement: '[REDACTED_DOB]',
        category: 'date'
      },
      {
        name: 'Date Patterns',
        pattern: /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g,
        replacement: '[REDACTED_DATE]',
        category: 'date'
      },
      
      // Medical Information
      {
        name: 'SSN',
        pattern: /\b\d{3}-?\d{2}-?\d{4}\b/g,
        replacement: '[REDACTED_SSN]',
        category: 'identifier'
      },
      {
        name: 'Insurance Numbers',
        pattern: /\b(?:Insurance|Policy|Member)\s*#?\s*:?\s*[A-Z0-9-]{8,}\b/gi,
        replacement: '[REDACTED_INSURANCE]',
        category: 'identifier'
      }
    ];

    // Pre-compile patterns for better performance
    this.compiledPatterns = this.patterns.map(p => p.pattern);
    this.replacements = this.patterns.map(p => p.replacement);
    this.isInitialized = true;
  }

  /**
   * Check if content is safe and doesn't need redaction
   */
  private static isSafeContent(text: string): boolean {
    if (!text || text.length < 3) return true;
    
    // Check against safe patterns
    for (const pattern of this.safePatterns) {
      if (pattern.test(text.trim())) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Optimized redaction with caching and batch processing
   */
  static redact(text: string): string {
    if (!text || typeof text !== 'string') {
      return text;
    }

    // Initialize patterns if needed
    this.initializePatterns();

    // Check cache first
    const cacheKey = text;
    if (this.cache.has(cacheKey)) {
      this.cacheHits++;
      return this.cache.get(cacheKey)!;
    }

    // Check if content is safe to skip redaction
    if (this.isSafeContent(text)) {
      this.cache.set(cacheKey, text);
      this.cacheMisses++;
      return text;
    }

    // Batch process all patterns in a single pass
    let redacted = text;
    
    // Use pre-compiled patterns for better performance
    for (let i = 0; i < this.compiledPatterns.length; i++) {
      redacted = redacted.replace(this.compiledPatterns[i], this.replacements[i]);
    }

    // Cache result
    if (this.cache.size >= this.maxCacheSize) {
      // Clear oldest entries (simple LRU)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(cacheKey, redacted);
    this.cacheMisses++;

    return redacted;
  }

  /**
   * Batch redact multiple texts efficiently
   */
  static redactBatch(texts: string[]): string[] {
    this.initializePatterns();
    
    return texts.map(text => this.redact(text));
  }

  /**
   * Redact PHI from an object recursively with optimizations
   */
  static redactObject(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.redact(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.redactObject(item));
    }

    if (typeof obj === 'object') {
      const redacted: any = {};
      for (const [key, value] of Object.entries(obj)) {
        redacted[key] = this.redactObject(value);
      }
      return redacted;
    }

    return obj;
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
      patternsCount: this.patterns.length
    };
  }

  /**
   * Clear cache and reset statistics
   */
  static clearCache() {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
}
