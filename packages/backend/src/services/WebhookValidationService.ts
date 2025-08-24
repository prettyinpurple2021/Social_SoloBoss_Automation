import crypto from 'crypto';
import { loggerService } from './LoggerService';
import { IntegrationErrorService, IntegrationErrorType } from './IntegrationErrorService';

export interface WebhookValidationResult {
  isValid: boolean;
  error?: string;
  errorType?: IntegrationErrorType;
  metadata?: Record<string, any>;
}

export interface WebhookPayload {
  headers: Record<string, string>;
  body: any;
  rawBody: string | Buffer;
  timestamp?: number;
}

export interface ValidationConfig {
  secret: string;
  algorithm: 'sha256' | 'sha1' | 'md5';
  signatureHeader: string;
  timestampHeader?: string;
  timestampTolerance?: number; // seconds
  expectedContentType?: string;
  requiredHeaders?: string[];
  maxPayloadSize?: number; // bytes
}

export class WebhookValidationService {
  private static instance: WebhookValidationService;
  private errorService: IntegrationErrorService;

  private constructor() {
    this.errorService = IntegrationErrorService.getInstance();
  }

  public static getInstance(): WebhookValidationService {
    if (!WebhookValidationService.instance) {
      WebhookValidationService.instance = new WebhookValidationService();
    }
    return WebhookValidationService.instance;
  }

  /**
   * Validate webhook signature and payload
   */
  async validateWebhook(
    payload: WebhookPayload,
    config: ValidationConfig,
    userId?: string,
    integrationType?: 'blogger' | 'soloboss'
  ): Promise<WebhookValidationResult> {
    try {
      // Step 1: Basic payload validation
      const basicValidation = this.validateBasicPayload(payload, config);
      if (!basicValidation.isValid) {
        if (userId && integrationType) {
          await this.logValidationError(userId, integrationType, basicValidation);
        }
        return basicValidation;
      }

      // Step 2: Signature validation
      const signatureValidation = this.validateSignature(payload, config);
      if (!signatureValidation.isValid) {
        if (userId && integrationType) {
          await this.logValidationError(userId, integrationType, signatureValidation);
        }
        return signatureValidation;
      }

      // Step 3: Timestamp validation (if configured)
      if (config.timestampHeader && config.timestampTolerance) {
        const timestampValidation = this.validateTimestamp(payload, config);
        if (!timestampValidation.isValid) {
          if (userId && integrationType) {
            await this.logValidationError(userId, integrationType, timestampValidation);
          }
          return timestampValidation;
        }
      }

      // Step 4: Content validation
      const contentValidation = this.validateContent(payload, config);
      if (!contentValidation.isValid) {
        if (userId && integrationType) {
          await this.logValidationError(userId, integrationType, contentValidation);
        }
        return contentValidation;
      }

      loggerService.info('Webhook validation successful', {
        userId,
        integrationType,
        payloadSize: payload.rawBody.length
      });

      return { isValid: true };

    } catch (error) {
      const validationError: WebhookValidationResult = {
        isValid: false,
        error: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errorType: IntegrationErrorType.WEBHOOK_VALIDATION,
        metadata: { 
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        }
      };

      if (userId && integrationType) {
        await this.logValidationError(userId, integrationType, validationError);
      }

      return validationError;
    }
  }

