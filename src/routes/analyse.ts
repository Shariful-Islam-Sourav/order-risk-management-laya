/**
 * POST /api/analyse
 *
 * Accepts an OrderData body, validates it, calls the RiskAnalysisService,
 * and returns a RiskAssessment JSON response.
 */

import { Router, type Request, type Response } from "express";
import { LayaError } from "../laya/client.js";
import { RiskAnalysisService } from "../services/riskAnalysis.js";
import type { OrderData } from "../types/order.js";

export function createAnalyseRouter(riskService: RiskAnalysisService): Router {
  const router = Router();

  router.post("/", async (req: Request, res: Response): Promise<void> => {
    // ── Validate input ──────────────────────────────────────────────────────
    const body = req.body as Partial<OrderData>;

    const validationError = validateOrder(body);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const order = body as OrderData;

    // ── Call Laya via the risk service ─────────────────────────────────────
    try {
      const assessment = await riskService.analyse(order);
      res.json(assessment);
    } catch (err) {
      if (err instanceof LayaError) {
        // Laya-specific errors (auth failure, model error, etc.)
        const status = err.statusCode === 401 ? 401 : 502;
        res.status(status).json({
          error: "Laya API error",
          detail: err.message,
        });
      } else {
        console.error("[analyse] Unexpected error:", err);
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  return router;
}

// ─── Validation ──────────────────────────────────────────────────────────────

function validateOrder(body: Partial<OrderData>): string | null {
  const required: Array<keyof OrderData> = [
    "orderAmount",
    "customerAgeDays",
    "previousOrders",
    "failedPayments",
    "shippingBillingMatch",
    "itemsCount",
    "internationalOrder",
  ];

  for (const field of required) {
    if (body[field] === undefined || body[field] === null) {
      return `Missing required field: ${field}`;
    }
  }

  if (typeof body.orderAmount !== "number" || body.orderAmount < 0) {
    return "orderAmount must be a non-negative number";
  }
  if (typeof body.customerAgeDays !== "number" || body.customerAgeDays < 0) {
    return "customerAgeDays must be a non-negative integer";
  }
  if (typeof body.previousOrders !== "number" || body.previousOrders < 0) {
    return "previousOrders must be a non-negative integer";
  }
  if (typeof body.failedPayments !== "number" || body.failedPayments < 0) {
    return "failedPayments must be a non-negative integer";
  }
  if (typeof body.shippingBillingMatch !== "boolean") {
    return "shippingBillingMatch must be a boolean";
  }
  if (typeof body.itemsCount !== "number" || body.itemsCount < 1) {
    return "itemsCount must be a positive integer";
  }
  if (typeof body.internationalOrder !== "boolean") {
    return "internationalOrder must be a boolean";
  }

  return null;
}
