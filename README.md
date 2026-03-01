# ClawCoded MCP Server v2.0.0

Secure MCP (Model Context Protocol) server for ClawCoded AI agent with Crypto/DeFi tools integration using installed OpenClaw skills.

## 🛡️ Security Features

- ✅ **Wallet-based authentication** (SIWE pattern)
- ✅ **Rate limiting** (configurable)
- ✅ **Input validation** with Zod schemas
- ✅ **Data sanitization** (prevents injection)
- ✅ **Sensitive data redaction** in logs
- ✅ **Read-only tools** (safe for production)
- ✅ **No high-risk operations** (no transfers, no trades)

## 🔧 Tools Overview

### Crypto/DeFi Tools (8 tools)

| Tool | Skill Used | Purpose |
|------|-----------|---------|
| `check_token_price` | pair-scout, chain-tracker | Real-time price, volume, liquidity |
| `assess_liquidity_risk` | liquidity-guard | Risk rating (LOW/MEDIUM/HIGH) |
| `check_token_age` | pair-age-check | Token age + safety check |
| `get_coin_profile` | coin-deep | Full coin profile, social links |
| `research_market` | research-desk | Market intelligence |
| `get_price_history` | price-history | Historical data, charting |
| `check_exchange` | exchange-intel | Exchange rankings, trust scores |
| `portfolio_valuation` | chain-tracker | Portfolio value calculation |

**All tools are read-only and safe.**

## 📦 Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env (optional - no API keys needed!)
nano .env
```

## ⚙️ Configuration

Create `.env` file (all optional):

```env
# Wallet Auth (optional)
WALLET_ADDRESS=0x00BD00749EA0cBb28c6e9c4Ef0d95263aabCc0FD

# Server
PORT=3000
NODE_ENV=production

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

**Note:** No API keys needed! Tools use installed OpenClaw skills with pre-configured APIs.

## 🚀 Running

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

## 📚 Tool Details

### 1. `check_token_price`
Get real-time token data by contract address or symbol.

**Input:**
```json
{
  "chain": "ethereum",
  "contractAddress": "0x...",
  "includeMarketCap": true,
  "includeVolume": true
}
```

### 2. `assess_liquidity_risk`
Check if a DEX pair is safe to trade.

**Input:**
```json
{
  "pairAddress": "0x...",
  "chain": "ethereum"
}
```

**Output:** LOW/MEDIUM/HIGH risk rating

### 3. `check_token_age`
Critical safety check - flags new tokens as high risk.

**Input:**
```json
{
  "pairAddress": "0x...",
  "chain": "ethereum"
}
```

**Note:** Pairs under 24h old = highest rug pull risk

### 4. `get_coin_profile`
Deep dive on any cryptocurrency.

**Input:**
```json
{
  "coinId": "bitcoin",
  "includeDeveloperData": true
}
```

### 5. `research_market`
Market intelligence and sector analysis.

**Input:**
```json
{
  "category": "defi",
  "limit": 10
}
```

### 6. `get_price_history`
Historical data for backtesting.

**Input:**
```json
{
  "coinId": "ethereum",
  "days": 30
}
```

### 7. `check_exchange`
Exchange rankings and trust scores.

**Input:**
```json
{
  "type": "cex",
  "includeDerivatives": false
}
```

### 8. `portfolio_valuation`
Calculate portfolio value.

**Input:**
```json
{
  "chain": "ethereum",
  "holdings": {
    "0x...": 100.5,
    "0x...": 50.0
  }
}
```

## 🔐 Authentication

Wallet-based auth using SIWE (Sign-In with Ethereum):

1. Generate challenge
2. Sign with wallet
3. Verify signature
4. Session valid for 24 hours

## 🚫 Security Boundaries

**NEVER implemented (too risky):**
- ❌ Token transfers
- ❌ Trade execution
- ❌ Wallet operations
- ❌ Write operations without approval

**Read-only approach:**
- ✅ All current tools are read-only
- ✅ No private keys in server
- ✅ Data from reputable sources (CoinGecko, DexScreener)

## 🐛 Debugging

```bash
# Type check
npm run typecheck

# Build check
npm run build

# Run dev
npm run dev
```

## 📄 License

MIT License - ClawCoded Agent
