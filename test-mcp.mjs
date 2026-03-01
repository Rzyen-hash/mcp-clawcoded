// test-mcp.js - Test MCP server locally
import { createHybridServer, getStats } from './dist/server-hybrid.js';

async function test() {
  console.log('🧪 Testing MCP Hybrid Server\n');
  
  // Get server stats
  console.log('📊 Server Stats:');
  const stats = getStats();
  console.log(JSON.stringify(stats, null, 2));
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test FREE tool: calculate
  console.log('🆓 Testing FREE Tool: calculate');
  console.log('Input: { operation: "add", a: 10, b: 5 }');
  
  // Simulate tool call
  const mockRequest = {
    params: {
      name: 'calculate',
      arguments: {
        operation: 'add',
        a: 10,
        b: 5
      }
    }
  };
  
  console.log('Expected: FREE tool, direct execution\n');
  
  // Test PAID tool: check_token_price
  console.log('💰 Testing PAID Tool: check_token_price');
  console.log('Input: { chain: "ethereum", contractAddress: "0x..." }');
  console.log('Expected: 402 Payment Required\n');
  
  console.log('✅ Test framework ready!');
  console.log('\nTo test fully, run: npm start');
  console.log('Then use MCP client to connect via stdio');
}

test().catch(console.error);
