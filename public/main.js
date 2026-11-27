// Mobile menu
const toggle = document.querySelector(".menu-toggle");
const menu = document.getElementById("menu");
if (toggle && menu) {
  toggle.addEventListener("click", () => {
    const open = menu.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });
}

// Copy buttons
document.querySelectorAll(".copy").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const code = btn.parentElement.querySelector("code").innerText;
    try {
      await navigator.clipboard.writeText(code);
      btn.textContent = "Copied ✓";
    } catch {
      btn.textContent = "Failed";
    }
    setTimeout(() => (btn.textContent = "Copy"), 1500);
  });
});

// Tabs
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const name = tab.dataset.tab;
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === tab));
    document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.dataset.panel === name));
  });
});

// Falling dot-matrix background (cyan / green / blue, like the logo)
(() => {
  const canvas = document.getElementById("matrix");
  const ctx = canvas.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const colors = ["#22e5ff", "#19e6a0", "#3d6bff", "#7a5cff"];
  const gap = 18;
  let cols = [], w = 0, h = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Array.from({ length: Math.ceil(w / gap) }, () => ({
      y: Math.random() * h,
      speed: 0.4 + Math.random() * 1.4,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
  }

  function frame() {
    ctx.fillStyle = "rgba(2, 6, 10, 0.12)";
    ctx.fillRect(0, 0, w, h);
    cols.forEach((c, i) => {
      if (Math.random() > 0.5) return;
      ctx.fillStyle = c.color;
      ctx.globalAlpha = 0.35 + Math.random() * 0.5;
      ctx.fillRect(i * gap + gap / 2, c.y, 2, 2);
      c.y += gap * c.speed * 0.5;
      if (c.y > h && Math.random() > 0.97) c.y = 0;
    });
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener("resize", resize);
  if (!reduce) frame();
})();

// Live status badge on the home page
(() => {
  const badge = document.getElementById("liveBadge");
  if (!badge || location.protocol === "file:") return;
  fetch("/health", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then(() => { badge.textContent = "LIVE"; })
    .catch(() => { badge.textContent = "OFFLINE"; });
})();

// Rich footer: endpoint URL, configurable contact + token rows, copy buttons
(() => {
  const f = document.getElementById("siteFooter");
  if (!f) return;
  const $ = (id) => document.getElementById(id);
  const live = location.protocol !== "file:";
  $("sfEndpoint").textContent = live ? `${location.origin}/mcp` : "https://<your-domain>/mcp";
  $("sfYear").textContent = String(new Date().getFullYear());

  const x = (f.dataset.x || "").replace(/^@/, "").trim();
  if (x) Object.assign($("sfX"), { hidden: false, href: `https://x.com/${encodeURIComponent(x)}`, textContent: `@${x} on X` });
  const email = (f.dataset.email || "").trim();
  if (email) Object.assign($("sfEmail"), { hidden: false, href: `mailto:${email}`, textContent: email });

  const ca = (f.dataset.ca || "").trim();
  const sym = `$${(f.dataset.token || "LYNO").replace(/^\$/, "")}`;
  if (/^0x[a-fA-F0-9]{40}$/.test(ca)) {
    $("sfTokenBlock").hidden = false;
    $("sfTokenSymbol").textContent = sym;
    $("sfCa").textContent = ca;
    f.querySelectorAll(".sf-sym").forEach((el) => (el.textContent = sym));
    $("sfExplorer").href = `https://elysium.kinetiq.xyz/explorer/token/${ca}`;
    $("sfScan").href = `agent.html?ca=${ca}`;
  }

  f.querySelectorAll(".sf-copy").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText($(btn.dataset.copyFrom).textContent.trim());
        btn.textContent = "COPIED";
      } catch {
        btn.textContent = "FAILED";
      }
      setTimeout(() => (btn.textContent = "COPY"), 1500);
    });
  });
})();
