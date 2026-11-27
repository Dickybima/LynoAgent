<p align="center">
  <img src="website/assets/lyno-logo-512.webp" alt="Lyno Agent" width="220" />
</p>

<h1 align="center">Lyno Agent</h1>
<p align="center">MCP (Model Context Protocol) server — operator digital untuk AI Anda.</p>

## Isi repo

| Folder | Isi |
|---|---|
| `server/` | MCP server (TypeScript, `@modelcontextprotocol/sdk`) — stdio & Streamable HTTP |
| `website/` | Landing page statis (HTML/CSS/JS) dengan tema & logo Lyno |

## Tools

| Grup | Tools |
|---|---|
| Workspace | `list_directory`, `read_file`, `write_file`, `search_files` (terkunci di `LYNO_WORKSPACE`) |
| Web | `fetch_url` (HTML → teks) |
| Memori | `remember`, `recall`, `forget` (disimpan di `~/.lyno-agent/memory.json`) |
| Utilitas | `calculate` (tanpa `eval`), `get_time`, `hash_text`, `generate_uuid`, `lyno_status` |

Resources: `lyno://about`, `lyno://memory` · Prompts: `lyno-operator`, `lyno-code-review`

## Menjalankan

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
      "args": ["/path/ke/LynoAgent/server/dist/index.js"],
      "env": { "LYNO_WORKSPACE": "/path/ke/project-anda" }
    }
  }
}
```

**Claude Code**:

```bash
claude mcp add lyno-agent -e LYNO_WORKSPACE=$(pwd) -- node /path/ke/LynoAgent/server/dist/index.js
```

**HTTP** (endpoint `/mcp`, health check `/health`):

```bash
node server/dist/index.js --http --port 3333
```

Uji dengan MCP Inspector: `cd server && npm run inspect`

### Variabel lingkungan

| Nama | Fungsi |
|---|---|
| `LYNO_WORKSPACE` | Folder yang boleh diakses tool file (default: folder saat ini) |
| `LYNO_DATA_DIR` | Lokasi memori (default: `~/.lyno-agent`) |
| `LYNO_READ_ONLY` | `1` = matikan semua aksi tulis |

## Website

Website terdiri dari beberapa halaman dengan menu navigasi: `index.html` (Beranda), `tools.html`, `instalasi.html`, dan `cara-kerja.html`. Buka `website/index.html` langsung di browser, atau sajikan folder `website/` lewat hosting statis apa pun (GitHub Pages, Netlify, Vercel).

## Lisensi

MIT
