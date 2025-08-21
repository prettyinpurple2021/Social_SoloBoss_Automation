import { Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult, ValidationChain } from 'express-validator';
import { loggerService } from '../services/LoggerService';

/**
 * Middleware to handle validation errors
 */
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    loggerService.warn('Validation failed', {
      path: req.path,
      method: req.method,
      errors: errors.array(),
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
    return;
  }
  
  next();
};

/**
 * Content sanitization rules
 */
export const sanitizeContent = (): ValidationChain[] => [
  body('content')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 10000 })
    .withMessage('Content must be a string with maximum 10000 characters')
    .customSanitizer((value: string) => {
      // Remove potentially dangerous HTML tags and scripts
      return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
        .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    })
];

/**
 * Email validation rules
 */
export const validateEmail = (): ValidationChain[] => [
  body('email')
    .isEmail()
    .normalizeEmail()
    .isLength({ max: 254 })
    .withMessage('Valid email address is required (max 254 characters)')
];

/**
 * Password validation rules
 */
export const validatePassword = (): ValidationChain[] => [
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character')
];

/**
 * UUID validation rules
 */
export const validateUUID = (field: string): ValidationChain[] => [
  param(field)
    .isUUID()
    .withMessage(`${field} must be a valid UUID`)
];

/**
 * Platform validation rules
 */
export const validatePlatforms = (): ValidationChain[] => [
  body('platforms')
    .optional()
    .isArray({ min: 1, max: 4 })
    .withMessage('Platforms must be an array with 1-4 items')
    .custom((platforms: string[]) => {
      const validPlatforms = ['facebook', 'instagram', 'pinterest', 'x'];
      const invalidPlatforms = platforms.filter(p => !validPlatforms.includes(p));
      if (invalidPlatforms.length > 0) {
        throw new Error(`Invalid platforms: ${invalidPlatforms.join(', ')}`);
      }
      return true;
    })
];

/**
 * Hashtags validation rules
 */
export const validateHashtags = (): ValidationChain[] => [
  body('hashtags')
    .optional()
    .isArray({ max: 30 })
    .withMessage('Hashtags must be an array with maximum 30 items')
    .custom((hashtags: string[]) => {
      if (!Array.isArray(hashtags)) return true;
      
      for (const hashtag of hashtags) {
        if (typeof hashtag !== 'string') {
          throw new Error('All hashtags must be strings');
        }
        if (hashtag.length > 100) {
          throw new Error('Each hashtag must be maximum 100 characters');
        }
        if (!/^#?[a-zA-Z0-9_]+$/.test(hashtag)) {
          throw new Error('Hashtags can only contain letters, numbers, and underscores');
        }
      }
      return true;
    })
    .customSanitizer((hashtags: string[]) => {
      if (!Array.isArray(hashtags)) return hashtags;
      return hashtags.map(tag => tag.startsWith('#') ? tag : `#${tag}`);
    })
];

/**
 * Date validation rules
 */
export const validateScheduledTime = (): ValidationChain[] => [
  body('scheduledTime')
    .optional()
    .isISO8601()
    .withMessage('Scheduled time must be a valid ISO 8601 date')
    .custom((value: string) => {
      const scheduledDate = new Date(value);
      const now = new Date();
      
      if (scheduledDate <= now) {
        throw new Error('Scheduled time must be in the future');
      }
      
      // Don't allow scheduling more than 1 year in advance
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
      
      if (scheduledDate > oneYearFromNow) {
        throw new Error('Cannot schedule posts more than 1 year in advance');
      }
      
      return true;
    })
];

/**
 * File upload validation
 */
export const validateFileUpload = (): ValidationChain[] => [
  body('images')
    .optional()
    .isArray({ max: 10 })
    .withMessage('Maximum 10 images allowed')
    .custom((images: any[]) => {
      if (!Array.isArray(images)) return true;
      
      for (const image of images) {
        if (typeof image !== 'string') {
          throw new Error('Image references must be strings');
        }
        // Basic URL validation for image references
        if (!/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(image)) {
          throw new Error('Invalid image URL format');
        }
      }
      return true;
    })
];

/**
 * Pagination validation
 */
export const validatePagination = (): ValidationChain[] => [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be an integer between 1 and 1000'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be an integer between 1 and 100')
];

/**
 * Search query validation
 */
export const validateSearchQuery = (): ValidationChain[] => [
  query('q')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be 1-100 characters')
    .customSanitizer((value: string) => {
      // Remove special characters that could be used for injection
      return value.replace(/[<>'"&]/g, '');
    })
];

/**
 * API key validation
 */
export const validateApiKey = (): ValidationChain[] => [
  body('apiKey')
    .isString()
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('API key must be between 10 and 500 characters')
    .matches(/^[A-Za-z0-9\-_\.]+$/)
    .withMessage('API key contains invalid characters')
];

/**
 * URL validation
 */
export const validateUrl = (field: string): ValidationChain[] => [
  body(field)
    .optional()
    .isURL({
      protocols: ['http', 'https'],
      require_protocol: true,
      require_valid_protocol: true,
      allow_underscores: false
    })
    .withMessage(`${field} must be a valid HTTP/HTTPS URL`)
    .isLength({ max: 2048 })
    .withMessage(`${field} must be maximum 2048 characters`)
];

/**
 * Timezone validation
 */
export const validateTimezone = (): ValidationChain[] => [
  body('timezone')
    .optional()
    .isString()
    .custom((value: string) => {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: value });
        return true;
      } catch (error) {
        throw new Error('Invalid timezone');
      }
    })
];

/**
 * Rate limiting bypass validation for testing
 */
export const validateTestMode = (): ValidationChain[] => [
  body('testMode')
    .optional()
    .isBoolean()
    .withMessage('Test mode must be a boolean')
];