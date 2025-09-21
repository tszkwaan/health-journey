/**
 * Optimized Provenance Generation System
 * 
 * Performance optimizations:
 * 1. Pre-computed metadata templates
 * 2. Caching for repeated inputs
 * 3. Efficient hash generation
 * 4. Batch processing support
 */

import { createHash } from 'crypto';

export interface ProvenanceData {
  timestamp: string;
  data_length: number;
  redaction_applied: boolean;
  source: string;
  version: string;
  checksum: string;
  metadata: {
    generated_at: string;
    data_type: string;
    processing_stage: string;
    security_level: string;
  };
}

export class OptimizedProvenanceGenerator {
  private static cache = new Map<string, ProvenanceData>();
  private static cacheHits = 0;
  private static cacheMisses = 0;
  private static maxCacheSize = 1000;
  
  // Pre-computed metadata templates
  private static readonly METADATA_TEMPLATE = {
    generated_at: '',
    data_type: 'medical_transcript',
    processing_stage: 'post_redaction',
    security_level: 'high'
  };

  private static readonly PROVENANCE_TEMPLATE = {
    redaction_applied: true,
    source: 'healthcare_platform',
    version: '1.0'
  };

  /**
   * Generate provenance for a single data item
   */
  static generate(data: string): ProvenanceData {
    if (!data || typeof data !== 'string') {
      throw new Error('Data is required and must be a string');
    }

    // Check cache first
    const cacheKey = this.getCacheKey(data);
    if (this.cache.has(cacheKey)) {
      this.cacheHits++;
      return this.cache.get(cacheKey)!;
    }

    // Generate new provenance
    const timestamp = new Date().toISOString();
    const checksum = this.generateChecksum(data);
    
    const provenance: ProvenanceData = {
      timestamp,
      data_length: data.length,
      ...this.PROVENANCE_TEMPLATE,
      checksum,
      metadata: {
        ...this.METADATA_TEMPLATE,
        generated_at: timestamp
      }
    };

    // Cache result
    this.cacheResult(cacheKey, provenance);
    this.cacheMisses++;

    return provenance;
  }

  /**
   * Generate provenance for multiple data items efficiently
   */
  static generateBatch(dataItems: string[]): ProvenanceData[] {
    return dataItems.map(data => this.generate(data));
  }

  /**
   * Generate lightweight provenance (faster, less metadata)
   */
  static generateLightweight(data: string): Partial<ProvenanceData> {
    const timestamp = new Date().toISOString();
    const checksum = this.generateChecksum(data);
    
    return {
      timestamp,
      data_length: data.length,
      checksum,
      redaction_applied: true
    };
  }

  /**
   * Generate checksum efficiently
   */
  private static generateChecksum(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate cache key for data
   */
  private static getCacheKey(data: string): string {
    // Use first 100 chars + length for cache key (faster than full hash)
    const prefix = data.substring(0, 100);
    return `${prefix.length}_${data.length}_${prefix}`;
  }

  /**
   * Cache result with LRU eviction
   */
  private static cacheResult(key: string, provenance: ProvenanceData) {
    if (this.cache.size >= this.maxCacheSize) {
      // Remove oldest entry (simple LRU)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, provenance);
  }

  /**
   * Get performance statistics
   */
  static getStats() {
    return {
      cacheSize: this.cache.size,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0
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
