<p align="center">
  <img src="public/assets/lyno-logo-512.webp" alt="Lyno Agent" width="220" />
</p>

<h1 align="center">Lyno Agent</h1>
<p align="center">MCP (Model Context Protocol) server — the digital operator for your AI.</p>

## Repository layout

| Folder | Contents |
|---|---|
| `server/` | MCP server (TypeScript, `@modelcontextprotocol/sdk`) — stdio & Streamable HTTP |
| `api/` | Vercel functions: the hosted MCP endpoint (`/mcp`) and health check (`/health`) |
| `public/` | Static multi-page website (HTML/CSS/JS) with the Lyno theme and logo |

## Tools

| Group | Tools |
|---|---|
| Workspace | `list_directory`, `read_file`, `write_file`, `search_files` (locked to `LYNO_WORKSPACE`) |
| Web | `fetch_url` (HTML → text) |
| Memory | `remember`, `recall`, `forget` (stored in `~/.lyno-agent/memory.json`) |
| Utilities | `calculate` (no `eval`), `get_time`, `hash_text`, `generate_uuid`, `lyno_status` |

Resources: `lyno://about`, `lyno://memory` · Prompts: `lyno-operator`, `lyno-code-review`

## Hosted endpoint (no install)

The Vercel deployment exposes a live MCP server over Streamable HTTP:

```
https://<your-domain>/mcp
```

- **Claude.ai / Claude Desktop:** Settings → Connectors → Add custom connector → paste the URL.
- **Claude Code:** `claude mcp add --transport http lyno-agent https://<your-domain>/mcp`
- **Try it in the browser:** open `/playground` on the site.

The hosted endpoint is stateless and runs the web and utility tools only (`fetch_url`, `calculate`, `get_time`, `hash_text`, `generate_uuid`, `lyno_status`). `fetch_url` refuses private and local network addresses there. File and memory tools need your machine, so install locally for those.

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

The website has a navigation menu across four pages: `index.html` (Home), `tools.html`, `install.html`, `how-it-works.html` and `playground.html` (live tool runner). Open `public/index.html` directly in a browser, or serve the `public/` folder from any static host (GitHub Pages, Netlify, Vercel).

## License

MIT

## Deploy to Vercel

The site lives in `public/` and is served as static files; `api/` holds the MCP endpoint functions. `vercel.json` pins the project to static + functions (so Vercel's Node preset is ignored) and maps `/mcp` and `/health` to the functions. Import the repository at [vercel.com/new](https://vercel.com/new) and deploy with the default settings; every push to `main` redeploys automatically.
