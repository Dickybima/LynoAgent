import os from "node:os";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AGENT_TITLE, AGENT_VERSION, READ_ONLY, WORKSPACE } from "../config.js";
import { json, safe, text } from "../util.js";

/**
 * Safe arithmetic evaluator (no eval). Supports + - * / % ^, parentheses,
 * unary minus, constants (pi, e) and common Math functions.
 */
export function calculate(expr: string): number {
  const fns: Record<string, (...a: number[]) => number> = {
    sqrt: Math.sqrt, abs: Math.abs, sin: Math.sin, cos: Math.cos, tan: Math.tan,
    log: Math.log10, ln: Math.log, exp: Math.exp, floor: Math.floor, ceil: Math.ceil,
    round: Math.round, min: Math.min, max: Math.max, pow: Math.pow,
  };
  const consts: Record<string, number> = { pi: Math.PI, e: Math.E };
  const tokens = expr.match(/\d+(?:\.\d+)?(?:e[+-]?\d+)?|[a-z_]+|[-+*/%^(),]/gi);
  if (!tokens || tokens.join("") !== expr.replace(/\s+/g, "")) throw new Error("Invalid characters in expression.");
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];
  const expect = (t: string) => {
    if (next() !== t) throw new Error(`Expected "${t}".`);
  };

  const parseExpr = (): number => {
    let v = parseTerm();
    while (peek() === "+" || peek() === "-") v = next() === "+" ? v + parseTerm() : v - parseTerm();
    return v;
  };
  const parseTerm = (): number => {
    let v = parseFactor();
    while (["*", "/", "%"].includes(peek())) {
      const op = next();
      const r = parseFactor();
      v = op === "*" ? v * r : op === "/" ? v / r : v % r;
    }
    return v;
  };
  const parseFactor = (): number => {
    if (peek() === "-") { next(); return -parseFactor(); }
    if (peek() === "+") { next(); return parseFactor(); }
    const base = parsePrimary();
    if (peek() === "^") { next(); return Math.pow(base, parseFactor()); }
    return base;
  };
  const parsePrimary = (): number => {
    const t = next();
    if (t === undefined) throw new Error("Unexpected end of expression.");
    if (t === "(") { const v = parseExpr(); expect(")"); return v; }
    if (/^\d/.test(t)) return parseFloat(t);
    const name = t.toLowerCase();
    if (name in consts) return consts[name];
    if (name in fns) {
      expect("(");
      const args = [parseExpr()];
      while (peek() === ",") { next(); args.push(parseExpr()); }
      expect(")");
      return fns[name](...args);
    }
    throw new Error(`Unknown token "${t}".`);
  };

  const result = parseExpr();
  if (i < tokens.length) throw new Error(`Unexpected "${tokens[i]}".`);
  return result;
}

export function registerUtilityTools(server: McpServer) {
  server.registerTool(
    "lyno_status",
    {
      title: "Lyno status",
      description: "Show Lyno Agent's version, workspace, mode and host information.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    safe(() =>
      json({
        agent: AGENT_TITLE,
        version: AGENT_VERSION,
        workspace: WORKSPACE,
        readOnly: READ_ONLY,
        host: { platform: os.platform(), arch: os.arch(), node: process.version, cpus: os.cpus().length },
        uptimeSeconds: Math.round(process.uptime()),
      }),
    ),
  );

  server.registerTool(
    "calculate",
    {
      title: "Calculate",
      description: "Evaluate a math expression safely, e.g. `2^10 / (3 + sqrt(16))` or `round(pi * 4^2)`.",
      inputSchema: { expression: z.string().describe("Arithmetic expression") },
      annotations: { readOnlyHint: true },
    },
    safe(({ expression }) => text(`${expression} = ${calculate(expression)}`)),
  );

  server.registerTool(
    "get_time",
    {
      title: "Get time",
      description: "Get the current date and time, optionally in a specific IANA time zone (e.g. Asia/Jakarta).",
      inputSchema: { timeZone: z.string().optional().describe("IANA time zone name") },
      annotations: { readOnlyHint: true },
    },
    safe(({ timeZone }) => {
      const now = new Date();
      const tz = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
      const local = new Intl.DateTimeFormat("en-GB", {
        timeZone: tz, dateStyle: "full", timeStyle: "long",
      }).format(now);
      return json({ timeZone: tz, local, iso: now.toISOString(), unix: Math.floor(now.getTime() / 1000) });
    }),
  );

  server.registerTool(
    "hash_text",
    {
      title: "Hash text",
      description: "Compute a hash (md5, sha1, sha256, sha512) of a string.",
      inputSchema: {
        input: z.string(),
        algorithm: z.enum(["md5", "sha1", "sha256", "sha512"]).default("sha256"),
      },
      annotations: { readOnlyHint: true },
    },
    safe(({ input, algorithm }) => text(createHash(algorithm).update(input).digest("hex"))),
  );

  server.registerTool(
    "generate_uuid",
    {
      title: "Generate UUID",
      description: "Generate one or more random v4 UUIDs.",
      inputSchema: { count: z.number().int().min(1).max(100).default(1) },
      annotations: { readOnlyHint: true },
    },
    safe(({ count }) => text(Array.from({ length: count }, () => randomUUID()).join("\n"))),
  );
}
