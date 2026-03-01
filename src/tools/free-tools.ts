// src/tools/free-tools.ts - Tools tanpa API key (GRATIS)

import { z } from 'zod';
import { ToolDefinition } from '../types.js';
import { validateSchema } from '../utils/validation.js';

// ============== SCHEMAS ==============

export const CalculateSchema = z.object({
  operation: z.enum(['add', 'subtract', 'multiply', 'divide', 'percentage']),
  a: z.number(),
  b: z.number()
});

export const FormatNumberSchema = z.object({
  number: z.number(),
  decimals: z.number().min(0).max(18).default(2),
  currency: z.enum(['USD', 'NEAR', 'ETH', 'BTC', '']).default('')
});

export const TimeConverterSchema = z.object({
  timestamp: z.number().optional(),
  dateString: z.string().optional(),
  format: z.enum(['iso', 'unix', 'human']).default('human')
}).refine(data => data.timestamp || data.dateString, {
  message: "Either timestamp or dateString must be provided"
});

export const RiskCalculatorSchema = z.object({
  entryPrice: z.number().positive(),
  stopLoss: z.number().positive(),
  positionSize: z.number().positive()
});

export const CompoundInterestSchema = z.object({
  principal: z.number().positive(),
  rate: z.number().positive(), // Annual rate %
  time: z.number().positive(), // Years
  compound: z.enum(['daily', 'monthly', 'yearly']).default('yearly')
});

// ============== FREE TOOLS ==============

/**
 * Tool 1: Calculator (GRATIS)
 * Basic math operations
 */
