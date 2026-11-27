import type { IncomingMessage, ServerResponse } from "node:http";
import { runAgent } from "./_agent.js";

const HEADERS = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "cache-control": "no-store",
};

// Best-effort per-instance rate limit (serverless instances don't share memory).
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, number[]>();

function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, HEADERS);
  res.end(JSON.stringify(body));
}

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  if (req.method === "OPTIONS") return void res.writeHead(204, HEADERS).end();
  if (req.method !== "POST") return send(res, 405, { error: "Use POST with {\"message\": \"...\"}" });

  const ip = String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "").split(",")[0].trim();
  if (limited(ip)) return send(res, 429, { error: "Too many messages. Wait a minute and try again." });

  let body: { message?: unknown; history?: unknown };
  try {
    if (req.body !== undefined) {
      body = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) as typeof body;
    } else {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    }
  } catch {
    return send(res, 400, { error: "Invalid JSON body." });
  }

  if (typeof body.message !== "string" || !body.message.trim()) {
    return send(res, 400, { error: "Field \"message\" is required." });
  }

  try {
    send(res, 200, await runAgent(body.message, body.history));
  } catch (err) {
    console.error("[lyno-agent] failed:", err);
    send(res, 500, { error: "Lyno Agent hit an error. Try again." });
  }
}
