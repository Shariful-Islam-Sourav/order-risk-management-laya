/**
 * Shared Express App configuration
 * Used by both local dev server (`server.ts`) and Netlify Functions (`netlify/functions/api.ts`).
 */

import express from "express";
import cors from "cors";
import { LayaClient } from "./laya/client.js";
import { RiskAnalysisService } from "./services/riskAnalysis.js";
import { createAnalyseRouter } from "./routes/analyse.js";

export function createApp() {
  const LAYA_BASE_URL = process.env.LAYA_BASE_URL ?? "https://api.laya.studio";
  const LAYA_API_KEY = process.env.LAYA_API_KEY;

  const layaClient = new LayaClient(LAYA_BASE_URL, LAYA_API_KEY);
  const riskService = new RiskAnalysisService(layaClient);

  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      laya: {
        baseUrl: LAYA_BASE_URL,
        keyConfigured: Boolean(
          LAYA_API_KEY && LAYA_API_KEY !== "your_laya_studio_api_key_here"
        ),
      },
    });
  });

  // Support both /api/analyse (direct server) and /analyse (when routed via Netlify function redirect)
  const router = createAnalyseRouter(riskService);
  app.use("/api/analyse", router);
  app.use("/analyse", router);

  return app;
}
