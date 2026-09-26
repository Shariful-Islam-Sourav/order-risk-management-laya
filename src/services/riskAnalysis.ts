/**
 * Risk analysis service.
 *
 * Laya question design — what each question type does well:
 *
 *  - `fraud_risk`    score  → HOW risky is this order? (0 = none, 2 = high)
 *  - `is_fraudulent` noul   → probability the order is fraudulent (0–1)
 *  - `needs_review`  noul   → probability a human should look at this (0–1)
 *
 * ⚠️  We deliberately do NOT use a `choice` question to pick APPROVE/REVIEW/HOLD.
 *
 * Why: Laya's zero-shot `choice` maps JSON field *names* (which contain words
 * like "failed_payment_attempts") to labels, making it biased toward HOLD
 * regardless of the actual values. The `score` and `noul` question types are
 * far more reliable for numeric/continuous signals.
 *
 * Instead, the final action is derived *in code* from the calibrated numeric
 * signals using explicit business-rule thresholds. This is the correct
 * separation of concerns:
 *
 *   Laya answers factual questions → code applies business rules → action
 *
 * Action thresholds:
 *
 *   APPROVE  fraudProbability < 0.30  AND  fraudScore < 1.0
 *   HOLD     fraudProbability ≥ 0.60  OR   fraudScore ≥ 1.65
 *   REVIEW   everything in between
 */

import { LayaClient } from "../laya/client.js";
import type { LayaNoulAnswer, LayaScoreAnswer } from "../laya/types.js";
import type {
  OrderData,
  RiskAction,
  RiskAssessment,
  RiskLevel,
} from "../types/order.js";

// ─── Laya question definitions ────────────────────────────────────────────────

