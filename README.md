<p align="center">
  <img src="public/assets/lyno-logo-512.webp" alt="Lyno Agent" width="220" />
</p>

<h1 align="center">Lyno Agent</h1>
<p align="center">MCP (Model Context Protocol) server — the digital operator for your AI.</p>

## Repository layout

| Folder | Contents |
|---|---|
| `server/` | MCP server (TypeScript, `@modelcontextprotocol/sdk`) — stdio & Streamable HTTP |
| `api/` | Vercel functions: hosted MCP endpoint (`/mcp`), token-scanner chat agent (`/api/agent`), health check (`/health`) |
| `public/` | Static multi-page website (HTML/CSS/JS) with the Lyno theme and logo |

## Tools

| Group | Tools |
|---|---|
| Workspace | `list_directory`, `read_file`, `write_file`, `search_files` (locked to `LYNO_WORKSPACE`) |
| Web | `fetch_url` (HTML → text) |
| Crypto | `token_info` (token details + risk checks by contract address) |
| Memory | `remember`, `recall`, `forget` (stored in `~/.lyno-agent/memory.json`) |
| Utilities | `calculate` (no `eval`), `get_time`, `hash_text`, `generate_uuid`, `lyno_status` |

Resources: `lyno://about`, `lyno://memory` · Prompts: `lyno-operator`, `lyno-code-review`

## Token scanner agent

Open `/agent` on the site and paste a token **contract address (CA)** — EVM (`0x…`, Ethereum, BNB Chain, Base, Arbitrum, Polygon, …) or Solana (incl. pump.fun). Lyno replies with:

- price and 5m/1h/6h/24h change, market cap, FDV, liquidity, 24h volume and buys/sells, main pool and its age
- holder count and top-10 concentration
- security: buy/sell tax, honeypot, verified source, renounced ownership, mint/freeze authority, proxy, LP locked/burned, RugCheck score
- a risk verdict (low / medium / high) with the red flags behind it, plus website and social links

Data comes from DexScreener, GoPlus and RugCheck (public, no keys). The same lookup is the `token_info` MCP tool, so Claude can scan tokens too. Deep link: `/agent?ca=<address>`.

**Optional AI analysis:** set `ANTHROPIC_API_KEY` in the Vercel project's environment variables (Settings → Environment Variables) and redeploy. Lyno then adds a short "Lyno's take" written by Claude (model `claude-opus-5-5`, override with `LYNO_MODEL`) in the user's language, and can answer follow-up questions. Without a key the agent still returns the full data report. The endpoint has a basic per-instance rate limit (20 messages/minute per IP).

## Hosted endpoint (no install)

The Vercel deployment exposes a live MCP server over Streamable HTTP:

```
https://<your-domain>/mcp
```

- **Claude.ai / Claude Desktop:** Settings → Connectors → Add custom connector → paste the URL.
- **Claude Code:** `claude mcp add --transport http lyno-agent https://<your-domain>/mcp`
- **Try it in the browser:** open `/playground` on the site.

The hosted endpoint is stateless and runs the web, crypto and utility tools only (`token_info`, `fetch_url`, `calculate`, `get_time`, `hash_text`, `generate_uuid`, `lyno_status`). `fetch_url` refuses private and local network addresses there. File and memory tools need your machine, so install locally for those.

## Getting started (local)

```bash
cd server
npm install
npm run build
```

**Claude Desktop** — `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "lyno-agent": {
      "command": "node",
      "args": ["/path/to/LynoAgent/server/dist/index.js"],
      "env": { "LYNO_WORKSPACE": "/path/to/your-project" }
    }
  }
}
```

**Claude Code**:

```bash
claude mcp add lyno-agent -e LYNO_WORKSPACE=$(pwd) -- node /path/to/LynoAgent/server/dist/index.js
```

**HTTP** (endpoint `/mcp`, health check `/health`):

```bash
node server/dist/index.js --http --port 3333
```

Test with the MCP Inspector: `cd server && npm run inspect`

### Environment variables

| Name | Purpose |
|---|---|
| `LYNO_WORKSPACE` | Folder the file tools may access (default: current directory) |
| `LYNO_DATA_DIR` | Where memory is stored (default: `~/.lyno-agent`) |
| `LYNO_READ_ONLY` | `1` disables all write actions |
| `LYNO_MODE` | `hosted` limits the `--http` server to the web and utility tools |

## Website

The website has a navigation menu across these pages: `index.html` (Home), `agent.html` (token scanner chat), `tools.html`, `install.html`, `how-it-works.html` and `playground.html` (live tool runner). Open `public/index.html` directly in a browser, or serve the `public/` folder from any static host (GitHub Pages, Netlify, Vercel).

## License

MIT

## Deploy to Vercel

The site lives in `public/` and is served as static files; `api/` holds the MCP endpoint functions. `vercel.json` pins the project to static + functions (so Vercel's Node preset is ignored) and maps `/mcp` and `/health` to the functions. Import the repository at [vercel.com/new](https://vercel.com/new) and deploy with the default settings; every push to `main` redeploys automatically.
