import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function text(value: string): CallToolResult {
  return { content: [{ type: "text", text: value }] };
}

export function json(value: unknown): CallToolResult {
  return text(JSON.stringify(value, null, 2));
}

export function fail(message: string): CallToolResult {
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

/** Wrap a tool handler so thrown errors become MCP tool errors instead of crashes. */
export function safe<A>(fn: (args: A) => Promise<CallToolResult> | CallToolResult) {
  return async (args: A): Promise<CallToolResult> => {
    try {
      return await fn(args);
    } catch (err) {
      return fail(err instanceof Error ? err.message : String(err));
    }
  };
}
