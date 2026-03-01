#!/usr/bin/env node
// src/index.ts - Main entry point

import { startHybridServer } from './server-hybrid.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate required environment variables
function validateEnv(): void {
  // All tools use installed OpenClaw skills - no external API keys required
  // Skills already have their own API keys configured
  
  // Optional: Warn about recommended variables
  if (!process.env.WALLET_ADDRESS) {
    console.error('[WARN] WALLET_ADDRESS not set. Wallet auth will be limited.');
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled rejection:', reason);
  process.exit(1);
});

// Main function
async function main(): Promise<void> {
  console.error('╔════════════════════════════════════════╗');
  console.error('║     ClawCoded MCP Server v2.0.0        ║');
  console.error('║   Hybrid: FREE + PAID (x402)           ║');
  console.error('╚════════════════════════════════════════╝');
  console.error('');
  
  // Validate environment
  validateEnv();
  
  // Start hybrid server (FREE + PAID)
  try {
    await startHybridServer();
  } catch (error) {
    console.error('[FATAL] Failed to start server:', error);
    process.exit(1);
  }
}

// Run main
main();
