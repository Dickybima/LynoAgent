#!/usr/bin/env node
import http from "node:http";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { AGENT_TITLE, AGENT_VERSION, WORKSPACE } from "./config.js";
import { createLynoServer } from "./server.js";
import { handleMcpRequest, healthPayload } from "./http.js";

const args = process.argv.slice(2);
const log = (msg: string) => console.error(`[lyno] ${msg}`); // stdout is reserved for MCP on stdio

async function runStdio() {
  const server = createLynoServer();
  await server.connect(new StdioServerTransport());
  log(`${AGENT_TITLE} v${AGENT_VERSION} online (stdio) — workspace: ${WORKSPACE}`);
}

async function runHttp(port: number, host: string) {
  const mode = process.env.LYNO_MODE === "hosted" ? "hosted" : "local";
  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    if (url.pathname === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(healthPayload(mode)));
      return;
    }
    if (url.pathname !== "/mcp") {
      res.writeHead(404).end("Not found. MCP endpoint is /mcp");
      return;
    }
    await handleMcpRequest(req, res, { mode });
  });

  httpServer.listen(port, host, () => {
    log(`${AGENT_TITLE} v${AGENT_VERSION} online (${mode}) — http://${host}:${port}/mcp`);
  });
}

function argValue(name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

if (args.includes("--help") || args.includes("-h")) {
  console.error(`${AGENT_TITLE} v${AGENT_VERSION}

Usage: lyno-agent [--http] [--port 3333] [--host 127.0.0.1]

  (default)   run over stdio, for Claude Desktop / Claude Code / any MCP client
  --http      run a Streamable HTTP endpoint at /mcp

Environment:
  LYNO_WORKSPACE   folder the file tools may access (default: current dir)
  LYNO_DATA_DIR    where memory is stored (default: ~/.lyno-agent)
  LYNO_READ_ONLY   set to 1 to disable all writes
  LYNO_MODE        set to "hosted" for a public endpoint (web + utility tools only)`);
  process.exit(0);
}

const main = args.includes("--http")
  ? runHttp(Number(argValue("--port") ?? process.env.PORT ?? 3333), argValue("--host") ?? "127.0.0.1")
  : runStdio();

main.catch((err) => {
  log(`fatal: ${err instanceof Error ? err.stack : err}`);
  process.exit(1);
});