  /**
   * Validate basic payload structure and headers
   */
  private validateBasicPayload(payload: WebhookPayload, config: ValidationConfig): WebhookValidationResult {
    // Check payload size
    if (config.maxPayloadSize && payload.rawBody.length > config.maxPayloadSize) {
      return {
        isValid: false,
        error: `Payload size ${payload.rawBody.length} exceeds maximum ${config.maxPayloadSize}`,
        errorType: IntegrationErrorType.MALFORMED_DATA,
        metadata: { 
          payloadSize: payload.rawBody.length,
          maxSize: config.maxPayloadSize
        }
      };
    }

    // Check required headers
    if (config.requiredHeaders) {
      for (const header of config.requiredHeaders) {
        if (!payload.headers[header.toLowerCase()]) {
          return {
            isValid: false,
            error: `Missing required header: ${header}`,
            errorType: IntegrationErrorType.MALFORMED_DATA,
            metadata: { missingHeader: header }
          };
        }
      }
    }

    // Check content type
    if (config.expectedContentType) {
      const contentType = payload.headers['content-type'];
      if (!contentType || !contentType.includes(config.expectedContentType)) {
        return {
          isValid: false,
          error: `Invalid content type. Expected: ${config.expectedContentType}, Got: ${contentType}`,
          errorType: IntegrationErrorType.MALFORMED_DATA,
          metadata: { 
            expectedContentType: config.expectedContentType,
            actualContentType: contentType
          }
        };
      }
    }

    // Check signature header exists
    const signatureHeader = payload.headers[config.signatureHeader.toLowerCase()];
    if (!signatureHeader) {
      return {
        isValid: false,
        error: `Missing signature header: ${config.signatureHeader}`,
        errorType: IntegrationErrorType.WEBHOOK_VALIDATION,
        metadata: { signatureHeader: config.signatureHeader }
      };
    }

    return { isValid: true };
  }

