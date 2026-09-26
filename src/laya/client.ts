/**
 * Laya HTTP client — thin wrapper around POST /v1/systemone.
 *
 * Works with:
 *  - Laya Studio (hosted): https://api.laya.studio
 *  - Self-hosted laya-serve: http://localhost:8000
 *
 * Both expose the exact same Jev-compatible wire protocol.
 */

import type { LayaRequest, LayaResponse } from "./types.js";

export class LayaClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;

  constructor(baseUrl: string, apiKey?: string) {
    // Strip trailing slash for clean URL construction
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  /**
   * Call Laya's /v1/systemone endpoint.
   *
   * @param request - The state + questions to evaluate.
   * @returns The structured answer map from Laya.
   * @throws {LayaError} on HTTP errors or network failures.
   */
  async systemOne(request: LayaRequest): Promise<LayaResponse> {
    const url = `${this.baseUrl}/v1/systemone`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Laya Studio and laya-serve both support Bearer token auth via LAYA_API_KEY
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
      });
    } catch (err) {
      throw new LayaError(
        `Network error connecting to Laya at ${url}: ${String(err)}`,
        0
      );
    }

    if (!response.ok) {
      let body = "";
      try {
        body = await response.text();
      } catch {
        // ignore
      }
      throw new LayaError(
        `Laya API returned HTTP ${response.status}: ${body}`,
        response.status
      );
    }

    const data = (await response.json()) as LayaResponse;
    return data;
  }
}

/** Thrown when the Laya API call fails for any reason. */
export class LayaError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "LayaError";
  }
}