export const calculatorTool: ToolDefinition = {
  name: 'calculate',
  description: 'Basic calculator: add, subtract, multiply, divide, percentage. FREE - no API key needed.',
  inputSchema: CalculateSchema,
  requiresAuth: false,
  readOnly: true,
  requiresPayment: false, // GRATIS!
  
  handler: async (args) => {
    const validated = validateSchema(CalculateSchema, args);
    let result = 0;
    
    switch (validated.operation) {
      case 'add':
        result = validated.a + validated.b;
        break;
      case 'subtract':
        result = validated.a - validated.b;
        break;
      case 'multiply':
        result = validated.a * validated.b;
        break;
      case 'divide':
        if (validated.b === 0) throw new Error('Cannot divide by zero');
        result = validated.a / validated.b;
        break;
      case 'percentage':
        result = (validated.a * validated.b) / 100;
        break;
    }
    
    return {
      operation: validated.operation,
      inputs: { a: validated.a, b: validated.b },
      result,
      source: 'internal-calculator',
      pricing: 'FREE',
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Tool 2: Format Number (GRATIS)
 * Format numbers with currency
 */
export const formatNumberTool: ToolDefinition = {
  name: 'format_number',
  description: 'Format numbers with decimals and currency symbols. FREE - no API key needed.',
  inputSchema: FormatNumberSchema,
  requiresAuth: false,
  readOnly: true,
  requiresPayment: false, // GRATIS!
  
  handler: async (args) => {
    const validated = validateSchema(FormatNumberSchema, args);
    
    const symbols: Record<string, string> = {
      USD: '$',
      NEAR: 'Ⓝ',
      ETH: 'Ξ',
      BTC: '₿',
      '': ''
    };
    
    const symbol = symbols[validated.currency || ''] || '';
    const formatted = validated.number.toLocaleString('en-US', {
      minimumFractionDigits: validated.decimals,
      maximumFractionDigits: validated.decimals
    });
    
    return {
      original: validated.number,
      formatted: `${symbol}${formatted}`,
      currency: validated.currency,
      decimals: validated.decimals,
      source: 'internal-formatter',
      pricing: 'FREE',
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Tool 3: Time Converter (GRATIS)
 * Convert timestamps and dates
 */
export const timeConverterTool: ToolDefinition = {
  name: 'time_converter',
  description: 'Convert between Unix timestamps and human-readable dates. FREE - no API key needed.',
  inputSchema: TimeConverterSchema,
  requiresAuth: false,
  readOnly: true,
  requiresPayment: false, // GRATIS!
  
  handler: async (args) => {
    const validated = validateSchema(TimeConverterSchema, args);
    
    let date: Date;
    if (validated.timestamp) {
      date = new Date(validated.timestamp * 1000);
    } else {
      date = new Date(validated.dateString!);
    }
    
    const formats = {
      iso: date.toISOString(),
      unix: Math.floor(date.getTime() / 1000),
      human: date.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
      })
    };
    
    return {
      input: validated.timestamp ? `timestamp: ${validated.timestamp}` : `date: ${validated.dateString}`,
      iso: formats.iso,
      unix: formats.unix,
      human: formats.human,
      source: 'internal-converter',
      pricing: 'FREE',
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Tool 4: Risk Calculator (GRATIS)
 * Calculate position risk
 */
export const riskCalculatorTool: ToolDefinition = {
  name: 'risk_calculator',
  description: 'Calculate position size, risk amount, and risk percentage for trading. FREE - no API key needed.',
  inputSchema: RiskCalculatorSchema,
  requiresAuth: false,
  readOnly: true,
  requiresPayment: false, // GRATIS!
  
  handler: async (args) => {
    const validated = validateSchema(RiskCalculatorSchema, args);
    
    const riskAmount = Math.abs(validated.entryPrice - validated.stopLoss) * validated.positionSize;
    const riskPercentage = (Math.abs(validated.entryPrice - validated.stopLoss) / validated.entryPrice) * 100;
    const riskReward = validated.entryPrice > validated.stopLoss 
      ? (validated.entryPrice - validated.stopLoss) / (validated.entryPrice * 0.02) // Target 2% profit
      : 0;
    
    return {
      entryPrice: validated.entryPrice,
      stopLoss: validated.stopLoss,
      positionSize: validated.positionSize,
      riskAmount,
      riskPercentage: riskPercentage.toFixed(2) + '%',
      riskRewardRatio: riskReward.toFixed(2) + ':1',
      recommendation: riskPercentage > 5 
        ? 'HIGH RISK: Consider smaller position size'
        : riskPercentage > 2
        ? 'MODERATE RISK: Acceptable for most traders'
        : 'LOW RISK: Conservative position',
      source: 'internal-calculator',
      pricing: 'FREE',
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Tool 5: Compound Interest (GRATIS)
 * Calculate compound returns
 */
export const compoundInterestTool: ToolDefinition = {
  name: 'compound_interest',
  description: 'Calculate compound interest for crypto investments. FREE - no API key needed.',
  inputSchema: CompoundInterestSchema,
  requiresAuth: false,
  readOnly: true,
  requiresPayment: false, // GRATIS!
  
  handler: async (args) => {
    const validated = validateSchema(CompoundInterestSchema, args);
    
    const compoundsPerYear: Record<string, number> = {
      daily: 365,
      monthly: 12,
      yearly: 1
    };
    
    const n = compoundsPerYear[validated.compound || 'yearly'];
    const r = validated.rate / 100;
    const amount = validated.principal * Math.pow((1 + r/n), n * validated.time);
    const interest = amount - validated.principal;
    
    return {
      principal: validated.principal,
      annualRate: validated.rate + '%',
      time: validated.time + ' years',
      compound: validated.compound,
      finalAmount: amount.toFixed(2),
      totalInterest: interest.toFixed(2),
      growth: ((interest / validated.principal) * 100).toFixed(2) + '%',
      source: 'internal-calculator',
      pricing: 'FREE',
      timestamp: new Date().toISOString()
    };
  }
};

// ============== EXPORT ==============

export const freeTools: ToolDefinition[] = [
  calculatorTool,
  formatNumberTool,
  timeConverterTool,
  riskCalculatorTool,
  compoundInterestTool
];
