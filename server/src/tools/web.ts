import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MAX_FETCH_CHARS } from "../config.js";
import { fail, safe, text } from "../util.js";

/** Very small HTML → readable text converter (no dependencies). */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|li|tr|h[1-6]|header|footer)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

export function registerWebTools(server: McpServer) {
  server.registerTool(
    "fetch_url",
    {
      title: "Fetch URL",
      description:
        "Fetch a public http(s) URL. HTML pages are converted to readable text; JSON and plain text are returned as-is.",
      inputSchema: {
        url: z.string().url().describe("The http(s) URL to fetch"),
        raw: z.boolean().default(false).describe("Return raw HTML instead of extracted text"),
        maxChars: z.number().int().min(500).max(200_000).default(MAX_FETCH_CHARS),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    safe(async ({ url, raw, maxChars }) => {
      const u = new URL(url);
      if (!["http:", "https:"].includes(u.protocol)) return fail("Only http(s) URLs are supported.");
      const res = await fetch(u, {
        headers: { "user-agent": "LynoAgent/1.0 (+MCP)" },
        signal: AbortSignal.timeout(20_000),
        redirect: "follow",
      });
      const type = res.headers.get("content-type") ?? "";
      let body = await res.text();
      if (!raw && type.includes("html")) body = htmlToText(body);
      const truncated = body.length > maxChars;
      if (truncated) body = body.slice(0, maxChars);
      return text(
        `URL: ${res.url}\nStatus: ${res.status} ${res.statusText}\nContent-Type: ${type}\n\n${body}` +
          (truncated ? `\n\n[…truncated to ${maxChars} characters]` : ""),
      );
    }),
  );
}
