// src/server-hybrid.ts - Hybrid MCP Server (FREE + PAID tools)

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';

import { cryptoTools, freeTools } from './tools/index.js';
import { ToolDefinition, MCPError as CustomMCPError } from './types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { requirePayment, verifyPayment, isPaymentValid, getPaymentStats } from './utils/x402.js';
import { sanitizeForLogging } from './utils/validation.js';

const allTools: ToolDefinition[] = [...freeTools, ...cryptoTools];

/**
 * Create hybrid MCP server (FREE + PAID)
 */
export function createHybridServer(): Server {
  const server = new Server(
    {
      name: 'clawcoded-mcp-hybrid',
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
        pricing: {
          requiresPayment: tool.requiresPayment || false,
          acceptedTokens: tool.requiresPayment ? ['USDC', 'NEAR'] : [],
          estimatedCost: tool.requiresPayment 
            ? (tool.name.includes('research') || tool.name.includes('portfolio') ? '0.05 USD' : '0.01-0.02 USD')
            : 'FREE'
        }
      }))
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    console.error(`[MCP] Tool request: ${name}`, sanitizeForLogging(args));
    
    // Find tool
    const tool = allTools.find(t => t.name === name);
    if (!tool) {
      throw new McpError(ErrorCode.MethodNotFound, `Tool not found: ${name}`);
    }
    
    // Check if tool is FREE or PAID
    const isFreeTool = !tool.requiresPayment;
    
    if (isFreeTool) {
      // ===== FREE TOOL =====
      console.error(`[MCP] Executing FREE tool: ${name}`);
      
      try {
        const result = await tool.handler(args, { 
          address: 'anonymous', 
          authenticatedAt: Date.now() 
        });
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              ...result,
              _meta: {
                tool: name,
                pricing: 'FREE',
                message: 'This tool is free - no payment required!'
              }
            }, null, 2)
          }]
        };
      } catch (error) {
        return handleToolError(error);
      }
      
    } else {
      // ===== PAID TOOL (x402) =====
      console.error(`[MCP] PAID tool requested: ${name}`);
      
      const clientAddress = (args as any)?._clientAddress || 'anonymous';
      const paymentId = (args as any)?._paymentId;
      const txHash = (args as any)?._txHash;
      
      // Step 1: No payment provided → require payment
      if (!paymentId) {
        const paymentRequired = requirePayment(name, clientAddress);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: 402,
              message: 'Payment required for this tool',
              reason: 'This tool uses paid API services (CoinGecko/DexScreener)',
              pricing: paymentRequired.payment,
              instructions: [
                '1. Send payment on-chain to the specified address',
                '2. Wait for transaction confirmation',
                '3. Call tool again with _paymentId and _txHash',
                '4. Or use _paymentId if already paid before'
              ],
              alternative: 'Use FREE tools instead: calculate, format_number, risk_calculator, compound_interest'
            }, null, 2)
          }],
          isError: false
        };
      }
      
      // Step 2: Has paymentId but new txHash → verify
      if (txHash) {
        try {
          await verifyPayment(paymentId, txHash);
          console.error(`[MCP] Payment verified: ${paymentId}`);
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 402,
                message: 'Payment verification failed',
                details: error instanceof Error ? error.message : 'Unknown error'
              }, null, 2)
            }],
            isError: true
          };
        }
      }
      
      // Step 3: Check if payment valid
      if (!isPaymentValid(paymentId)) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: 402,
              message: 'Payment expired or invalid',
              requireNewPayment: true,
              note: 'Payments valid for 5 minutes. Please make new payment.'
            }, null, 2)
          }],
          isError: true
        };
      }
      
      // Payment valid → execute tool
      console.error(`[MCP-x402] Payment valid for ${name}, executing...`);
      
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
                tool: name,
                pricing: 'PAID',
                thankYou: 'Thank you for your payment!'
              }
            }, null, 2)
          }]
        };
        
      } catch (error) {
        return handleToolError(error);
      }
    }
  });

  return server;
}

// Stats endpoint
export function getStats(): any {
  const freeToolsCount = freeTools.length;
  const paidToolsCount = cryptoTools.length;
  const paymentStats = getPaymentStats();
  
  return {
    tools: {
      total: allTools.length,
      free: freeToolsCount,
      paid: paidToolsCount,
      freeList: freeTools.map(t => t.name),
      paidList: cryptoTools.map(t => t.name)
    },
    payments: paymentStats
  };
}

function handleToolError(error: unknown) {
  console.error('[MCP] Tool error:', error);
  
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

/**
 * Start server
 */
export async function startHybridServer(): Promise<void> {
  const server = createHybridServer();
  const transport = new StdioServerTransport();
  
  console.error('╔════════════════════════════════════════╗');
  console.error('║     ClawCoded MCP Server v2.0.0        ║');
  console.error('║   Hybrid: FREE + PAID (x402)           ║');
  console.error('╚════════════════════════════════════════╝');
  console.error('');
  console.error(`FREE Tools: ${freeTools.length}`);
  freeTools.forEach(t => console.error(`  ✓ ${t.name}`));
  console.error('');
  console.error(`PAID Tools (x402): ${cryptoTools.length}`);
  cryptoTools.forEach(t => console.error(`  $ ${t.name}`));
  console.error('');
  
  await server.connect(transport);
  console.error('[MCP] Server ready!');
}
