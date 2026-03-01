# x402 Payment Integration Guide

MCP server dengan monetisasi - Agent lain bayar per penggunaan tools.

## 💰 Cara Kerja x402

### Flow Singkat

```
Agent Lain Request Tool
        ↓
Server: "Bayar dulu 0.01 USDC"
        ↓
Agent: Transfer on-chain → 0xYourWallet
        ↓
Agent: Kirim tx hash sebagai bukti
        ↓
Server: Verify on-chain ✓
        ↓
Server: Execute tool → Return result
        ↓
Kamu: Earn 0.01 USDC 💵
```

## 🎯 Pricing (Per Tool)

| Tool | Harga | Kenapa |
|------|-------|--------|
| `check_token_price` | 0.01 USDC | Simple lookup |
| `assess_liquidity_risk` | 0.02 USDC | Analisis lebih kompleks |
| `check_token_age` | 0.01 USDC | Safety check |
| `get_coin_profile` | 0.02 USDC | Banyak data |
| `research_market` | 0.05 USDC | Heavy research |
| `get_price_history` | 0.03 USDC | Historical data |
| `check_exchange` | 0.02 USDC | Exchange data |
| `portfolio_valuation` | 0.05 USDC | Multi-token calc |

## 🔧 Setup x402

### 1. Environment Variables

```env
WALLET_ADDRESS=0x00BD00749EA0cBb28c6e9c4Ef0d95263aabCc0FD
```

### 2. Run Server

```bash
# Mode x402 (with payments)
npm run start:x402

# Mode gratis (tanpa payments)
npm run start
```

## 📡 Cara Pakai (Untuk Agent Lain)

### Step 1: List Tools (Lihat harga)

```bash
curl https://clawcoded.up.railway.app/mcp/tools
```

Response:
```json
{
  "tools": [{
    "name": "check_token_price",
    "description": "Get real-time token price...",
    "pricing": {
      "requiresPayment": true,
      "acceptedTokens": ["USDC", "NEAR"],
      "estimatedCost": "0.01 USD"
    }
  }]
}
```

### Step 2: Request Tool (Tanpa Payment)

```bash
curl -X POST https://clawcoded.up.railway.app/mcp/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "check_token_price",
    "arguments": {
      "chain": "ethereum",
      "contractAddress": "0xdac17f958d2ee523a2206206994597c13d831ec7"
    }
  }'
```

Response (402 Payment Required):
```json
{
  "error": 402,
  "message": "Payment required",
  "payment": {
    "paymentId": "pay_1234567890_abc",
    "amount": "10000", // 0.01 USDC (6 decimals)
    "token": {
      "symbol": "USDC",
      "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "decimals": 6
    },
    "recipient": "0x00BD00749EA0cBb28c6e9c4Ef0d95263aabCc0FD"
  }
}
```

### Step 3: Bayar On-Chain

Agent transfer USDC ke address yang diberikan:

```javascript
// Contoh dengan viem/ethers
const tx = await walletClient.writeContract({
  address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
  abi: erc20Abi,
  functionName: 'transfer',
  args: [
    '0x00BD00749EA0cBb28c6e9c4Ef0d95263aabCc0FD', // Kamu
    10000n // 0.01 USDC
  ]
});
// tx = 0xabc123...
```

### Step 4: Request Tool Lagi (Dengan Payment Proof)

```bash
curl -X POST https://clawcoded.up.railway.app/mcp/call \
  -H "Content-Type: application/json" \
  -d '{
    "name": "check_token_price",
    "arguments": {
      "chain": "ethereum",
      "contractAddress": "0xdac17f958d2ee523a2206206994597c13d831ec7",
      "_paymentId": "pay_1234567890_abc",
      "_txHash": "0xabc123..."
    }
  }'
```

Response (Success):
```json
{
  "token": "0xdac17f958d2ee523a2206206994597c13d831ec7",
  "chain": "ethereum",
  "price": 1.00,
  "marketCap": 83500000000,
  "volume24h": 45000000000,
  "_meta": {
    "paymentVerified": true,
    "paymentId": "pay_1234567890_abc"
  }
}
```

## 📊 Monitoring

### Check Payment Stats

```bash
curl https://clawcoded.up.railway.app/mcp/stats
```

Response:
```json
{
  "totalPending": 5,
  "totalPaid": 150,
  "totalExpired": 10,
  "revenue": {
    "USDC": "3.250000",
    "NEAR": "0.500000"
  }
}
```

## 🔐 Security

### Payment Verification
- ✅ On-chain verification (Base mainnet)
- ✅ Amount validation
- ✅ Recipient address check
- ✅ Transaction status confirmation
- ✅ Anti-replay (paymentId unique)

### Timeout
- Payment valid: 5 menit
- Session: 24 jam setelah verified

## 💡 Tips Monetisasi

### 1. Freemium Model
```typescript
// Tools gratis (tanpa x402)
- get_coin_profile (free)
- check_exchange (free)

// Tools berbayar (dengan x402)
- assess_liquidity_risk (0.02 USDC)
- portfolio_valuation (0.05 USDC)
```

### 2. Volume Discount
```typescript
// Kalau agent pakai banyak, kasih discount
if (monthlyUsage > 100) {
  price = price * 0.9; // 10% off
}
```

### 3. Subscription
```typescript
// Premium agents bayar bulanan
// Unlimited calls untuk fixed price
```

## 🚀 Deploy dengan x402

### Railway
```bash
# Set env vars di Railway dashboard
WALLET_ADDRESS=0xYourAddress

# Deploy
git push railway main
```

### Update 8004scan Metadata
```json
{
  "services": [{
    "name": "MCP-x402",
    "endpoint": "https://clawcoded.up.railway.app/mcp",
    "version": "2.0.0",
    "pricing": "x402-pay-per-use"
  }],
  "x402PaymentAddress": "0x00BD00749EA0cBb28c6e9c4Ef0d95263aabCc0FD"
}
```

## ❓ FAQ

**Q: Kenapa agent lain mau bayar?**  
A: Tools kita save mereka waktu & effort. Lebih murah bayar $0.01 daripada build sendiri.

**Q: Apa bisa gratis untuk teman?**  
A: Bisa! Whitelist address teman, bypass payment.

**Q: Gimana kalau payment stuck?**  
A: Payment auto-expire dalam 5 menit. Agent bisa request ulang.

**Q: Bisa withdraw revenue?**  
A: Revenue langsung masuk wallet. No middleman!

---

## 📈 Revenue Projection

| Scenario | Calls/Hari | Revenue/Hari | Revenue/Bulan |
|----------|-----------|--------------|---------------|
| Small (10 agents) | 100 | $1 | $30 |
| Medium (100 agents) | 1,000 | $10 | $300 |
| Large (1,000 agents) | 10,000 | $100 | $3,000 |

**Passive income dari tools!** 🚀
