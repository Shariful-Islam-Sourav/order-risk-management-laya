/**
 * Express server — Local dev server
 */

import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import { createApp } from "./app.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const LAYA_BASE_URL = process.env.LAYA_BASE_URL ?? "https://api.laya.studio";
const LAYA_API_KEY = process.env.LAYA_API_KEY;

if (!LAYA_API_KEY || LAYA_API_KEY === "your_laya_studio_api_key_here") {
  console.warn(
    "⚠️  LAYA_API_KEY is not set or is still the placeholder value.\n" +
    "   Get a free key at https://laya.studio/signup (5 free runs).\n" +
    "   Or run a local laya-serve and set LAYA_BASE_URL=http://localhost:8000."
  );
}

const app = createApp();

// Serve the frontend from public/ — no-cache so browser always gets latest
const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir, {
  setHeaders: (res) => {
    res.setHeader("Cache-Control", "no-store");
  },
}));

// Request logging (dev-friendly)
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.listen(PORT, () => {
  console.log(`\n🚀  Order Risk Detector running at http://localhost:${PORT}`);
  console.log(`    Laya endpoint: ${LAYA_BASE_URL}/v1/systemone`);
  console.log(`    Health check:  http://localhost:${PORT}/health\n`);
});
