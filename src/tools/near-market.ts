// src/tools/near-market.ts - NEAR Market integration tools

import {
  GetBidsSchema,
  GetJobsSchema,
  GetAgentProfileSchema,
  GetBidsInput,
  GetJobsInput,
  GetAgentProfileInput,
  NearBid,
  NearJob,
  AgentProfile,
  MCPError,
  ErrorCodes
} from '../types.js';
import { validateSchema, sanitizeString, validateJobId } from '../utils/validation.js';
import { ToolDefinition, AuthenticatedRequest } from '../types.js';

// NEAR API configuration
const NEAR_API_BASE = 'https://market.near.ai';

/**
 * Make authenticated request to NEAR API
 */
async function nearApiRequest(endpoint: string, auth: AuthenticatedRequest): Promise<any> {
  const apiKey = process.env.NEAR_API_KEY;
  
  if (!apiKey) {
    throw new MCPError(
      ErrorCodes.INTERNAL_ERROR,
      'NEAR API key not configured'
    );
  }
  
  const url = `${NEAR_API_BASE}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'ClawCoded-MCP/2.0.0'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new MCPError(
        ErrorCodes.NEAR_API_ERROR,
        `NEAR API error: ${response.status}`,
        { status: response.status, body: errorText }
      );
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof MCPError) throw error;
    
    throw new MCPError(
      ErrorCodes.NEAR_API_ERROR,
      'Failed to connect to NEAR API',
      { error: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

/**
 * Tool: Get my bids on NEAR Market
 * Read-only, shows bid status without sensitive details
 */
export const getMyBidsTool: ToolDefinition = {
  name: 'get_near_bids',
  description: 'Get my active bids on NEAR Market. Filter by status: pending, awarded, completed, or all.',
  inputSchema: GetBidsSchema,
  requiresAuth: true,
  readOnly: true,
  
  handler: async (args: GetBidsInput, auth: AuthenticatedRequest): Promise<NearBid[]> => {
    // Validate input
    const validated = validateSchema(GetBidsSchema, args);
    
    // Fetch bids from NEAR API
    const bids = await nearApiRequest('/v1/agents/me/bids', auth);
    
    // Filter by status if specified
    let filteredBids = bids;
    if (validated.status !== 'all') {
      filteredBids = bids.filter((bid: any) => bid.status === validated.status);
    }
    
    // Limit results
    filteredBids = filteredBids.slice(0, validated.limit);
    
    // Sanitize and transform response
    return filteredBids.map((bid: any): NearBid => ({
      jobId: validateJobId(bid.job_id),
      jobTitle: sanitizeString(bid.job?.title || 'Untitled Job'),
      amount: bid.amount,
      token: bid.job?.budget_token || 'NEAR',
      status: bid.status,
      bidDate: bid.created_at,
      eta: bid.eta_seconds
    }));
  }
};

/**
 * Tool: Get available jobs on NEAR Market
 * Read-only, browse open jobs
 */
export const getMarketJobsTool: ToolDefinition = {
  name: 'get_near_jobs',
  description: 'Browse available jobs on NEAR Market. Filter by status, budget range, or tags.',
  inputSchema: GetJobsSchema,
  requiresAuth: false, // Public endpoint
  readOnly: true,
  
  handler: async (args: GetJobsInput): Promise<NearJob[]> => {
    const validated = validateSchema(GetJobsSchema, args);
    
    // Build query params
    const params = new URLSearchParams();
    if (validated.status && validated.status !== 'all') {
      params.set('status', validated.status);
    }
    if (validated.tag && validated.tag.length > 0) {
      params.set('tag', validated.tag);
    }
    
    const queryString = params.toString() ? `?${params.toString()}` : '';
    
    // Fetch jobs
    const jobs = await nearApiRequest(`/v1/jobs${queryString}`, { 
      address: 'public', 
      authenticatedAt: 0 
    });
    
    // Filter by budget if specified
    let filteredJobs = jobs;
    if (validated.minBudget !== undefined) {
      filteredJobs = filteredJobs.filter((job: any) => 
        parseFloat(job.budget_amount) >= validated.minBudget!
      );
    }
    if (validated.maxBudget !== undefined) {
      filteredJobs = filteredJobs.filter((job: any) => 
        parseFloat(job.budget_amount) <= validated.maxBudget!
      );
    }
    
    // Limit results
    filteredJobs = filteredJobs.slice(0, validated.limit);
    
    // Sanitize and transform
    return filteredJobs.map((job: any): NearJob => ({
      jobId: validateJobId(job.job_id),
      title: sanitizeString(job.title),
      description: sanitizeString(job.description || '').substring(0, 500), // Limit description
      budgetAmount: job.budget_amount,
      budgetToken: job.budget_token,
      bidCount: job.bid_count,
      status: job.status,
      tags: (job.tags || []).map(sanitizeString),
      expiresAt: job.expires_at
    }));
  }
};

/**
 * Tool: Get agent profile info
 * Read-only, shows public profile data
 */
export const getAgentProfileTool: ToolDefinition = {
  name: 'get_agent_profile',
  description: 'Get ClawCoded agent profile information from NEAR Market.',
  inputSchema: GetAgentProfileSchema,
  requiresAuth: false,
  readOnly: true,
  
  handler: async (args: GetAgentProfileInput, auth: AuthenticatedRequest): Promise<AgentProfile> => {
    const validated = validateSchema(GetAgentProfileSchema, args);
    
    // Fetch profile
    const profile = await nearApiRequest('/v1/agents/me', auth || { address: process.env.WALLET_ADDRESS || 'unknown', authenticatedAt: Date.now() });
    
    const result: AgentProfile = {
      handle: profile.handle || 'clawcoded',
      agentId: profile.agent_id,
      totalBids: 0, // Will be populated if includeStats
      activeBids: 0,
      completedJobs: 0,
      reputationScore: profile.reputation_score || 0,
      capabilities: Object.keys(profile.capabilities || {})
    };
    
    // Fetch stats if requested
    if (validated.includeStats) {
      try {
        const bids = await nearApiRequest('/v1/agents/me/bids', auth);
        result.totalBids = bids.length;
        result.activeBids = bids.filter((b: any) => b.status === 'pending').length;
        result.completedJobs = bids.filter((b: any) => b.status === 'completed').length;
      } catch {
        // Stats optional, don't fail if error
      }
    }
    
    return result;
  }
};

/**
 * Export all tools
 */
export const nearMarketTools: ToolDefinition[] = [
  getMyBidsTool,
  getMarketJobsTool,
  getAgentProfileTool
];
