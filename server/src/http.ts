import type { IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { AGENT_TITLE, AGENT_VERSION } from "./config.js";
import { createLynoServer, type LynoServerOptions } from "./server.js";

const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, GET, OPTIONS",
  "access-control-allow-headers": "content-type, accept, authorization, mcp-session-id, mcp-protocol-version, last-event-id",
  "access-control-expose-headers": "mcp-session-id, mcp-protocol-version",
};

function sendJson(res: ServerResponse, status: number, body: unknown, extra: Record<string, string> = {}) {
  res.writeHead(status, { "content-type": "application/json", ...CORS_HEADERS, ...extra });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage & { body?: unknown }): Promise<unknown> {
  if (req.body !== undefined) {
    // Some hosts (e.g. Vercel) pre-parse the body.
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  }
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : undefined;
}

export function healthPayload(mode: string) {
  return { status: "ok", agent: AGENT_TITLE, version: AGENT_VERSION, mode, transport: "streamable-http" };
}

/**
 * Stateless Streamable HTTP handler for the MCP endpoint.
 * Each POST gets a fresh server + transport, so it runs fine on serverless platforms.
 */
export async function handleMcpRequest(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
  options: LynoServerOptions = {},
) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS_HEADERS).end();
    return;
  }
  if (req.method === "GET") {
    // Stateless server: no standalone SSE stream. Answer browsers with something useful.
    sendJson(
      res,
      405,
      { ...healthPayload(options.mode ?? "local"), hint: "This is an MCP endpoint. Send JSON-RPC requests with POST." },
      { allow: "POST, OPTIONS" },
    );
    return;
  }
  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" }, { allow: "POST, OPTIONS" });
    return;
  }

  let body: unknown;
  try {
    body = await readBody(req);
  } catch {
    sendJson(res, 400, { jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null });
    return;
  }

  for (const [k, v] of Object.entries(CORS_HEADERS)) res.setHeader(k, v);
  const server = createLynoServer(options);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => {
    transport.close();
    server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch (err) {
    console.error("[lyno] request failed:", err);
    if (!res.headersSent) {
      sendJson(res, 500, { jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null });
    }
  }
}
