import type { IncomingMessage, ServerResponse } from "node:http";
import { healthPayload } from "../server/src/http.js";

export default function handler(_req: IncomingMessage, res: ServerResponse) {
  res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*", "cache-control": "no-store" });
  res.end(JSON.stringify({ ...healthPayload("hosted"), endpoint: "/mcp" }));
}
