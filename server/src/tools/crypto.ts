import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { detectAddresses, formatReport, lookupToken } from "../crypto/token.js";
import { fail, safe, text } from "../util.js";

export function registerCryptoTools(server: McpServer) {
  server.registerTool(
    "token_info",
    {
      title: "Token info by CA",
      description:
        "Look up a crypto token by contract address (EVM 0x… or Solana mint, incl. pump.fun). Returns price, market cap, " +
        "liquidity, volume, holders, taxes, honeypot / mint / freeze checks, LP lock and a risk verdict. " +
        "Accepts a bare address or any text containing one (up to 3 addresses).",
      inputSchema: {
        address: z.string().min(32).describe("Contract address, or text that contains one or more addresses"),
        format: z.enum(["text", "json"]).default("text").describe("Readable report or raw JSON"),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    safe(async ({ address, format }) => {
      const found = detectAddresses(address).slice(0, 3);
      if (!found.length) return fail("No EVM (0x…) or Solana contract address found in the input.");
      const reports = await Promise.all(found.map((a) => lookupToken(a.address)));
      if (format === "json") return text(JSON.stringify(reports.length === 1 ? reports[0] : reports, null, 2));
      return text(reports.map(formatReport).join("\n\n---\n\n"));
    }),
  );
}
