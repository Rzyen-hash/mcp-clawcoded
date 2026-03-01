// src/server-x402.ts - MCP Server with x402 Payment Integration

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';

import { cryptoTools } from './tools/index.js';
import { ToolDefinition, MCPError as CustomMCPError, ErrorCodes } from './types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { 
  requirePayment, 
  verifyPayment, 
  isPaymentValid,
  getPaymentStats 
} from './utils/x402.js';
import { sanitizeForLogging } from './utils/validation.js';

const allTools: ToolDefinition[] = [...cryptoTools];

/**
 * Create x402-enabled MCP server
 */
export function createX402Server(): Server {
  const server = new Server(
    {
      name: 'clawcoded-mcp-x402',
      version: '2.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // List tools with pricing info
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: allTools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema ? zodToJsonSchema(tool.inputSchema, { name: 'input' }) : { type: 'object' },
        // x402 payment info
        pricing: {
          requiresPayment: true,
          acceptedTokens: ['USDC', 'NEAR'],
          estimatedCost: '0.01-0.05 USD'
        }
      }))
    };
  });

  // Handle tool calls with x402 payment
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    console.error(`[MCP-x402] Tool request: ${name}`, sanitizeForLogging(args));
    
    // Find tool
    const tool = allTools.find(t => t.name === name);
    if (!tool) {
      throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${name}`);
    }
    
    // Get client address from args
    const clientAddress = (args as any)?._clientAddress || 'anonymous';
    const paymentId = (args as any)?._paymentId;
    
    // Check payment
    if (!paymentId) {
      // No payment provided - require payment
      const paymentRequired = requirePayment(name, clientAddress);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 402,
            message: 'Payment required',
            payment: paymentRequired.payment,
            instructions: [
              '1. Send payment on-chain to the specified address',
              '2. Include paymentId in your next request',
              '3. Transaction will be verified on-chain'
            ]
          }, null, 2)
        }],
        isError: false // This is expected behavior
      };
    }
    
    // Verify payment
    if (!isPaymentValid(paymentId)) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 402,
            message: 'Payment expired or invalid',
            requireNewPayment: true
          }, null, 2)
        }],
        isError: true
      };
    }
    
    // Payment valid - execute tool
    console.error(`[MCP-x402] Payment verified for ${name}, executing...`);
    
    try {
      const result = await tool.handler(args, { 
        address: clientAddress, 
        authenticatedAt: Date.now() 
      });
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            ...result,
            _meta: {
              paymentVerified: true,
              paymentId,
              tool: name
            }
          }, null, 2)
        }]
      };
      
    } catch (error) {
      return handleToolError(error);
    }
  });

  return server;
}

// Handle verify payment endpoint (for HTTP transport)
export async function handleVerifyPayment(
  paymentId: string, 
  txHash: string
): Promise<any> {
  try {
    const verified = await verifyPayment(paymentId, txHash);
    
    if (verified) {
      return {
        success: true,
        message: 'Payment verified. You can now use the tool.',
        paymentId,
        txHash
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Verification failed'
    };
  }
}

// Get payment stats
export function getX402Stats(): any {
  return getPaymentStats();
}

function handleToolError(error: unknown) {
  console.error('[MCP-x402] Tool error:', error);
  
  if (error instanceof CustomMCPError) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: true,
          code: error.code,
          message: error.message
        }, null, 2)
      }],
      isError: true
    };
  }
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        error: true,
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, null, 2)
    }],
    isError: true
  };
}