const RISK_QUESTIONS = {
  fraud_risk: {
    type: "score" as const,
    instructions:
      "Rate the overall fraud risk level of this order. " +
      "A NEW account (under 7 days old) with NO prior orders, MULTIPLE failed payments, " +
      "a MISMATCHED shipping/billing address, a HIGH order value (over $500), " +
      "and INTERNATIONAL shipping are each serious fraud signals. " +
      "Score HIGH if several of these are present simultaneously.",
    criteria: [
      "none — established account, clean payment history, matching addresses, normal order size",
      "suspicious — one or two mild risk signals, but overall profile is mostly normal",
      "high — multiple serious risk signals present at the same time (new account + failed payments + address mismatch, etc.)",
    ] as string[],
  },

  is_fraudulent: {
    type: "noul" as const,
    instructions:
      "Is this order likely to be fraudulent? " +
      "Key fraud indicators: account is less than 7 days old with zero previous orders; " +
      "two or more failed payment attempts; shipping address does NOT match billing address; " +
      "order total exceeds $500; international delivery. " +
      "If three or more of these indicators are true simultaneously, answer yes.",
  },

  needs_review: {
    type: "noul" as const,
    instructions:
      "Should a human fraud analyst manually review this order before it ships? " +
      "Answer yes if any meaningful combination of risk signals is present " +
      "(e.g. new account with failed payments, or address mismatch with high value order).",
  },
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build the state passed to Laya.
 *
 * We describe the order in plain English sentences rather than raw JSON keys,
 * because Laya reads text — clear prose gives it better context than terse
 * key names like "failed_payment_attempts".
 */
function buildState(order: OrderData): string {
  const parts: string[] = [
    `Order total: $${order.orderAmount}.`,
    `Customer account age: ${order.customerAgeDays} day${order.customerAgeDays === 1 ? "" : "s"}.`,
    `Previous successful orders on this account: ${order.previousOrders}.`,
    `Failed payment attempts: ${order.failedPayments}.`,
    `Shipping and billing address ${order.shippingBillingMatch ? "match" : "do NOT match"}.`,
    `Number of items in order: ${order.itemsCount}.`,
    `International delivery: ${order.internationalOrder ? "yes" : "no"}.`,
  ];
  return parts.join(" ");
}

/**
 * Derive the action from Laya's calibrated numeric signals.
 *
 * This keeps business logic in code where it is auditable and tunable,
 * instead of relying on zero-shot classification.
 *
 * fraudScore  — 0 (none) to 2 (high)
 * fraudProb   — 0.0 (clean) to 1.0 (fraud)
 * reviewNeeded — 0.0 to 1.0 probability a human should look
 */
function computeAction(
  fraudProbability: number,
  fraudScore: number,
  reviewNeeded: number
): RiskAction {
  // Clear hold: high fraud probability OR very high risk score
  if (fraudProbability >= 0.60 || fraudScore >= 1.65) return "HOLD";

  // Clear approve: low fraud probability AND low risk score AND low review signal
  if (fraudProbability < 0.30 && fraudScore < 1.15 && reviewNeeded < 0.55) return "APPROVE";

  // Everything in between: send for human review
  return "REVIEW";
}

/** Risk level label derived from fraud probability. */
function toRiskLevel(fraudProbability: number): RiskLevel {
  if (fraudProbability >= 0.60) return "HIGH";
  if (fraudProbability >= 0.30) return "MEDIUM";
  return "LOW";
}

/** Build a plain-English summary of the key signals and the decision. */
function buildSummary(order: OrderData, action: RiskAction, fraudProb: number): string {
  const flags: string[] = [];

  if (order.customerAgeDays < 7) {
    flags.push(`very new account (${order.customerAgeDays} day${order.customerAgeDays === 1 ? "" : "s"} old)`);
  }
  if (order.previousOrders === 0) {
    flags.push("no previous order history");
  }
  if (order.failedPayments > 0) {
    flags.push(`${order.failedPayments} failed payment attempt${order.failedPayments > 1 ? "s" : ""}`);
  }
  if (!order.shippingBillingMatch) {
    flags.push("shipping/billing address mismatch");
  }
  if (order.orderAmount > 500) {
    flags.push(`high order value (\$${order.orderAmount})`);
  }
  if (order.internationalOrder) {
    flags.push("international shipment");
  }
  if (order.itemsCount > 6) {
    flags.push(`large item count (${order.itemsCount} items)`);
  }

  const fraudPct = Math.round(fraudProb * 100);
  const verdict = `Laya estimated a ${fraudPct}% fraud probability → ${action}.`;

  if (flags.length === 0) {
    return `Order looks clean. ${verdict}`;
  }
  return `Risk signals detected: ${flags.join(", ")}. ${verdict}`;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class RiskAnalysisService {
  constructor(private readonly laya: LayaClient) {}

  /**
   * Analyse an e-commerce order and return a risk assessment.
   *
   * Three Laya questions (score + noul + noul) are sent in one forward pass.
   * The action (APPROVE / REVIEW / HOLD) is then derived from the numeric
   * signals using threshold rules — not from a choice question.
   */
  async analyse(order: OrderData): Promise<RiskAssessment> {
    const state = buildState(order);

    const layaResponse = await this.laya.systemOne({
      state,
      questions: RISK_QUESTIONS,
    });

    const answers = layaResponse.answers;

    // ── Extract typed answers ────────────────────────────────────────────────
    const fraudRiskAnswer    = answers["fraud_risk"]    as LayaScoreAnswer;
    const isFraudulentAnswer = answers["is_fraudulent"] as LayaNoulAnswer;
    const needsReviewAnswer  = answers["needs_review"]  as LayaNoulAnswer;

    const fraudProbability = isFraudulentAnswer.noul;
    const fraudScore       = fraudRiskAnswer.score;
    const reviewNeeded     = needsReviewAnswer.noul;

    // ── Derive action from thresholds (not from a choice question) ───────────
    const action    = computeAction(fraudProbability, fraudScore, reviewNeeded);
    const riskLevel = toRiskLevel(fraudProbability);

    // Normalise legend: laya-serve may return an object {"0":"...", "1":"..."}
    const rawLegend = fraudRiskAnswer.legend;
    const fraudScoreLegend: string[] = Array.isArray(rawLegend)
      ? rawLegend
      : Object.values(rawLegend);

    const assessment: RiskAssessment = {
      action,
      riskLevel,
      fraudProbability,
      signals: {
        fraudScore,
        fraudScoreLegend,
        fraudProbability,
        reviewNeeded,
      },
      summary: buildSummary(order, action, fraudProbability),
    };

    return assessment;
  }
}
