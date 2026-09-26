/**
 * Order domain types.
 *
 * These are the inputs a user submits and the enriched result we return.
 */

// ─── Input ───────────────────────────────────────────────────────────────────

/** Structured e-commerce order data submitted by the user for risk analysis. */
export interface OrderData {
  /** Total order value in USD. */
  orderAmount: number;
  /** How old the customer account is, in days. */
  customerAgeDays: number;
  /** Number of successfully completed previous orders. */
  previousOrders: number;
  /** Number of failed payment attempts on this account. */
  failedPayments: number;
  /** Whether the shipping and billing addresses match. */
  shippingBillingMatch: boolean;
  /** Number of distinct line items in the order. */
  itemsCount: number;
  /** Whether the delivery destination is outside the account's home country. */
  internationalOrder: boolean;
}

// ─── Output ──────────────────────────────────────────────────────────────────

/** Recommended action after risk analysis. */
export type RiskAction = "APPROVE" | "REVIEW" | "HOLD";

/** Risk level label. */
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

/** The final risk assessment returned to the client. */
export interface RiskAssessment {
  /** Recommended operational action — derived from Laya's numeric signals via threshold rules. */
  action: RiskAction;
  /** Human-readable risk tier derived from fraudProbability. */
  riskLevel: RiskLevel;
  /**
   * Fraud probability (0–1) from Laya's `is_fraudulent` noul question.
   * 0 = very unlikely fraud, 1 = very likely fraud.
   */
  fraudProbability: number;
  /**
   * Raw signals from each Laya question, exposed for transparency and audit.
   * NOTE: Laya's `confidence` field is intentionally excluded — the self-hosted
   * checkpoint ships uncalibrated temperatures and its confidence values are unreliable.
   */
  signals: RiskSignals;
  /** A short human-readable summary of the key risk factors. */
  summary: string;
}

/** Per-dimension Laya answers, exposed for transparency. */
export interface RiskSignals {
  /**
   * Fraud risk score on the 0–2 rubric (none / suspicious / high).
   * Returned by Laya's `score` question.
   * Action thresholds: APPROVE < 1.0, HOLD ≥ 1.65, REVIEW in between.
   */
  fraudScore: number;
  /** Always a string[] — normalised from Laya's raw legend (which may be an object). */
  fraudScoreLegend: string[];
  /**
   * Probability (0–1) that the order exhibits fraudulent intent.
   * Returned by Laya's `is_fraudulent` noul question.
   */
  fraudProbability: number;
  /**
   * Probability (0–1) that a human review is warranted.
   * Returned by Laya's `needs_review` noul question.
   */
  reviewNeeded: number;
}
