import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AGENT_NAME, AGENT_TITLE, AGENT_VERSION, READ_ONLY, WORKSPACE } from "./config.js";
import { registerWorkspaceTools } from "./tools/workspace.js";
import { registerWebTools } from "./tools/web.js";
import { loadMemories, registerMemoryTools } from "./tools/memory.js";
import { registerUtilityTools } from "./tools/utility.js";

const INSTRUCTIONS = `You are connected to ${AGENT_TITLE}, a hooded digital operator that works quietly in the background.
Workspace tools (list_directory, read_file, write_file, search_files) are sandboxed to ${WORKSPACE}.
Use fetch_url to read the web, remember/recall/forget for long-term memory, and the utility tools for quick calculations.
${READ_ONLY ? "Lyno is in READ-ONLY mode: write_file, remember and forget are disabled." : ""}`.trim();

export function createLynoServer(): McpServer {
  const server = new McpServer(
    { name: AGENT_NAME, title: AGENT_TITLE, version: AGENT_VERSION },
    { instructions: INSTRUCTIONS },
  );

  registerUtilityTools(server);
  registerWorkspaceTools(server);
  registerWebTools(server);
  registerMemoryTools(server);

  server.registerResource(
    "lyno-about",
    "lyno://about",
    { title: "About Lyno Agent", description: "Who Lyno is and what it can do", mimeType: "text/markdown" },
    async (uri) => ({
      contents: [{
        uri: uri.href,
        mimeType: "text/markdown",
        text: `# ${AGENT_TITLE} v${AGENT_VERSION}\n\n${INSTRUCTIONS}\n`,
      }],
    }),
  );

  server.registerResource(
    "lyno-memory",
    "lyno://memory",
    { title: "Lyno memory", description: "Everything Lyno currently remembers", mimeType: "application/json" },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(await loadMemories(), null, 2) }],
    }),
  );

  server.registerPrompt(
    "lyno-operator",
    {
      title: "Lyno operator mode",
      description: "Have the assistant act as Lyno: plan, use tools, and report concisely.",
      argsSchema: { task: z.string().describe("The mission for Lyno") },
    },
    ({ task }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text:
            `Act as Lyno Agent — calm, precise, efficient. Mission: ${task}\n\n` +
            "1. Recall any relevant memories first.\n" +
            "2. Plan briefly, then use Lyno's tools to gather facts and act.\n" +
            "3. Remember anything worth keeping for next time.\n" +
            "4. Report back with a short summary of what you did and found.",
        },
      }],
    }),
  );

  server.registerPrompt(
    "lyno-code-review",
    {
      title: "Review a file",
      description: "Read a file from the workspace and review it for bugs and improvements.",
      argsSchema: { path: z.string().describe("File path in the workspace") },
    },
    ({ path }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Use read_file to open \`${path}\`, then review it: list real bugs first (with line numbers), then risky patterns, then optional improvements.`,
        },
      }],
    }),
  );

  return server;
}
