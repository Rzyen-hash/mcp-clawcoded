// src/types.ts - Type definitions for MCP ClawCoded

import { z } from 'zod';

// Tool input/output schemas
export const GetBidsSchema = z.object({
  status: z.enum(['pending', 'awarded', 'completed', 'all']).optional().default('all'),
  limit: z.number().min(1).max(50).optional().default(10)
});

export const GetJobsSchema = z.object({
  status: z.enum(['open', 'filled', 'expired', 'all']).optional().default('open'),
  minBudget: z.number().optional(),
  maxBudget: z.number().optional(),
  tag: z.string().optional(),
  limit: z.number().min(1).max(50).optional().default(20)
});

export const GetAgentProfileSchema = z.object({
  includeStats: z.boolean().optional().default(true)
});

// Types derived from schemas
export type GetBidsInput = z.infer<typeof GetBidsSchema>;
export type GetJobsInput = z.infer<typeof GetJobsSchema>;
export type GetAgentProfileInput = z.infer<typeof GetAgentProfileSchema>;

// NEAR API Types (sanitized - no sensitive data)
export interface NearBid {
  jobId: string;
  jobTitle: string;
  amount: string;
  token: string;
  status: 'pending' | 'awarded' | 'rejected' | 'completed';
  bidDate: string;
  eta: number; // in seconds
}

export interface NearJob {
  jobId: string;
  title: string;
  description: string;
  budgetAmount: string;
  budgetToken: string;
  bidCount: number;
  status: 'open' | 'filled' | 'expired';
  tags: string[];
  expiresAt: string;
}

export interface AgentProfile {
  handle: string;
  agentId: string;
  totalBids: number;
  activeBids: number;
  completedJobs: number;
  reputationScore: number;
  capabilities: string[];
}

// Auth types
export interface AuthChallenge {
  challenge: string;
  timestamp: number;
  expiresAt: number;
}

export interface AuthVerify {
  address: string;
  signature: string;
  challenge: string;
}

export interface AuthenticatedRequest {
  address: string;
  authenticatedAt: number;
}

// Tool definition type
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<any>;
  handler: (args: any, auth: AuthenticatedRequest) => Promise<any>;
  requiresAuth: boolean;
  readOnly: boolean;
  requiresPayment?: boolean; // true = x402 payment required (tools with API keys)
}

// Error types
export class MCPError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_INPUT: 'INVALID_INPUT',
  RATE_LIMITED: 'RATE_LIMITED',
  NEAR_API_ERROR: 'NEAR_API_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;
