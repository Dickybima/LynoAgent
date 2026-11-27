// ─── Site settings ──────────────────────────────────────────────
// Fill these in once; the header and footer pick them up on every page.
// Empty values are hidden, so nothing placeholder-y shows on the site.
const SITE = {
  domain: "https://www.lynoagent.com", // canonical site URL — shown in endpoint boxes even when opened via *.vercel.app
  x: "",        // X / Twitter handle without "@", e.g. "lynoagent"
  email: "",    // contact email, e.g. "hello@lynoagent.com"
  token: "LYNO", // token symbol shown in the footer
  ca: "",       // token contract address on Elysium (0x…)
};

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

// Dropdown groups in the top menu (hover on desktop, click/tap everywhere)
(() => {
  const groups = [...document.querySelectorAll(".nav .dd")];
  const closeAll = (except) =>
    groups.forEach((g) => {
      if (g === except) return;
      g.classList.remove("open");
      g.querySelector(".dd-btn").setAttribute("aria-expanded", "false");
    });
  groups.forEach((g) => {
    const btn = g.querySelector(".dd-btn");
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = !g.classList.contains("open");
      closeAll(g);
      g.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", String(open));
    });
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".nav .dd")) closeAll(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAll(); });

  const x = SITE.x.replace(/^@/, "").trim();
  const navX = document.getElementById("navX");
  if (navX && x) Object.assign(navX, { hidden: false, href: `https://x.com/${encodeURIComponent(x)}`, textContent: `𝕏 ${x}` });
})();

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
  $("sfEndpoint").textContent = `${SITE.domain}/mcp`;
  $("sfYear").textContent = String(new Date().getFullYear());

  const x = SITE.x.replace(/^@/, "").trim();
  if (x) Object.assign($("sfX"), { hidden: false, href: `https://x.com/${encodeURIComponent(x)}`, textContent: `@${x} on X` });
  const email = SITE.email.trim();
  if (email) Object.assign($("sfEmail"), { hidden: false, href: `mailto:${email}`, textContent: email });

  const ca = SITE.ca.trim();
  const sym = `$${(SITE.token || "LYNO").replace(/^\$/, "")}`;
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

// Hero logo: spins a full 360° continuously; drag (mouse or touch) to spin it yourself, with momentum
(() => {
  const art = document.querySelector(".hero-art");
  const img = art?.querySelector("img");
  if (!art || !img || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  art.classList.add("js-spin");

  const AUTO = 30;          // degrees per second when idle (one turn every 12 s)
  const DRAG = 0.6;         // degrees per pixel dragged
  let angle = 0;
  let velocity = AUTO;      // current spin speed (deg/s)
  let dragging = false;
  let lastX = 0, lastT = 0, last = performance.now();

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!dragging) {
      // After a flick, ease back toward the steady auto-spin (keeping the flick's direction).
      const target = Math.sign(velocity || 1) * AUTO;
      velocity += (target - velocity) * Math.min(dt * 1.6, 1);
      angle += velocity * dt;
    }
    angle %= 360;
    const bob = Math.sin(now / 1000 * (Math.PI / 3)) * 10; // gentle float, 6 s period
    img.style.transform = `translateY(${bob.toFixed(2)}px) rotateY(${angle.toFixed(2)}deg)`;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  art.addEventListener("pointerdown", (e) => {
    dragging = true;
    lastX = e.clientX; lastT = performance.now();
    velocity = 0;
    art.classList.add("dragging");
    art.setPointerCapture(e.pointerId);
  });
  art.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const now = performance.now();
    const dx = e.clientX - lastX;
    angle += dx * DRAG;
    const dt = Math.max((now - lastT) / 1000, 0.001);
    velocity = Math.max(-900, Math.min(900, (dx * DRAG) / dt)); // remembered for the flick
    lastX = e.clientX; lastT = now;
  });
  const release = () => {
    if (!dragging) return;
    dragging = false;
    if (performance.now() - lastT > 120) velocity = AUTO; // held still before letting go
    art.classList.remove("dragging");
  };
  art.addEventListener("pointerup", release);
  art.addEventListener("pointercancel", release);
})();
