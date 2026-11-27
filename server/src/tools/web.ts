import dns from "node:dns/promises";
import net from "node:net";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MAX_FETCH_CHARS } from "../config.js";
import { fail, safe, text } from "../util.js";

export interface WebToolOptions {
  /** Refuse URLs that resolve to loopback/private/link-local addresses (use when hosted publicly). */
  blockPrivateNetwork?: boolean;
  timeoutMs?: number;
}

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

export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
      (a === 169 && b === 254) ||            // link-local / cloud metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224                               // multicast / reserved
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

async function assertPublicHost(u: URL) {
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const addrs = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true })).map((a) => a.address);
  if (addrs.length === 0 || addrs.some(isPrivateAddress)) {
    throw new Error(`Refusing to fetch ${u.hostname}: it resolves to a private or local network address.`);
  }
}

export function registerWebTools(server: McpServer, opts: WebToolOptions = {}) {
  const timeoutMs = opts.timeoutMs ?? 20_000;

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
      let u = new URL(url);
      const signal = AbortSignal.timeout(timeoutMs);
      let res: Response | undefined;

      // Follow redirects manually so every hop is checked against the private-network guard.
      for (let hop = 0; hop <= 5; hop++) {
        if (!["http:", "https:"].includes(u.protocol)) return fail("Only http(s) URLs are supported.");
        if (opts.blockPrivateNetwork) await assertPublicHost(u);
        res = await fetch(u, { headers: { "user-agent": "LynoAgent/1.0 (+https://lynoagent.com)" }, signal, redirect: "manual" });
        const location = res.headers.get("location");
        if (res.status >= 300 && res.status < 400 && location) {
          u = new URL(location, u);
          continue;
        }
        break;
      }
      if (!res || (res.status >= 300 && res.status < 400)) return fail("Too many redirects.");

      const type = res.headers.get("content-type") ?? "";
      let body = await res.text();
      if (!raw && type.includes("html")) body = htmlToText(body);
      const truncated = body.length > maxChars;
      if (truncated) body = body.slice(0, maxChars);
      return text(
        `URL: ${u.href}\nStatus: ${res.status} ${res.statusText}\nContent-Type: ${type}\n\n${body}` +
          (truncated ? `\n\n[…truncated to ${maxChars} characters]` : ""),
      );
    }),
  );
}
