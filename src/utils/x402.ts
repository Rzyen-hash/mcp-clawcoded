// src/utils/x402.ts - x402 Payment Protocol Integration
// Docs: https://github.com/coinbase/x402

import { createPublicClient, http, parseUnits, formatUnits } from 'viem';
import { base } from 'viem/chains';
import { MCPError, ErrorCodes } from '../types.js';

// x402 Configuration
const X402_CONFIG = {
  // Payment receiver address (your wallet)
  paymentAddress: process.env.WALLET_ADDRESS || '0x00BD00749EA0cBb28c6e9c4Ef0d95263aabCc0FD',
  
  // Accepted tokens
  acceptedTokens: [
    {
      symbol: 'USDC',
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base USDC
      decimals: 6,
      minAmount: '0.01' // Minimum $0.01 per request
    },
    {
      symbol: 'NEAR', 
      address: '0x', // Wrapped NEAR on Base (if exists)
      decimals: 24,
      minAmount: '0.001' // Minimum 0.001 NEAR
    }
  ],
  
  // Payment timeout (5 minutes)
  paymentTimeout: 5 * 60 * 1000,
  
  // Chain
  chain: base
};

// Store pending payments
interface PendingPayment {
  id: string;
  toolName: string;
  amount: string;
  token: string;
  clientAddress: string;
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'paid' | 'expired';
  receipt?: string;
}

const pendingPayments = new Map<string, PendingPayment>();

// Cleanup expired payments every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, payment] of pendingPayments.entries()) {
    if (payment.expiresAt < now && payment.status === 'pending') {
      payment.status = 'expired';
      pendingPayments.delete(id);
    }
  }
}, 600000);

/**
 * Generate payment requirement for x402
 * Called when client requests tool without payment
 */
export function requirePayment(
  toolName: string,
  clientAddress: string,
  tokenSymbol: string = 'USDC'
): { status: 402; payment: any } {
  const token = X402_CONFIG.acceptedTokens.find(t => t.symbol === tokenSymbol);
  
  if (!token) {
    throw new MCPError(
      ErrorCodes.INVALID_INPUT,
      'Token not supported',
      { supported: X402_CONFIG.acceptedTokens.map(t => t.symbol) }
    );
  }
  
  const paymentId = generatePaymentId();
  const amount = calculateToolPrice(toolName);
  
  const payment: PendingPayment = {
    id: paymentId,
    toolName,
    amount,
    token: tokenSymbol,
    clientAddress: clientAddress.toLowerCase(),
    createdAt: Date.now(),
    expiresAt: Date.now() + X402_CONFIG.paymentTimeout,
    status: 'pending'
  };
  
  pendingPayments.set(paymentId, payment);
  
  // x402 402 Payment Required response
  return {
    status: 402,
    payment: {
      scheme: 'x402',
      version: '1.0',
      network: 'base',
      paymentId,
      amount: parseUnits(amount, token.decimals).toString(),
      token: {
        symbol: token.symbol,
        address: token.address,
        decimals: token.decimals
      },
      recipient: X402_CONFIG.paymentAddress,
      description: `Payment for MCP tool: ${toolName}`,
      expiresAt: payment.expiresAt,
      // Client should call this endpoint with receipt after payment
      callback: `/verify-payment/${paymentId}`
    }
  };
}

/**
 * Verify on-chain payment
 * Called by client after they pay
 */
