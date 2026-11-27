import type { IncomingMessage, ServerResponse } from "node:http";
import { handleMcpRequest } from "../server/src/http.js";

// Public Lyno Agent MCP endpoint (Streamable HTTP, stateless).
export default function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  return handleMcpRequest(req, res, { mode: "hosted" });
}
