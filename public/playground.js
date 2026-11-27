// Lyno Agent playground: talks to the real MCP endpoint over Streamable HTTP (JSON-RPC 2.0).
(() => {
  const ENDPOINT = `${location.origin}/mcp`; // same-origin calls (works on previews too)
  const PUBLIC_ENDPOINT = `${typeof SITE !== "undefined" ? SITE.domain : "https://lynoagent.com"}/mcp`; // what users copy
  const isFile = location.protocol === "file:";
  const $ = (id) => document.getElementById(id);
  let rpcId = 0;
  let tools = [];
  let current = null;

  // Fill every endpoint placeholder with the real URL.
  $("endpointUrl").textContent = PUBLIC_ENDPOINT;
  document.querySelectorAll("[data-endpoint]").forEach((el) => { el.textContent = PUBLIC_ENDPOINT; });
  $("copyEndpoint").addEventListener("click", async (e) => {
    try { await navigator.clipboard.writeText(PUBLIC_ENDPOINT); e.target.textContent = "Copied ✓"; }
    catch { e.target.textContent = "Failed"; }
    setTimeout(() => (e.target.textContent = "Copy URL"), 1500);
  });

  async function rpc(method, params) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": "2025-06-18",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
    });
    const type = res.headers.get("content-type") || "";
    let data;
    if (type.includes("text/event-stream")) {
      const line = (await res.text()).split("\n").find((l) => l.startsWith("data:"));
      data = line ? JSON.parse(line.slice(5)) : null;
    } else {
      data = await res.json();
    }
    if (!data) throw new Error(`Empty response (HTTP ${res.status})`);
    if (data.error) throw new Error(data.error.message || "Unknown MCP error");
    return data.result;
  }

  function setStatus(ok, text) {
    $("statusDot").className = `status-dot ${ok ? "ok" : "bad"}`;
    $("statusText").textContent = text;
  }

  // ---------- form generation from JSON Schema ----------
  function fieldFor(name, schema, required) {
    const wrap = document.createElement("label");
    wrap.className = "field";
    const title = document.createElement("span");
    title.className = "field-label";
    title.innerHTML = `<code>${name}</code>${required ? ' <em>required</em>' : ""}`;
    wrap.appendChild(title);

    let input;
    if (schema.enum) {
      input = document.createElement("select");
      schema.enum.forEach((v) => input.add(new Option(v, v)));
      if (schema.default !== undefined) input.value = schema.default;
    } else if (schema.type === "boolean") {
      input = document.createElement("input");
      input.type = "checkbox";
      input.checked = schema.default === true;
      wrap.classList.add("check");
    } else if (schema.type === "number" || schema.type === "integer") {
      input = document.createElement("input");
      input.type = "number";
      if (schema.type === "integer") input.step = "1";
      if (schema.minimum !== undefined) input.min = schema.minimum;
      if (schema.maximum !== undefined) input.max = schema.maximum;
      if (schema.default !== undefined) input.value = schema.default;
    } else if (schema.type === "array") {
      input = document.createElement("input");
      input.placeholder = "comma, separated, values";
    } else {
      input = document.createElement("input");
      input.type = schema.format === "uri" ? "url" : "text";
      if (schema.default !== undefined) input.value = schema.default;
    }
    input.name = name;
    input.dataset.kind = schema.enum ? "enum" : schema.type || "string";
    if (required && input.type !== "checkbox") input.required = true;
    wrap.appendChild(input);

    if (schema.description) {
      const d = document.createElement("small");
      d.textContent = schema.description;
      wrap.appendChild(d);
    }
    return wrap;
  }

  const EXAMPLES = {
    calculate: { expression: "2^10 / (3 + sqrt(16))" },
    get_time: { timeZone: "Asia/Jakarta" },
    hash_text: { input: "Lyno Agent" },
    fetch_url: { url: "https://example.com" },
  };

  function selectTool(name) {
    current = tools.find((t) => t.name === name);
    document.querySelectorAll(".pg-tool").forEach((b) => b.classList.toggle("active", b.dataset.name === name));
    $("toolName").textContent = current.title || current.name;
    $("toolDesc").textContent = current.description || "";
    const fields = $("toolFields");
    fields.innerHTML = "";
    const props = current.inputSchema?.properties || {};
    const req = current.inputSchema?.required || [];
    const names = Object.keys(props);
    if (names.length === 0) fields.innerHTML = '<p class="muted">This tool takes no input.</p>';
    names.forEach((n) => fields.appendChild(fieldFor(n, props[n], req.includes(n))));
    Object.entries(EXAMPLES[name] || {}).forEach(([k, v]) => {
      const el = fields.querySelector(`[name="${k}"]`);
      if (el && !el.value) el.value = v;
    });
    $("runBtn").disabled = false;
  }

  function collectArgs() {
    const args = {};
    $("toolFields").querySelectorAll("[name]").forEach((el) => {
      const kind = el.dataset.kind;
      if (kind === "boolean") { args[el.name] = el.checked; return; }
      if (el.value === "") return;
      if (kind === "number" || kind === "integer") args[el.name] = Number(el.value);
      else if (kind === "array") args[el.name] = el.value.split(",").map((s) => s.trim()).filter(Boolean);
      else args[el.name] = el.value;
    });
    return args;
  }

  $("toolForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!current) return;
    const out = $("output");
    const args = collectArgs();
    out.className = "";
    out.textContent = `→ tools/call ${current.name} ${JSON.stringify(args)}\n\nRunning…`;
    $("runBtn").disabled = true;
    const t0 = performance.now();
    try {
      const result = await rpc("tools/call", { name: current.name, arguments: args });
      const text = (result.content || []).map((c) => (c.type === "text" ? c.text : JSON.stringify(c))).join("\n");
      out.className = result.isError ? "err" : "";
      out.textContent = text || JSON.stringify(result, null, 2);
    } catch (err) {
      out.className = "err";
      out.textContent = `Request failed: ${err.message}`;
    } finally {
      $("timing").textContent = `${Math.round(performance.now() - t0)} ms`;
      $("runBtn").disabled = false;
    }
  });

  async function init() {
    if (isFile) {
      setStatus(false, "Offline preview — open the deployed site to use the live endpoint");
      $("toolList").innerHTML = '<p class="muted">Tools load from the live endpoint.</p>';
      return;
    }
    const t0 = performance.now();
    try {
      const result = await rpc("tools/list", {});
      tools = result.tools || [];
      setStatus(true, `Online · ${tools.length} tools · ${Math.round(performance.now() - t0)} ms`);
      const list = $("toolList");
      list.innerHTML = "";
      tools.forEach((t) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "pg-tool";
        b.dataset.name = t.name;
        b.innerHTML = `<code>${t.name}</code><span>${t.title || ""}</span>`;
        b.addEventListener("click", () => selectTool(t.name));
        list.appendChild(b);
      });
      if (tools.length) selectTool(tools.find((t) => t.name === "calculate") ? "calculate" : tools[0].name);
    } catch (err) {
      setStatus(false, `Endpoint unreachable: ${err.message}`);
      $("toolList").innerHTML = '<p class="muted">Could not load tools.</p>';
    }
  }
  init();
})();
