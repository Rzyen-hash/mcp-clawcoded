// src/utils/validation.ts - Input validation utilities

import { z } from 'zod';
import { MCPError, ErrorCodes } from '../types.js';

/**
 * Sanitize string input to prevent injection
 */
export function sanitizeString(input: string): string {
  // Remove null bytes
  let sanitized = input.replace(/\x00/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Limit length (prevent DoS with huge strings)
  const MAX_LENGTH = 10000;
  if (sanitized.length > MAX_LENGTH) {
    sanitized = sanitized.substring(0, MAX_LENGTH);
  }
  
  return sanitized;
}

/**
 * Validate and sanitize job ID
 */
export function validateJobId(jobId: string): string {
  // UUID format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (!uuidRegex.test(jobId)) {
    throw new MCPError(
      ErrorCodes.INVALID_INPUT,
      'Invalid job ID format',
      { received: jobId }
    );
  }
  
  return jobId.toLowerCase();
}

/**
 * Validate and sanitize address
 */
export function validateAddress(address: string): string {
  // Ethereum address format
  const addressRegex = /^0x[a-f0-9]{40}$/i;
  
  if (!addressRegex.test(address)) {
    throw new MCPError(
      ErrorCodes.INVALID_INPUT,
      'Invalid Ethereum address format',
      { received: address }
    );
  }
  
  return address.toLowerCase();
}

/**
 * Safe JSON stringifier (prevents circular reference errors)
 */
export function safeStringify(obj: any): string {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  });
}

/**
 * Log sanitizer - removes sensitive data from logs
 */
export function sanitizeForLogging(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  const sensitiveKeys = [
    'apiKey',
    'api_key',
    'privateKey',
    'private_key',
    'secret',
    'password',
    'token',
    'authorization',
    'signature'
  ];
  
  const sanitized: any = Array.isArray(data) ? [] : {};
  
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    
    if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLogging(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Validate schema with detailed error message
 */
export function validateSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    const issues = result.error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code
    }));
    
    throw new MCPError(
      ErrorCodes.INVALID_INPUT,
      'Input validation failed',
      { issues }
    );
  }
  
  return result.data;
}

/**
 * Check if value is within safe integer range
 */
export function safeInteger(value: number): number {
  if (!Number.isFinite(value)) {
    throw new MCPError(ErrorCodes.INVALID_INPUT, 'Value must be a finite number');
  }
  
  if (!Number.isInteger(value)) {
    throw new MCPError(ErrorCodes.INVALID_INPUT, 'Value must be an integer');
  }
  
  const SAFE_MAX = 9007199254740991; // Number.MAX_SAFE_INTEGER
  const SAFE_MIN = -9007199254740991;
  
  if (value > SAFE_MAX || value < SAFE_MIN) {
    throw new MCPError(ErrorCodes.INVALID_INPUT, 'Integer out of safe range');
  }
  
  return value;
}

/**
 * URL validation
 */
export function validateUrl(url: string): string {
  try {
    const parsed = new URL(url);
    
    // Only allow http/https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new MCPError(
        ErrorCodes.INVALID_INPUT,
        'Only HTTP/HTTPS URLs are allowed'
      );
    }
    
    return url;
  } catch {
    throw new MCPError(
      ErrorCodes.INVALID_INPUT,
      'Invalid URL format',
      { received: url }
    );
  }
}
