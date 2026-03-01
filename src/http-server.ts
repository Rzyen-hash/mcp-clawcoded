// src/http-server.ts - HTTP server for Railway deployment
import express from 'express';
import cors from 'cors';
import { createHybridServer } from './server-hybrid.js';
import { getStats } from './server-hybrid.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'mcp-clawcoded',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

// Stats endpoint
app.get('/stats', (req, res) => {
  res.json(getStats());
});

// Root endpoint
app.get('/', (req, res) => {
  const stats = getStats();
  res.json({
    name: 'ClawCoded MCP Server',
    version: '2.0.0',
    description: 'Hybrid FREE + PAID (x402) MCP Server',
    endpoints: {
      health: '/health',
      stats: '/stats',
      sse: '/sse'
    },
    tools: {
      free: stats.tools.freeList,
      paid: stats.tools.paidList
    },
    pricing: {
      free: 'No payment required',
      paid: 'x402 payment (0.01-0.05 USDC)'
    }
  });
});

// SSE endpoint for MCP
app.get('/sse', async (req, res) => {
  console.log('[HTTP] New SSE connection');
  
  const server = createHybridServer();
  const transport = new SSEServerTransport('/message', res);
  
  await server.connect(transport);
});

// Message endpoint for MCP
app.post('/message', async (req, res) => {
  console.log('[HTTP] Received message');
  
  const sessionId = req.query.sessionId as string;
  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId' });
  }
  
  // Handle message (simplified)
  res.json({ status: 'received' });
});

// Start HTTP server
app.listen(PORT, () => {
  console.log('╔════════════════════════════════════════╗');
  console.log('║     ClawCoded MCP Server v2.0.0        ║');
  console.log('║     HTTP Server (Railway Ready)        ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');
  console.log(`🌐 Server running on port ${PORT}`);
  console.log(`🔗 Health: http://localhost:${PORT}/health`);
  console.log(`📊 Stats: http://localhost:${PORT}/stats`);
  console.log(`🚀 SSE: http://localhost:${PORT}/sse`);
  console.log('');
});
