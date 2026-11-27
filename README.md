<p align="center">
  <img src="public/assets/lyno-logo-512.webp" alt="Lyno Agent" width="220" />
</p>

<h1 align="center">Lyno Agent</h1>
<p align="center">MCP (Model Context Protocol) server — the digital operator for your AI.</p>

## Repository layout

| Folder | Contents |
|---|---|
| `server/` | MCP server (TypeScript, `@modelcontextprotocol/sdk`) — stdio & Streamable HTTP |
| `public/` | Static multi-page website (HTML/CSS/JS) with the Lyno theme and logo |

## Tools

| Group | Tools |
|---|---|
| Workspace | `list_directory`, `read_file`, `write_file`, `search_files` (locked to `LYNO_WORKSPACE`) |
| Web | `fetch_url` (HTML → text) |
| Memory | `remember`, `recall`, `forget` (stored in `~/.lyno-agent/memory.json`) |
| Utilities | `calculate` (no `eval`), `get_time`, `hash_text`, `generate_uuid`, `lyno_status` |

Resources: `lyno://about`, `lyno://memory` · Prompts: `lyno-operator`, `lyno-code-review`

## Getting started

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

## Website

The website has a navigation menu across four pages: `index.html` (Home), `tools.html`, `install.html` and `how-it-works.html`. Open `public/index.html` directly in a browser, or serve the `public/` folder from any static host (GitHub Pages, Netlify, Vercel).

## License

MIT

## Deploy to Vercel

The site lives in `public/`, which Vercel serves as-is with no build step (`vercel.json` only enables clean URLs). Import the repository at [vercel.com/new](https://vercel.com/new) and deploy with the default settings; every push to `main` redeploys automatically.
