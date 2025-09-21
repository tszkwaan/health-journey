import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export interface EncryptionResult {
  encryptedData: string;
  keyId: string;
  iv: string;
  tag: string;
}

export interface DecryptionResult {
  decryptedData: string;
  success: boolean;
  error?: string;
}

export class EncryptionService {
  private static instance: EncryptionService;
  private masterKey: string;
  private algorithm = 'aes-256-gcm';

  constructor() {
    this.masterKey = process.env.ENCRYPTION_MASTER_KEY || this.generateMasterKey();
  }

  static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  private generateMasterKey(): string {
    const key = crypto.randomBytes(32).toString('hex');
    console.warn('Generated new master key. Store this in ENCRYPTION_MASTER_KEY environment variable:', key);
    return key;
  }

  private async getOrCreateEncryptionKey(keyId: string = 'default'): Promise<string> {
    try {
      let keyRecord = await prisma.encryptionKey.findUnique({
        where: { keyId }
      });

      if (!keyRecord) {
        // Generate a new key
        const key = crypto.randomBytes(32).toString('hex');
        keyRecord = await prisma.encryptionKey.create({
          data: {
            keyId,
            algorithm: this.algorithm,
            keyVersion: 1,
            isActive: true,
            description: 'Default encryption key for sensitive data'
          }
        });
        // Store the actual key in memory (in production, use a key management service)
        return key;
      }

      // In production, retrieve the key from a secure key management service
      // For now, we'll derive it from the master key and keyId
      return crypto.pbkdf2Sync(this.masterKey, keyId, 100000, 32, 'sha512').toString('hex');
    } catch (error) {
      console.error('Error getting encryption key:', error);
      throw new Error('Failed to get encryption key');
    }
  }

  async encryptSensitiveData(
    data: string,
    keyId: string = 'default'
  ): Promise<EncryptionResult> {
    try {
      const key = await this.getOrCreateEncryptionKey(keyId);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(this.algorithm, key);
      cipher.setAAD(Buffer.from('sensitive-data'));

      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();

      // Store encryption metadata in database
      await prisma.encryptedField.create({
        data: {
          tableName: 'sensitive_data',
          fieldName: 'encrypted_field',
          recordId: crypto.randomUUID(),
          keyId,
          algorithm: this.algorithm,
          iv: iv.toString('hex'),
          tag: tag.toString('hex')
        }
      });

      return {
        encryptedData: encrypted,
        keyId,
        iv: iv.toString('hex'),
        tag: tag.toString('hex')
      };
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  async decryptSensitiveData(
    encryptedData: string,
    keyId: string,
    iv: string,
    tag: string
  ): Promise<DecryptionResult> {
    try {
      const key = await this.getOrCreateEncryptionKey(keyId);
      const decipher = crypto.createDecipher(this.algorithm, key);
      decipher.setAAD(Buffer.from('sensitive-data'));
      decipher.setAuthTag(Buffer.from(tag, 'hex'));

      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return {
        decryptedData: decrypted,
        success: true
      };
    } catch (error) {
      console.error('Decryption error:', error);
      return {
        decryptedData: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown decryption error'
      };
    }
  }

  // Encrypt PHI fields in medical data
  async encryptPHIData(data: any): Promise<any> {
    const phiFields = [
      'name', 'email', 'phone', 'dateOfBirth', 'address',
      'socialSecurityNumber', 'medicalRecordNumber'
    ];

    const encryptedData = { ...data };

    for (const field of phiFields) {
      if (data[field] && typeof data[field] === 'string') {
        const result = await this.encryptSensitiveData(data[field]);
        encryptedData[`${field}_encrypted`] = result.encryptedData;
        encryptedData[`${field}_keyId`] = result.keyId;
        encryptedData[`${field}_iv`] = result.iv;
        encryptedData[`${field}_tag`] = result.tag;
        // Remove the original field
        delete encryptedData[field];
      }
    }

    return encryptedData;
  }

  // Decrypt PHI fields in medical data
  async decryptPHIData(encryptedData: any): Promise<any> {
    const phiFields = [
      'name', 'email', 'phone', 'dateOfBirth', 'address',
      'socialSecurityNumber', 'medicalRecordNumber'
    ];

    const decryptedData = { ...encryptedData };

    for (const field of phiFields) {
      const encryptedField = `${field}_encrypted`;
      const keyIdField = `${field}_keyId`;
      const ivField = `${field}_iv`;
      const tagField = `${field}_tag`;

      if (encryptedData[encryptedField]) {
        const result = await this.decryptSensitiveData(
          encryptedData[encryptedField],
          encryptedData[keyIdField],
          encryptedData[ivField],
          encryptedData[tagField]
        );

        if (result.success) {
          decryptedData[field] = result.decryptedData;
        }

        // Clean up encrypted fields
        delete decryptedData[encryptedField];
        delete decryptedData[keyIdField];
        delete decryptedData[ivField];
        delete decryptedData[tagField];
      }
    }

    return decryptedData;
  }

  // Hash sensitive data for search purposes
  hashForSearch(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // Generate secure random tokens
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  // Verify data integrity
  verifyDataIntegrity(data: string, hash: string): boolean {
    const computedHash = crypto.createHash('sha256').update(data).digest('hex');
    return computedHash === hash;
  }
}

export const encryptionService = EncryptionService.getInstance();
