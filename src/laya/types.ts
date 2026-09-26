/**
 * Laya API types — matching the real /v1/systemone wire protocol.
 *
 * Laya is a non-autoregressive "System 1" decision engine by Convai Innovations.
 * It answers typed questions (choice / score / noul) in a single forward pass.
 * Wire-compatible with the Jev /v1/systemone protocol.
 *
 * Docs: https://nandhakishorm.github.io/laya/
 * Studio (hosted): https://laya.studio
 */

// ─── Request ─────────────────────────────────────────────────────────────────

/** A choice question: pick one label from a set of criteria. */
export interface LayaChoiceQuestion {
  type: "choice";
  /** Plain-English instruction, e.g. "Which action should be taken for this order?" */
  instructions: string;
  /**
   * Labels with optional descriptions.
   * - Object form: { label: "description of what that label means", ... }
   * - Array form: ["label1", "label2", ...] (no descriptions)
   */
  criteria: Record<string, string> | string[];
}

/** A score question: place the input on an ordered rubric. */
export interface LayaScoreQuestion {
  type: "score";
  /** Plain-English instruction describing what to measure. */
  instructions: string;
  /**
   * Ordered rubric levels (lowest → highest).
   * - Array form: ["not urgent", "soon", "critical"]
   * - Object form: { "0": "low", "5": "medium", "10": "high" }
   */
  criteria: string[] | Record<string, string>;
}

/** A noul question: probability (0–1) that a statement is true. */
export interface LayaNoulQuestion {
  type: "noul";
  /** A yes/no statement to evaluate, e.g. "Does this order show signs of fraud?" */
  instructions: string;
}

export type LayaQuestion =
  | LayaChoiceQuestion
  | LayaScoreQuestion
  | LayaNoulQuestion;

/** Full request body for POST /v1/systemone */
export interface LayaRequest {
  /**
   * The state to analyse — any text, JSON object, or structured document.
   * Laya converts it to a string internally.
   */
  state: string | Record<string, unknown>;
  /** Map of question IDs (your keys) → question definitions. */
  questions: Record<string, LayaQuestion>;
  /**
   * Optional model override.
   * Laya Studio / laya-serve auto-routes by language when omitted.
   * Explicit values: "english" | "multilingual" | "typed-decisions"
   */
  model?: string;
}

// ─── Response ────────────────────────────────────────────────────────────────

/** Answer for a `choice` question. */
export interface LayaChoiceAnswer {
  /** The winning label (highest probability). */
  choice: string;
  /** Probability distribution across all provided labels. */
  probabilities: Record<string, number>;
  /** Calibrated confidence score (0–1). */
  confidence: number;
}

/** Answer for a `score` question. */
export interface LayaScoreAnswer {
  /** Numeric expectation across the rubric levels (can be a float between levels). */
  score: number;
  /**
   * The rubric levels that were used.
   * laya-serve may return this as either a string[] or a Record<string, string>
   * with numeric keys (e.g. {"0": "none", "1": "suspicious", "2": "high"}).
   * Normalise with Object.values() before calling .join().
   */
  legend: string[] | Record<string, string>;
  /** Probability distribution across the rubric levels. */
  probabilities: Record<string, number>;
  /** Calibrated confidence score (0–1). */
  confidence: number;
}

/** Answer for a `noul` question. */
export interface LayaNoulAnswer {
  /** Probability (0.0–1.0) that the statement in `instructions` is true. */
  noul: number;
}

export type LayaAnswer = LayaChoiceAnswer | LayaScoreAnswer | LayaNoulAnswer;

/** Token usage reported by the API. */
export interface LayaUsage {
  input_tokens: number;
  output_tokens: number;
}

/** Routing metadata (present when using laya Python SDK; may be absent in HTTP responses). */
export interface LayaRouting {
  model: string;
  reason?: string;
}

/** Full response body from POST /v1/systemone */
export interface LayaResponse {
  /** Map of question IDs → typed answers. Mirrors the `questions` keys in the request. */
  answers: Record<string, LayaAnswer>;
  /** Token consumption for billing / monitoring. */
  usage?: LayaUsage;
  /** Which checkpoint handled the request (when routing metadata is returned). */
  routing?: LayaRouting;
}
