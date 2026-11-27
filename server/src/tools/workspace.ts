import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MAX_READ_BYTES, READ_ONLY, WORKSPACE } from "../config.js";
import { fail, json, safe, text } from "../util.js";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", "__pycache__"]);

/** Resolve a user path inside the workspace, refusing anything that escapes it. */
export async function resolveInWorkspace(p: string): Promise<string> {
  const target = path.resolve(WORKSPACE, p);
  const rel = path.relative(WORKSPACE, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Path "${p}" is outside the Lyno workspace (${WORKSPACE}).`);
  }
  // Follow symlinks for existing paths so a link cannot point outside the workspace.
  try {
    const real = await fs.realpath(target);
    const realRoot = await fs.realpath(WORKSPACE);
    const realRel = path.relative(realRoot, real);
    if (realRel.startsWith("..") || path.isAbsolute(realRel)) {
      throw new Error(`Path "${p}" resolves outside the Lyno workspace.`);
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  return target;
}

const display = (abs: string) => path.relative(WORKSPACE, abs) || ".";

export function registerWorkspaceTools(server: McpServer) {
  server.registerTool(
    "list_directory",
    {
      title: "List directory",
      description: "List files and folders inside the Lyno workspace.",
      inputSchema: {
        path: z.string().default(".").describe("Folder relative to the workspace root"),
      },
      annotations: { readOnlyHint: true },
    },
    safe(async ({ path: p }) => {
      const dir = await resolveInWorkspace(p);
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const rows = await Promise.all(
        entries
          .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
          .map(async (e) => {
            if (e.isDirectory()) return `[dir]  ${e.name}/`;
            const st = await fs.stat(path.join(dir, e.name)).catch(() => null);
            return `[file] ${e.name}${st ? `  (${st.size} B)` : ""}`;
          }),
      );
      return text(`${display(dir)}\n${rows.join("\n") || "(empty)"}`);
    }),
  );

  server.registerTool(
    "read_file",
    {
      title: "Read file",
      description: "Read a UTF-8 text file from the Lyno workspace. Optionally read a line range.",
      inputSchema: {
        path: z.string().describe("File path relative to the workspace root"),
        startLine: z.number().int().min(1).optional().describe("First line to return (1-based)"),
        endLine: z.number().int().min(1).optional().describe("Last line to return (inclusive)"),
      },
      annotations: { readOnlyHint: true },
    },
    safe(async ({ path: p, startLine, endLine }) => {
      const file = await resolveInWorkspace(p);
      const st = await fs.stat(file);
      if (!st.isFile()) return fail(`${p} is not a file.`);
      if (st.size > MAX_READ_BYTES && !startLine) {
        return fail(`${p} is ${st.size} bytes; use startLine/endLine to read part of it.`);
      }
      const content = await fs.readFile(file, "utf8");
      if (!startLine && !endLine) return text(content);
      const lines = content.split("\n");
      const from = (startLine ?? 1) - 1;
      const to = Math.min(endLine ?? lines.length, lines.length);
      return text(lines.slice(from, to).map((l, i) => `${from + i + 1}\t${l}`).join("\n"));
    }),
  );

  server.registerTool(
    "write_file",
    {
      title: "Write file",
      description: "Create or overwrite a text file in the Lyno workspace (creates parent folders).",
      inputSchema: {
        path: z.string().describe("File path relative to the workspace root"),
        content: z.string().describe("Full file content"),
        append: z.boolean().default(false).describe("Append instead of overwrite"),
      },
      annotations: { destructiveHint: true },
    },
    safe(async ({ path: p, content, append }) => {
      if (READ_ONLY) return fail("Lyno is running in read-only mode (LYNO_READ_ONLY).");
      const file = await resolveInWorkspace(p);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await (append ? fs.appendFile(file, content, "utf8") : fs.writeFile(file, content, "utf8"));
      return text(`${append ? "Appended" : "Wrote"} ${Buffer.byteLength(content)} bytes to ${display(file)}`);
    }),
  );

  server.registerTool(
    "search_files",
    {
      title: "Search files",
      description:
        "Search the workspace for files whose name matches `nameContains` and/or whose content contains `query`.",
      inputSchema: {
        query: z.string().optional().describe("Text to look for inside files (case-insensitive)"),
        nameContains: z.string().optional().describe("Substring the file name must contain"),
        path: z.string().default(".").describe("Folder to search in"),
        maxResults: z.number().int().min(1).max(500).default(50),
      },
      annotations: { readOnlyHint: true },
    },
    safe(async ({ query, nameContains, path: p, maxResults }) => {
      if (!query && !nameContains) return fail("Provide `query` and/or `nameContains`.");
      const root = await resolveInWorkspace(p);
      const q = query?.toLowerCase();
      const n = nameContains?.toLowerCase();
      const results: { file: string; line?: number; text?: string }[] = [];

      async function walk(dir: string): Promise<void> {
        if (results.length >= maxResults) return;
        const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
        for (const e of entries) {
          if (results.length >= maxResults) return;
          const full = path.join(dir, e.name);
          if (e.isDirectory()) {
            if (!SKIP_DIRS.has(e.name)) await walk(full);
            continue;
          }
          if (!e.isFile()) continue;
          if (n && !e.name.toLowerCase().includes(n)) continue;
          if (!q) {
            results.push({ file: display(full) });
            continue;
          }
          const st = await fs.stat(full);
          if (st.size > MAX_READ_BYTES) continue;
          const content = await fs.readFile(full, "utf8").catch(() => "");
          if (content.includes("\u0000")) continue; // binary
          content.split("\n").forEach((line, i) => {
            if (results.length < maxResults && line.toLowerCase().includes(q)) {
              results.push({ file: display(full), line: i + 1, text: line.trim().slice(0, 200) });
            }
          });
        }
      }

      await walk(root);
      return json({ count: results.length, results });
    }),
  );
}
