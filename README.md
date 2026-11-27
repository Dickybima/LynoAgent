<p align="center">
  <img src="public/assets/lyno-logo-512.webp" alt="Lyno Agent" width="220" />
</p>

<h1 align="center">Lyno Agent</h1>
<p align="center"><b>Every token leaves a trail. Lyno reads it.</b><br/>The on-chain operator for Elysium — and an MCP server that gives Claude the same eyes.</p>

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

## Token scanner agent (Elysium first)

Lyno is built for **Elysium**, Kinetiq's Hyperliquid L2 (chain id `99901`, gas token HYPE, RPC `https://rpc.elysium.kinetiq.xyz`, explorer `https://elysium.kinetiq.xyz/explorer`). Every `0x…` address is checked on Elysium first; other chains are only used when the token is not on Elysium.

For Elysium tokens Lyno reads the chain directly (Elysium explorer API + RPC) and DexScreener's `elysium` market data:

- holders split into **wallets vs liquidity** (tokens in the Uniswap v4 PoolManager are not counted as a whale), burned supply and the deployer's share
- deployer and **launchpad factory**, deploy time, whether the token is a minimal-proxy clone and whether its implementation is verified
- `owner()` status (no owner / renounced / owned), proxy, and owner powers found in verified source (mint, blacklist, fee changes, pause)
- honeypot/tax simulation is not available on Elysium yet, so the report says to test with a small sell

Open `/agent` on the site and paste a token **contract address (CA)**: Elysium first, then other EVM chains (Ethereum, BNB Chain, Base, Arbitrum, Polygon, …) or Solana (incl. pump.fun). Lyno replies with:

- price and 5m/1h/6h/24h change, market cap, FDV, liquidity, 24h volume and buys/sells, main pool and its age
- holder count and top-10 concentration
- security: buy/sell tax, honeypot, verified source, renounced ownership, mint/freeze authority, proxy, LP locked/burned, RugCheck score
- a risk verdict (low / medium / high) with the red flags behind it, plus website and social links

Data comes from the Elysium explorer and RPC, DexScreener, GoPlus and RugCheck (all public, no keys). `ELYSIUM_RPC_URL` and `ELYSIUM_EXPLORER_API` override the Elysium endpoints. The same lookup is the `token_info` MCP tool, so Claude can scan tokens too. Deep link: `https://www.lynoagent.com/agent?ca=<address>`.

**Optional AI analysis:** set `ANTHROPIC_API_KEY` in the Vercel project's environment variables (Settings → Environment Variables) and redeploy. Lyno then adds a short "Lyno's take" written by Claude (model `claude-opus-5-5`, override with `LYNO_MODEL`) in the user's language, and can answer follow-up questions. Without a key the agent still returns the full data report. The endpoint has a basic per-instance rate limit (20 messages/minute per IP).

## Hosted endpoint (no install)

Live at **[www.lynoagent.com](https://www.lynoagent.com)**. The deployment exposes a live MCP server over Streamable HTTP:

```
https://www.lynoagent.com/mcp
```

- **Claude.ai / Claude Desktop:** Settings → Connectors → Add custom connector → paste the URL.
- **Claude Code:** `claude mcp add --transport http lyno-agent https://www.lynoagent.com/mcp`
- **Try it in the browser:** [www.lynoagent.com/playground](https://www.lynoagent.com/playground)
- **Scan a token:** [www.lynoagent.com/agent](https://www.lynoagent.com/agent)

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
