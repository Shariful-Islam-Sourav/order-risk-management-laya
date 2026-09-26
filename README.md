# 🛡️ Order Risk Detector

An AI-powered e-commerce order risk analyser built with **TypeScript + Express**, using the [Laya](https://laya.studio) **System 1 decision engine** to evaluate orders for fraud risk in a single forward pass.

## What is Laya?

**Laya** (by Convai Innovations) is a non-autoregressive "System 1" decision model — not a chatbot or text generator. It accepts a **state** (any text or JSON) and a set of typed **questions**, then returns calibrated probabilities in ~33–120 ms with no hallucination risk.

Three question types are available:
| Type | What it returns |
|------|----------------|
| `choice` | Winning label + probability distribution |
| `score` | Float on an ordered rubric + distribution |
| `noul` | A single float 0–1 (probability the statement is true) |

This app uses the **Jev-compatible HTTP API** (`POST /v1/systemone`) which works with both:
- **Laya Studio** (hosted, Swiss GPUs): `https://api.laya.studio`
- **laya-serve** (self-hosted): `http://localhost:8000`

---

## Architecture

```
public/index.html          ← Frontend (vanilla HTML/CSS/JS)
src/
  server.ts                ← Express entry point
  laya/
    types.ts               ← Full Laya API type definitions
    client.ts              ← Thin HTTP client for /v1/systemone
  services/
    riskAnalysis.ts        ← Builds Laya request, maps answers to RiskAssessment
  routes/
    analyse.ts             ← POST /api/analyse — validates + calls service
  types/
    order.ts               ← OrderData + RiskAssessment domain types
```

### How the Laya call works

The order JSON is passed as the `state`. Four questions are asked in **one forward pass**:

```typescript
{
  state: {
    order_amount_usd: 850,
    customer_account_age_days: 2,
    previous_successful_orders: 0,
    failed_payment_attempts: 3,
    shipping_billing_address_match: false,
    number_of_items: 8,
    international_delivery: true
  },
  questions: {
    action:          { type: "choice", criteria: { APPROVE, REVIEW, HOLD } },
    fraud_risk:      { type: "score",  criteria: ["none", "suspicious", "high"] },
    is_fraudulent:   { type: "noul",   instructions: "Does this order show fraud patterns?" },
    needs_review:    { type: "noul",   instructions: "Should a human review this order?" }
  }
}
```

---

## Getting Started

### 1. Get a Laya API key

Sign up at **https://laya.studio/signup** — 5 free runs, then \$0.0294/1M tokens.

Alternatively, run Laya locally:
```bash
pip install "laya[serve]"
LAYA_PRELOAD=1 laya-serve      # binds 0.0.0.0:8000
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env and set:
#   LAYA_API_KEY=your_key_here
#   LAYA_BASE_URL=https://api.laya.studio   (or http://localhost:8000 for local)
```

### 3. Install & run

```bash
npm install
npm run dev      # starts on http://localhost:3000
```

---

## API

### `POST /api/analyse`

**Request body:**
```json
{
  "orderAmount": 850,
  "customerAgeDays": 2,
  "previousOrders": 0,
  "failedPayments": 3,
  "shippingBillingMatch": false,
  "itemsCount": 8,
  "internationalOrder": true
}
```

**Response:**
```json
{
  "action": "HOLD",
  "riskLevel": "HIGH",
  "fraudProbability": 0.87,
  "confidence": 0.82,
  "summary": "Risk signals detected: very new account (2 days old), no previous order history, 3 failed payment attempts, shipping/billing address mismatch, high order value ($850), international shipment, large item count (8 items). Laya estimated an 87% fraud probability → HOLD.",
  "signals": {
    "actionChoice": "HOLD",
    "actionProbabilities": { "APPROVE": 0.03, "REVIEW": 0.12, "HOLD": 0.85 },
    "fraudScore": 1.84,
    "fraudScoreLegend": ["none — order looks legitimate", "suspicious — some risk signals present", "high — multiple serious risk signals"],
    "fraudProbability": 0.87,
    "reviewNeeded": 0.94
  }
}
```

### `GET /health`

Returns server status and whether the Laya key is configured.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 22 + TypeScript |
| Framework | Express 4 |
| AI Decision Engine | Laya (via `POST /v1/systemone`) |
| Dev server | tsx + nodemon |
| Frontend | Vanilla HTML/CSS/JS (no build step) |