  /**
   * Validate webhook signature
   */
  private validateSignature(payload: WebhookPayload, config: ValidationConfig): WebhookValidationResult {
    try {
      const signatureHeader = payload.headers[config.signatureHeader.toLowerCase()];
      
      // Extract signature from header (handle different formats)
      const signature = this.extractSignature(signatureHeader, config.algorithm);
      if (!signature) {
        return {
          isValid: false,
          error: 'Invalid signature format',
          errorType: IntegrationErrorType.WEBHOOK_VALIDATION,
          metadata: { signatureHeader, algorithm: config.algorithm }
        };
      }

      // Calculate expected signature
      const expectedSignature = this.calculateSignature(payload.rawBody, config.secret, config.algorithm);

      // Compare signatures using timing-safe comparison
      const isValid = this.compareSignatures(signature, expectedSignature);

      if (!isValid) {
        return {
          isValid: false,
          error: 'Signature verification failed',
          errorType: IntegrationErrorType.WEBHOOK_VALIDATION,
          metadata: { 
            algorithm: config.algorithm,
            signatureLength: signature.length,
            expectedLength: expectedSignature.length
          }
        };
      }

      return { isValid: true };

    } catch (error) {
      return {
        isValid: false,
        error: `Signature validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errorType: IntegrationErrorType.WEBHOOK_VALIDATION,
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Validate timestamp to prevent replay attacks
   */
  private validateTimestamp(payload: WebhookPayload, config: ValidationConfig): WebhookValidationResult {
    if (!config.timestampHeader || !config.timestampTolerance) {
      return { isValid: true };
    }

    const timestampHeader = payload.headers[config.timestampHeader.toLowerCase()];
    if (!timestampHeader) {
      return {
        isValid: false,
        error: `Missing timestamp header: ${config.timestampHeader}`,
        errorType: IntegrationErrorType.WEBHOOK_VALIDATION,
        metadata: { timestampHeader: config.timestampHeader }
      };
    }

    const timestamp = parseInt(timestampHeader, 10);
    if (isNaN(timestamp)) {
      return {
        isValid: false,
        error: 'Invalid timestamp format',
        errorType: IntegrationErrorType.MALFORMED_DATA,
        metadata: { timestamp: timestampHeader }
      };
    }

    const now = Math.floor(Date.now() / 1000);
    const timeDiff = Math.abs(now - timestamp);

    if (timeDiff > config.timestampTolerance) {
      return {
        isValid: false,
        error: `Timestamp outside tolerance. Diff: ${timeDiff}s, Max: ${config.timestampTolerance}s`,
        errorType: IntegrationErrorType.WEBHOOK_VALIDATION,
        metadata: { 
          timestamp,
          currentTime: now,
          timeDiff,
          tolerance: config.timestampTolerance
        }
      };
    }

    return { isValid: true };
  }

  /**
   * Validate webhook content structure
   */
  private validateContent(payload: WebhookPayload, config: ValidationConfig): WebhookValidationResult {
    try {
      // Basic JSON validation
      if (typeof payload.body !== 'object' || payload.body === null) {
        return {
          isValid: false,
          error: 'Invalid JSON payload',
          errorType: IntegrationErrorType.MALFORMED_DATA,
          metadata: { bodyType: typeof payload.body }
        };
      }

      // Check for empty payload
      if (Object.keys(payload.body).length === 0) {
        return {
          isValid: false,
          error: 'Empty payload',
          errorType: IntegrationErrorType.MALFORMED_DATA
        };
      }

      return { isValid: true };

    } catch (error) {
      return {
        isValid: false,
        error: `Content validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        errorType: IntegrationErrorType.MALFORMED_DATA,
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Extract signature from header based on different formats
   */
  private extractSignature(signatureHeader: string, algorithm: string): string | null {
    if (!signatureHeader) return null;

    // GitHub format: sha256=abc123...
    const githubMatch = signatureHeader.match(new RegExp(`${algorithm}=([a-f0-9]+)`, 'i'));
    if (githubMatch) {
      return githubMatch[1];
    }

    // Stripe format: t=timestamp,v1=signature
    const stripeMatch = signatureHeader.match(/v1=([a-f0-9]+)/i);
    if (stripeMatch) {
      return stripeMatch[1];
    }

    // Plain hex format
    if (/^[a-f0-9]+$/i.test(signatureHeader)) {
      return signatureHeader.toLowerCase();
    }

    return null;
  }

  /**
   * Calculate HMAC signature
   */
  private calculateSignature(payload: string | Buffer, secret: string, algorithm: string): string {
    return crypto
      .createHmac(algorithm, secret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Compare signatures using timing-safe comparison
   */
  private compareSignatures(signature1: string, signature2: string): boolean {
    if (signature1.length !== signature2.length) {
      return false;
    }

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature1, 'hex'),
        Buffer.from(signature2, 'hex')
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Log validation error
   */
  private async logValidationError(
    userId: string,
    integrationType: 'blogger' | 'soloboss',
    validationResult: WebhookValidationResult
  ): Promise<void> {
    if (!validationResult.error || !validationResult.errorType) return;

    try {
      await this.errorService.logError(
        userId,
        integrationType,
        validationResult.errorType,
        validationResult.error,
        validationResult.metadata || {}
      );
    } catch (error) {
      loggerService.error('Failed to log webhook validation error', error as Error, {
        userId,
        integrationType,
        originalError: validationResult.error
      });
    }
  }

  /**
   * Create validation config for different webhook providers
   */
  static createConfig(provider: 'github' | 'stripe' | 'custom', options: Partial<ValidationConfig>): ValidationConfig {
    const baseConfig: ValidationConfig = {
      secret: options.secret || '',
      algorithm: 'sha256',
      signatureHeader: 'x-hub-signature-256',
      maxPayloadSize: 1024 * 1024, // 1MB
      expectedContentType: 'application/json',
      ...options
    };

    switch (provider) {
      case 'github':
        return {
          ...baseConfig,
          signatureHeader: 'x-hub-signature-256',
          algorithm: 'sha256',
          requiredHeaders: ['x-github-event', 'x-github-delivery']
        };

      case 'stripe':
        return {
          ...baseConfig,
          signatureHeader: 'stripe-signature',
          timestampHeader: 'stripe-signature',
          timestampTolerance: 300, // 5 minutes
          algorithm: 'sha256'
        };

      case 'custom':
      default:
        return baseConfig;
    }
  }

  /**
   * Validate SoloBoss webhook specifically
   */
  async validateSoloBossWebhook(
    payload: WebhookPayload,
    secret: string,
    userId: string
  ): Promise<WebhookValidationResult> {
    const config: ValidationConfig = {
      secret,
      algorithm: 'sha256',
      signatureHeader: 'x-soloboss-signature',
      timestampHeader: 'x-soloboss-timestamp',
      timestampTolerance: 300, // 5 minutes
      expectedContentType: 'application/json',
      requiredHeaders: ['x-soloboss-event', 'x-soloboss-signature'],
      maxPayloadSize: 2 * 1024 * 1024 // 2MB for content with images
    };

    return this.validateWebhook(payload, config, userId, 'soloboss');
  }

  /**
   * Validate Blogger webhook (if using custom webhook system)
   */
  async validateBloggerWebhook(
    payload: WebhookPayload,
    secret: string,
    userId: string
  ): Promise<WebhookValidationResult> {
    const config: ValidationConfig = {
      secret,
      algorithm: 'sha256',
      signatureHeader: 'x-blogger-signature',
      expectedContentType: 'application/json',
      requiredHeaders: ['x-blogger-event'],
      maxPayloadSize: 1024 * 1024 // 1MB
    };

    return this.validateWebhook(payload, config, userId, 'blogger');
  }

  /**
   * Handle malformed webhook data with recovery options
   */
  async handleMalformedData(
    payload: WebhookPayload,
    userId: string,
    integrationType: 'blogger' | 'soloboss'
  ): Promise<{ recovered: boolean; data?: any; error?: string }> {
    try {
      loggerService.warn('Attempting to recover malformed webhook data', {
        userId,
        integrationType,
        payloadSize: payload.rawBody.length
      });

      // Try to parse as different formats
      const recoveryAttempts = [
        () => this.tryParseAsJSON(payload.rawBody),
        () => this.tryParseAsFormData(payload.rawBody),
        () => this.tryParseAsXML(payload.rawBody),
        () => this.tryExtractFromHTML(payload.rawBody)
      ];

      for (const attempt of recoveryAttempts) {
        try {
          const result = attempt();
          if (result) {
            loggerService.info('Successfully recovered malformed webhook data', {
              userId,
              integrationType,
              recoveryMethod: attempt.name
            });
            return { recovered: true, data: result };
          }
        } catch (error) {
          // Continue to next recovery attempt
          continue;
        }
      }

      // Log the failure
      await this.errorService.logError(
        userId,
        integrationType,
        IntegrationErrorType.MALFORMED_DATA,
        'Unable to recover malformed webhook data',
        {
          payloadSize: payload.rawBody.length,
          contentType: payload.headers['content-type'],
          recoveryAttempts: recoveryAttempts.length
        }
      );

      return { 
        recovered: false, 
        error: 'Unable to recover malformed webhook data after all attempts' 
      };

    } catch (error) {
      return { 
        recovered: false, 
        error: `Recovery error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  // Recovery helper methods
  private tryParseAsJSON(data: string | Buffer): any {
    const text = typeof data === 'string' ? data : data.toString();
    return JSON.parse(text);
  }

  private tryParseAsFormData(data: string | Buffer): any {
    const text = typeof data === 'string' ? data : data.toString();
    const params = new URLSearchParams(text);
    const result: Record<string, any> = {};
    
    for (const [key, value] of params.entries()) {
      try {
        result[key] = JSON.parse(value);
      } catch {
        result[key] = value;
      }
    }
    
    return Object.keys(result).length > 0 ? result : null;
  }

  private tryParseAsXML(data: string | Buffer): any {
    // Basic XML parsing - in production, use a proper XML parser
    const text = typeof data === 'string' ? data : data.toString();
    const xmlMatch = text.match(/<(\w+)>(.*?)<\/\1>/g);
    
    if (!xmlMatch) return null;
    
    const result: Record<string, any> = {};
    for (const match of xmlMatch) {
      const tagMatch = match.match(/<(\w+)>(.*?)<\/\1>/);
      if (tagMatch) {
        result[tagMatch[1]] = tagMatch[2];
      }
    }
    
    return Object.keys(result).length > 0 ? result : null;
  }

  private tryExtractFromHTML(data: string | Buffer): any {
    // Extract JSON from HTML comments or script tags
    const text = typeof data === 'string' ? data : data.toString();
    
    // Try to find JSON in HTML comments
    const commentMatch = text.match(/<!--\s*({.*?})\s*-->/s);
    if (commentMatch) {
      try {
        return JSON.parse(commentMatch[1]);
      } catch {
        // Continue to next attempt
      }
    }
    
    // Try to find JSON in script tags
    const scriptMatch = text.match(/<script[^>]*>(.*?)<\/script>/s);
    if (scriptMatch) {
      try {
        return JSON.parse(scriptMatch[1]);
      } catch {
        // Continue to next attempt
      }
    }
    
    return null;
  }
}