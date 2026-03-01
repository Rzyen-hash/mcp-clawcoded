// src/utils/auth.ts - Wallet-based authentication

import { createPublicClient, http, verifyMessage } from 'viem';
import { base } from 'viem/chains';
import { MCPError, ErrorCodes, AuthChallenge, AuthVerify, AuthenticatedRequest } from '../types.js';

// In-memory challenge storage (in production, use Redis)
const challenges = new Map<string, AuthChallenge>();
const authenticatedSessions = new Map<string, AuthenticatedRequest>();

// Cleanup old challenges every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, challenge] of challenges.entries()) {
    if (challenge.expiresAt < now) {
      challenges.delete(key);
    }
  }
}, 300000);

/**
 * Generate a challenge for wallet signature
 * This implements SIWE (Sign-In with Ethereum) pattern
 */
export function generateChallenge(address: string): AuthChallenge {
  // Normalize address
  const normalizedAddress = address.toLowerCase();
  
  // Create challenge message
  const timestamp = Date.now();
  const challenge = `ClawCoded MCP Authentication\n` +
    `Address: ${normalizedAddress}\n` +
    `Timestamp: ${timestamp}\n` +
    `Nonce: ${Math.random().toString(36).substring(2, 15)}\n` +
    `\nSign this message to authenticate with ClawCoded MCP server.`;
  
  const authChallenge: AuthChallenge = {
    challenge,
    timestamp,
    expiresAt: timestamp + 5 * 60 * 1000 // 5 minutes expiry
  };
  
  challenges.set(normalizedAddress, authChallenge);
  
  return authChallenge;
}

/**
 * Verify wallet signature
 * Uses viem to verify the signature against the challenge
 */
export async function verifyWalletSignature(
  verify: AuthVerify
): Promise<boolean> {
  const normalizedAddress = verify.address.toLowerCase();
  const challenge = challenges.get(normalizedAddress);
  
  if (!challenge) {
    throw new MCPError(ErrorCodes.UNAUTHORIZED, 'Challenge not found or expired');
  }
  
  if (challenge.expiresAt < Date.now()) {
    challenges.delete(normalizedAddress);
    throw new MCPError(ErrorCodes.UNAUTHORIZED, 'Challenge expired');
  }
  
  try {
    // Verify the signature using viem
    const isValid = await verifyMessage({
      address: verify.address as `0x${string}`,
      message: challenge.challenge,
      signature: verify.signature as `0x${string}`
    });
    
    if (!isValid) {
      throw new MCPError(ErrorCodes.UNAUTHORIZED, 'Invalid signature');
    }
    
    // Create authenticated session
    const session: AuthenticatedRequest = {
      address: normalizedAddress,
      authenticatedAt: Date.now()
    };
    
    authenticatedSessions.set(normalizedAddress, session);
    
    // Clean up challenge
    challenges.delete(normalizedAddress);
    
    return true;
  } catch (error) {
    throw new MCPError(
      ErrorCodes.UNAUTHORIZED,
      'Signature verification failed',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

/**
 * Check if request is authenticated
 */
export function isAuthenticated(address: string): boolean {
  const normalizedAddress = address.toLowerCase();
  const session = authenticatedSessions.get(normalizedAddress);
  
  if (!session) return false;
  
  // Session valid for 24 hours
  const SESSION_DURATION = 24 * 60 * 60 * 1000;
  if (Date.now() - session.authenticatedAt > SESSION_DURATION) {
    authenticatedSessions.delete(normalizedAddress);
    return false;
  }
  
  return true;
}

/**
 * Get authenticated session
 */
export function getSession(address: string): AuthenticatedRequest | null {
  const normalizedAddress = address.toLowerCase();
  return authenticatedSessions.get(normalizedAddress) || null;
}

/**
 * Logout / clear session
 */
export function logout(address: string): void {
  const normalizedAddress = address.toLowerCase();
  authenticatedSessions.delete(normalizedAddress);
}

/**
 * Simple API Key auth for development/testing
 * NOT for production - only use in controlled environments
 */
export function verifyApiKey(apiKey: string): boolean {
  const validKey = process.env.MCP_API_KEY;
  if (!validKey) {
    // If no API key set, deny all (secure by default)
    return false;
  }
  return apiKey === validKey;
}

/**
 * Rate limiting check
 */
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(identifier: string): boolean {
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000');
  const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100');
  
  const now = Date.now();
  const record = requestCounts.get(identifier);
  
  if (!record || now > record.resetTime) {
    // New window
    requestCounts.set(identifier, {
      count: 1,
      resetTime: now + windowMs
    });
    return true;
  }
  
  if (record.count >= maxRequests) {
    return false;
  }
  
  record.count++;
  return true;
}

/**
 * Get client identifier from request
 */
export function getClientIdentifier(req: { headers: Record<string, string | undefined> }): string {
  // Use X-Forwarded-For if behind proxy, otherwise use connection info
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return 'unknown';
}