export async function verifyPayment(
  paymentId: string,
  txHash: string
): Promise<boolean> {
  const payment = pendingPayments.get(paymentId);
  
  if (!payment) {
    throw new MCPError(
      ErrorCodes.NOT_FOUND,
      'Payment not found or expired'
    );
  }
  
  if (payment.status !== 'pending') {
    throw new MCPError(
      ErrorCodes.INVALID_INPUT,
      'Payment already processed'
    );
  }
  
  // Verify on-chain
  const publicClient = createPublicClient({
    chain: X402_CONFIG.chain,
    transport: http()
  });
  
  try {
    // Get transaction receipt
    const receipt = await publicClient.getTransactionReceipt({
      hash: txHash as `0x${string}`
    });
    
    if (!receipt || receipt.status !== 'success') {
      throw new MCPError(
        ErrorCodes.INVALID_INPUT,
        'Transaction failed or not found'
      );
    }
    
    // Get transaction details
    const tx = await publicClient.getTransaction({
      hash: txHash as `0x${string}`
    });
    
    // Verify recipient
    if (tx.to?.toLowerCase() !== X402_CONFIG.paymentAddress.toLowerCase()) {
      throw new MCPError(
        ErrorCodes.INVALID_INPUT,
        'Payment sent to wrong address'
      );
    }
    
    // Verify amount (with small tolerance for gas)
    const token = X402_CONFIG.acceptedTokens.find(t => t.symbol === payment.token);
    if (token) {
      const expectedAmount = parseUnits(payment.amount, token.decimals);
      const actualAmount = tx.value;
      
      // For native token transfers
      // For ERC20, need to decode logs (simplified here)
      if (actualAmount < expectedAmount * BigInt(95) / BigInt(100)) {
        throw new MCPError(
          ErrorCodes.INVALID_INPUT,
          'Insufficient payment amount'
        );
      }
    }
    
    // Mark as paid
    payment.status = 'paid';
    payment.receipt = txHash;
    
    console.log(`[x402] Payment verified: ${paymentId} - ${payment.amount} ${payment.token}`);
    
    return true;
    
  } catch (error) {
    if (error instanceof MCPError) throw error;
    
    throw new MCPError(
      ErrorCodes.INTERNAL_ERROR,
      'Failed to verify payment',
      { error: error instanceof Error ? error.message : 'Unknown' }
    );
  }
}

/**
 * Check if payment is valid for tool execution
 */
export function isPaymentValid(paymentId: string): boolean {
  const payment = pendingPayments.get(paymentId);
  return payment?.status === 'paid' && payment.expiresAt > Date.now();
}

/**
 * Get payment details
 */
export function getPayment(paymentId: string): PendingPayment | null {
  return pendingPayments.get(paymentId) || null;
}

/**
 * Calculate price for each tool
 * Can be dynamic based on complexity
 */
function calculateToolPrice(toolName: string): string {
  const pricing: Record<string, string> = {
    'check_token_price': '0.01',      // $0.01 USDC
    'assess_liquidity_risk': '0.02',   // $0.02 (more complex)
    'check_token_age': '0.01',
    'get_coin_profile': '0.02',
    'research_market': '0.05',         // $0.05 (heavy research)
    'get_price_history': '0.03',
    'check_exchange': '0.02',
    'portfolio_valuation': '0.05'      // $0.05 (multiple calls)
  };
  
  return pricing[toolName] || '0.01';
}

/**
 * Generate unique payment ID
 */
function generatePaymentId(): string {
  return `pay_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Get payment stats
 */
export function getPaymentStats(): {
  totalPending: number;
  totalPaid: number;
  totalExpired: number;
  revenue: Record<string, string>;
} {
  let totalPending = 0;
  let totalPaid = 0;
  let totalExpired = 0;
  const revenue: Record<string, number> = {};
  
  for (const payment of pendingPayments.values()) {
    if (payment.status === 'pending') totalPending++;
    if (payment.status === 'paid') {
      totalPaid++;
      revenue[payment.token] = (revenue[payment.token] || 0) + parseFloat(payment.amount);
    }
    if (payment.status === 'expired') totalExpired++;
  }
  
  return {
    totalPending,
    totalPaid,
    totalExpired,
    revenue: Object.fromEntries(
      Object.entries(revenue).map(([k, v]) => [k, v.toFixed(6)])
    )
  };
}

/**
 * Middleware to check payment for tool
 * Usage in server.ts before executing tool
 */
export function checkToolPayment(
  toolName: string,
  clientAddress: string,
  paymentId?: string
): { allowed: boolean; response?: any } {
  // If no paymentId, require payment
  if (!paymentId) {
    return {
      allowed: false,
      response: requirePayment(toolName, clientAddress)
    };
  }
  
  // If paymentId provided, verify it's valid
  if (!isPaymentValid(paymentId)) {
    return {
      allowed: false,
      response: {
        error: true,
        code: 'PAYMENT_INVALID',
        message: 'Payment expired or invalid. Please make new payment.',
        requirePayment: requirePayment(toolName, clientAddress)
      }
    };
  }
  
  // Payment valid
  return { allowed: true };
}
