// Lyno Agent chat: posts messages to /api/agent and renders the markdown reply.
(() => {
  const log = document.getElementById("chatLog");
  const form = document.getElementById("chatForm");
  const input = document.getElementById("chatText");
  const sendBtn = document.getElementById("sendBtn");
  const history = [];

  const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  // Small, safe markdown renderer: escape first, then add a limited set of formatting.
  function inline(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, '<code class="ca">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
      .replace(/(^|[^*])_([^_]+)_(?=$|[^\w])/g, "$1<i>$2</i>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, t, u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`);
  }
  function markdown(md) {
    const out = [];
    let list = false;
    for (const raw of md.split("\n")) {
      const line = raw.trimEnd();
      const li = line.match(/^\s*[-•]\s+(.*)$/);
      if (li) {
        if (!list) { out.push("<ul>"); list = true; }
        out.push(`<li>${inline(li[1])}</li>`);
        continue;
      }
      if (list) { out.push("</ul>"); list = false; }
      if (/^---+$/.test(line)) out.push("<hr />");
      else if (line.startsWith("### ")) out.push(`<h4>${inline(line.slice(4))}</h4>`);
      else if (line.startsWith("## ")) out.push(`<h3>${inline(line.slice(3))}</h3>`);
      else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
    }
    if (list) out.push("</ul>");
    return out.join("");
  }

  function addMessage(role, html, extra = "") {
    const wrap = document.createElement("div");
    wrap.className = `msg ${role} ${extra}`.trim();
    if (role === "bot") {
      wrap.innerHTML = `<img class="avatar" src="assets/favicon-64.png" alt="" width="32" height="32" /><div class="bubble">${html}</div>`;
    } else {
      wrap.innerHTML = `<div class="bubble">${html}</div>`;
    }
    log.appendChild(wrap);
    log.scrollTop = log.scrollHeight;
    return wrap;
  }

  function tokenHeader(tokens) {
    return tokens
      .filter((t) => t.found)
      .map((t) => {
        const verdict = { low: "LOW RISK", medium: "MEDIUM RISK", high: "HIGH RISK", unknown: "UNRATED" }[t.verdict];
        const img = t.imageUrl ? `<img src="${esc(t.imageUrl)}" alt="" width="40" height="40" loading="lazy" onerror="this.remove()" />` : "";
        return `<div class="token-head">${img}<div><b>${esc(t.name || "Unknown")}</b> <span class="muted">$${esc(t.symbol || "?")} · ${esc(t.chainName || t.chain || "")}</span></div><span class="verdict ${t.verdict}">${verdict}</span></div>`;
      })
      .join("");
  }

  async function send(text) {
    const message = text.trim();
    if (!message) return;
    addMessage("user", esc(message).replace(/\n/g, "<br />"));
    input.value = "";
    autosize();
    sendBtn.disabled = true;
    const typing = addMessage("bot", '<span class="typing"><i></i><i></i><i></i></span> <span class="muted">Scanning…</span>', "pending");

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, history: history.slice(-8) }),
      });
      const data = await res.json().catch(() => ({}));
      typing.remove();
      if (!res.ok) {
        addMessage("bot", `<p class="err">${esc(data.error || `Request failed (HTTP ${res.status}).`)}</p>`);
        return;
      }
      const tokens = data.tokens || [];
      // The token card already shows the name, so drop the report's "## Name" title lines.
      const body = tokens.some((t) => t.found) ? (data.reply || "").replace(/^## .*$/gm, "") : data.reply || "";
      const html =
        tokenHeader(tokens) +
        markdown(body) +
        (data.aiError ? `<p class="muted small">${esc(data.aiError)}</p>` : "");
      addMessage("bot", html);
      history.push({ role: "user", content: message }, { role: "assistant", content: data.reply || "" });
    } catch (err) {
      typing.remove();
      addMessage("bot", `<p class="err">Could not reach Lyno Agent: ${esc(err.message)}</p>`);
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  }

  function autosize() {
    if (!input.value) { input.style.height = ""; return; }
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
  }

  form.addEventListener("submit", (e) => { e.preventDefault(); send(input.value); });
  input.addEventListener("input", autosize);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input.value); }
  });
  log.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (chip) send(chip.dataset.ca);
  });
  // Allow deep links like /agent?ca=<address>
  const ca = new URLSearchParams(location.search).get("ca");
  if (ca) send(ca);
})();
