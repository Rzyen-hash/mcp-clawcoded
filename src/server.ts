// src/server.ts - MCP Server configuration

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
import { isAuthenticated, getSession, checkRateLimit, getClientIdentifier } from './utils/auth.js';
import { sanitizeForLogging } from './utils/validation.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

// Combine all tools
const allTools: ToolDefinition[] = [
  ...cryptoTools
];

/**
 * Create and configure MCP server
 */
export function createServer(): Server {
  const server = new Server(
    {
      name: 'clawcoded-mcp',
      version: '2.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: allTools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema ? zodToJsonSchema(tool.inputSchema, { name: 'input' }) : { type: 'object' }
      }))
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    console.error(`[MCP] Tool call: ${name}`, sanitizeForLogging(args));
    
    // Find tool
    const tool = allTools.find(t => t.name === name);
    
    if (!tool) {
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Tool not found: ${name}`
      );
    }
    
    // Check authentication if required
    if (tool.requiresAuth) {
      // For now, we'll accept any auth passed in context
      // In production, you'd validate JWT or session here
      const address = (args as any)?._auth?.address;
      
      if (!address || !isAuthenticated(address)) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          'Authentication required. Please authenticate first using wallet signature.'
        );
      }
      
      // Rate limiting
      const clientId = getClientIdentifier({ headers: {} });
      if (!checkRateLimit(`${clientId}:${address}`)) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          'Rate limit exceeded. Please try again later.'
        );
      }
      
      const session = getSession(address)!;
      
      try {
        const result = await tool.handler(args, session);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        return handleToolError(error);
      }
    } else {
      // Public tool (no auth required)
      try {
        const result = await tool.handler(args, { address: 'public', authenticatedAt: 0 });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        return handleToolError(error);
      }
    }
  });

  return server;
}

/**
 * Handle tool errors
 */
function handleToolError(error: unknown) {
  console.error('[MCP] Tool error:', error);
  
  if (error instanceof CustomMCPError) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: true,
            code: error.code,
            message: error.message,
            details: error.details
          }, null, 2)
        }
      ],
      isError: true
    };
  }
  
  if (error instanceof McpError) {
    throw error;
  }
  
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          error: true,
          code: ErrorCodes.INTERNAL_ERROR,
          message: error instanceof Error ? error.message : 'Unknown error'
        }, null, 2)
      }
    ],
    isError: true
  };
}

/**
 * Start server with stdio transport
 */
export async function startServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  
  console.error('[MCP] ClawCoded MCP Server v2.0.0 starting...');
  console.error('[MCP] Tools loaded:', allTools.map(t => t.name).join(', '));
  
  await server.connect(transport);
  
  console.error('[MCP] Server connected and ready');
}
