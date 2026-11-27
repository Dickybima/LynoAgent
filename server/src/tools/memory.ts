import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DATA_DIR, READ_ONLY } from "../config.js";
import { fail, json, safe, text } from "../util.js";

export interface Memory {
  id: string;
  content: string;
  tags: string[];
  createdAt: string;
}

const FILE = path.join(DATA_DIR, "memory.json");

export async function loadMemories(): Promise<Memory[]> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as Memory[];
  } catch {
    return [];
  }
}

async function saveMemories(items: Memory[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(items, null, 2), "utf8");
  await fs.rename(tmp, FILE);
}

export function registerMemoryTools(server: McpServer) {
  server.registerTool(
    "remember",
    {
      title: "Remember",
      description: "Store a note in Lyno's long-term memory so it can be recalled in later conversations.",
      inputSchema: {
        content: z.string().min(1).describe("What to remember"),
        tags: z.array(z.string()).default([]).describe("Optional tags for grouping"),
      },
    },
    safe(async ({ content, tags }) => {
      if (READ_ONLY) return fail("Lyno is running in read-only mode (LYNO_READ_ONLY).");
      const items = await loadMemories();
      const item: Memory = {
        id: randomUUID().slice(0, 8),
        content,
        tags: tags.map((t) => t.toLowerCase()),
        createdAt: new Date().toISOString(),
      };
      items.push(item);
      await saveMemories(items);
      return text(`Remembered [${item.id}]: ${content}`);
    }),
  );

  server.registerTool(
    "recall",
    {
      title: "Recall",
      description: "Search Lyno's memory by keyword and/or tag. With no filters, returns the most recent memories.",
      inputSchema: {
        query: z.string().optional().describe("Keywords to search for"),
        tag: z.string().optional().describe("Only return memories with this tag"),
        limit: z.number().int().min(1).max(200).default(20),
      },
      annotations: { readOnlyHint: true },
    },
    safe(async ({ query, tag, limit }) => {
      let items = await loadMemories();
      if (tag) items = items.filter((m) => m.tags.includes(tag.toLowerCase()));
      if (query) {
        const words = query.toLowerCase().split(/\s+/).filter(Boolean);
        items = items
          .map((m) => ({ m, score: words.filter((w) => m.content.toLowerCase().includes(w)).length }))
          .filter((x) => x.score > 0)
          .sort((a, b) => b.score - a.score)
          .map((x) => x.m);
      } else {
        items = items.slice().reverse();
      }
      return json(items.slice(0, limit));
    }),
  );

  server.registerTool(
    "forget",
    {
      title: "Forget",
      description: "Delete a memory by its id.",
      inputSchema: { id: z.string().describe("Memory id returned by remember/recall") },
      annotations: { destructiveHint: true },
    },
    safe(async ({ id }) => {
      if (READ_ONLY) return fail("Lyno is running in read-only mode (LYNO_READ_ONLY).");
      const items = await loadMemories();
      const next = items.filter((m) => m.id !== id);
      if (next.length === items.length) return fail(`No memory with id ${id}.`);
      await saveMemories(next);
      return text(`Forgot memory ${id}.`);
    }),
  );
}
