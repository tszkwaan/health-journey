/**
 * PHI (Protected Health Information) Redaction System
 * 
 * This module provides comprehensive PHI protection by:
 * 1. Identifying and redacting PHI patterns
 * 2. Sanitizing data before LLM processing
 * 3. Cleaning logs and debug output
 * 4. Ensuring no PHI leaks in API responses
 */

export interface PHIPattern {
  name: string;
  pattern: RegExp;
  replacement: string;
  category: 'name' | 'contact' | 'medical' | 'identifier' | 'date';
}

export class PHIRedactor {
  private static patterns: PHIPattern[] = [
    // Names (common patterns)
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

  /**
   * Redact PHI from a string
   */
  static redact(text: string): string {
    if (!text || typeof text !== 'string') {
      return text;
    }

    let redacted = text;
    
    // Apply all PHI patterns
    for (const pattern of this.patterns) {
      redacted = redacted.replace(pattern.pattern, pattern.replacement);
    }
    
    return redacted;
  }

  /**
   * Redact PHI from an object recursively
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
        // Skip redaction for certain technical fields
        if (this.shouldSkipRedaction(key)) {
          redacted[key] = value;
        } else {
          redacted[key] = this.redactObject(value);
        }
      }
      return redacted;
    }

    return obj;
  }

  /**
   * Check if a field should skip redaction (technical fields)
   */
  private static shouldSkipRedaction(key: string): boolean {
    const skipFields = [
      'id', 'createdAt', 'updatedAt', 'version', 'isCurrent',
      'patientId', 'doctorId', 'reservationId', 'sessionId',
      'metadata', 'embedding', 'score', 'chunkId'
    ];
    return skipFields.includes(key.toLowerCase());
  }

  /**
   * Create a safe version of data for logging
   */
  static createSafeLogData(data: any): any {
    return this.redactObject(data);
  }

  /**
   * Redact PHI from console.log statements
   */
  static safeLog(message: string, ...args: any[]): void {
    const redactedMessage = this.redact(message);
    const redactedArgs = args.map(arg => this.redactObject(arg));
    console.log(redactedMessage, ...redactedArgs);
  }

  /**
   * Check if text contains potential PHI
   */
  static containsPHI(text: string): boolean {
    if (!text || typeof text !== 'string') {
      return false;
    }

    return this.patterns.some(pattern => pattern.pattern.test(text));
  }

  /**
   * Get PHI categories found in text
   */
  static getPHICategories(text: string): string[] {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const categories = new Set<string>();
    for (const pattern of this.patterns) {
      if (pattern.pattern.test(text)) {
        categories.add(pattern.category);
      }
    }
    return Array.from(categories);
  }
}

/**
 * Safe logging wrapper that automatically redacts PHI
 */
export const safeLog = PHIRedactor.safeLog.bind(PHIRedactor);

/**
 * Safe console methods
 */
export const safeConsole = {
  log: (message: string, ...args: any[]) => PHIRedactor.safeLog(message, ...args),
  error: (message: string, ...args: any[]) => console.error(PHIRedactor.redact(message), ...args.map(arg => PHIRedactor.redactObject(arg))),
  warn: (message: string, ...args: any[]) => console.warn(PHIRedactor.redact(message), ...args.map(arg => PHIRedactor.redactObject(arg))),
  info: (message: string, ...args: any[]) => console.info(PHIRedactor.redact(message), ...args.map(arg => PHIRedactor.redactObject(arg)))
};
