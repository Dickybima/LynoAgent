/**
 * Token lookup by contract address (CA).
 * Market data: DexScreener. Contract security: GoPlus (EVM + Solana). Solana risk score: RugCheck.
 * All sources are public and keyless; any single source may fail without breaking the report.
 */

import { ELYSIUM, lookupElysium, type ElysiumReport } from "./elysium.js";

const UA = { "user-agent": "LynoAgent/1.0 (+https://www.lynoagent.com)", accept: "application/json" };

export type ChainKind = "evm" | "solana";

export interface DetectedAddress {
  address: string;
  kind: ChainKind;
}

const EVM_RE = /\b0x[a-fA-F0-9]{40}\b/g;
const SOL_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;

/** Find contract addresses in free text (EVM first, then Solana base58). */
export function detectAddresses(text: string): DetectedAddress[] {
  const out: DetectedAddress[] = [];
  const seen = new Set<string>();
  for (const m of text.match(EVM_RE) ?? []) {
    const k = m.toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push({ address: m, kind: "evm" }); }
  }
  const withoutEvm = text.replace(EVM_RE, " ");
  for (const m of withoutEvm.match(SOL_RE) ?? []) {
    // Base58 mints mix digits and letters; skip plain words.
    if (!/\d/.test(m) && !/pump$/i.test(m)) continue;
    if (!seen.has(m)) { seen.add(m); out.push({ address: m, kind: "solana" }); }
  }
  return out;
}

// DexScreener chainId → GoPlus EVM chain id
const GOPLUS_EVM: Record<string, string> = {
  ethereum: "1", bsc: "56", base: "8453", arbitrum: "42161", polygon: "137",
  avalanche: "43114", optimism: "10", linea: "59144", blast: "81457", scroll: "534352",
  fantom: "250", cronos: "25", zksync: "324", mantle: "5000", sonic: "146",
  abstract: "2741", unichain: "130", berachain: "80094", opbnb: "204", hyperevm: "999",
};

const CHAIN_NAMES: Record<string, string> = {
  elysium: "Elysium", ethereum: "Ethereum", bsc: "BNB Chain", base: "Base", arbitrum: "Arbitrum", polygon: "Polygon",
  avalanche: "Avalanche", optimism: "Optimism", solana: "Solana", linea: "Linea", blast: "Blast",
  sonic: "Sonic", abstract: "Abstract", unichain: "Unichain", berachain: "Berachain", hyperevm: "HyperEVM",
};

async function getJson<T>(url: string, timeoutMs = 8000): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ---------- source types (only the fields we use) ----------
interface DsPair {
  chainId: string; dexId: string; url: string; pairAddress: string; labels?: string[];
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd?: string; priceNative?: string;
  txns?: Record<string, { buys: number; sells: number }>;
  volume?: Record<string, number>;
  priceChange?: Record<string, number>;
  liquidity?: { usd?: number; base?: number; quote?: number };
  fdv?: number; marketCap?: number; pairCreatedAt?: number;
  info?: { imageUrl?: string; websites?: { url: string; label?: string }[]; socials?: { url: string; type: string }[] };
  boosts?: { active?: number };
}

type GoPlusFlag = "0" | "1" | "" | undefined;
interface GoPlusEvm {
  token_name?: string; token_symbol?: string; holder_count?: string; total_supply?: string;
  buy_tax?: string; sell_tax?: string; transfer_tax?: string;
  is_honeypot?: GoPlusFlag; cannot_buy?: GoPlusFlag; cannot_sell_all?: GoPlusFlag;
  is_mintable?: GoPlusFlag; is_open_source?: GoPlusFlag; is_proxy?: GoPlusFlag;
  hidden_owner?: GoPlusFlag; can_take_back_ownership?: GoPlusFlag; owner_change_balance?: GoPlusFlag;
  selfdestruct?: GoPlusFlag; external_call?: GoPlusFlag; transfer_pausable?: GoPlusFlag;
  is_blacklisted?: GoPlusFlag; slippage_modifiable?: GoPlusFlag; trading_cooldown?: GoPlusFlag;
  owner_address?: string; creator_address?: string; creator_percent?: string; owner_percent?: string;
  holders?: { address: string; percent: string; is_contract?: number; is_locked?: number; tag?: string }[];
  lp_holders?: { address: string; percent: string; is_locked?: number; tag?: string }[];
  is_in_cex?: { listed?: string; cex_list?: string[] };
}
interface GoPlusSol {
  holder_count?: string; total_supply?: string;
  mintable?: { status?: string }; freezable?: { status?: string }; closable?: { status?: string };
  balance_mutable_authority?: { status?: string }; metadata_mutable?: { status?: string };
  non_transferable?: string; transfer_fee?: Record<string, unknown>;
  transfer_hook?: unknown[];
  holders?: { account: string; percent: string; is_locked?: number; tag?: string }[];
  metadata?: { name?: string; symbol?: string; description?: string };
  trusted_token?: number;
}
interface RugCheckSummary {
  score?: number; score_normalised?: number; lpLockedPct?: number;
  risks?: { name: string; description?: string; level?: string; value?: string }[];
}

// ---------- report ----------
export interface TokenReport {
  found: boolean;
  address: string;
  chain?: string;
  chainName?: string;
  name?: string;
  symbol?: string;
  imageUrl?: string;
  priceUsd?: number;
  priceChange?: { m5?: number; h1?: number; h6?: number; h24?: number };
  marketCap?: number;
  fdv?: number;
  liquidityUsd?: number;
  volume24h?: number;
  txns24h?: { buys: number; sells: number };
  pairCount?: number;
  bondingCurve?: boolean;
  mainPair?: { dex: string; pairAddress: string; quote: string; url: string; createdAt?: string; ageDays?: number };
  holders?: number;
  top10Percent?: number;
  security: {
    buyTax?: number; sellTax?: number;
    honeypot?: boolean; mintable?: boolean; freezable?: boolean; openSource?: boolean; proxy?: boolean;
    ownerRenounced?: boolean; blacklist?: boolean; pausable?: boolean; metadataMutable?: boolean;
    lpLockedPercent?: number; rugcheckScore?: number; cexListed?: string[];
    ownerStatus?: string;
  };
  elysium?: Pick<ElysiumReport,
    "verified" | "isClone" | "implementation" | "implementationVerified" | "proxy" | "owner" | "creator" | "factory" |
    "createdAt" | "liquidityPercent" | "burnedPercent" | "creatorPercent" | "sourceFlags" | "holderCountCapped" | "topHolders">;
  links: { label: string; url: string }[];
  risks: { level: "danger" | "warn" | "info"; text: string }[];
  verdict: "low" | "medium" | "high" | "unknown";
  sources: string[];
}

const num = (v: unknown) => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : undefined;
};
const flag = (v: GoPlusFlag) => (v === "1" ? true : v === "0" ? false : undefined);
const ZERO = /^0x0{40}$|^0x0{36}dead$/i;

export async function lookupToken(address: string): Promise<TokenReport> {
  const isEvm = /^0x[a-fA-F0-9]{40}$/.test(address);
  const report: TokenReport = { found: false, address, security: {}, links: [], risks: [], verdict: "unknown", sources: [] };

  // 1) Market data (DexScreener) and Elysium on-chain data in parallel. Elysium has priority.
  const [ds, ely] = await Promise.all([
    getJson<{ pairs: DsPair[] | null }>(`https://api.dexscreener.com/latest/dex/tokens/${address}`),
    isEvm ? lookupElysium(address) : Promise.resolve(null),
  ]);
  const allPairs = ds?.pairs ?? [];
  const onElysium = !!ely?.found || allPairs.some((p) => p.chainId === ELYSIUM.slug);
  const scoped = onElysium ? allPairs.filter((p) => p.chainId === ELYSIUM.slug) : allPairs;
  const pairs = scoped.filter((p) => p.baseToken.address.toLowerCase() === address.toLowerCase());
  const usable = pairs.length ? pairs : scoped;
  if (usable.length) {
    report.sources.push("DexScreener");
    const main = usable.slice().sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
    const isBase = main.baseToken.address.toLowerCase() === address.toLowerCase();
    const tok = isBase ? main.baseToken : main.quoteToken;
    report.found = true;
    report.chain = main.chainId;
    report.chainName = CHAIN_NAMES[main.chainId] ?? main.chainId;
    report.name = tok.name;
    report.symbol = tok.symbol;
    report.imageUrl = main.info?.imageUrl;
    if (isBase) {
      report.priceUsd = num(main.priceUsd);
      report.priceChange = main.priceChange;
      report.marketCap = num(main.marketCap);
      report.fdv = num(main.fdv);
    }
    report.liquidityUsd = usable.reduce((s, p) => s + (p.liquidity?.usd ?? 0), 0);
    report.volume24h = usable.reduce((s, p) => s + (p.volume?.h24 ?? 0), 0);
    report.txns24h = usable.reduce(
      (s, p) => ({ buys: s.buys + (p.txns?.h24?.buys ?? 0), sells: s.sells + (p.txns?.h24?.sells ?? 0) }),
      { buys: 0, sells: 0 },
    );
    report.pairCount = usable.length;
    // Launchpad tokens (pump.fun etc.) trade on a bonding curve before migrating to a DEX pool.
    report.bondingCurve = usable.every((p) => !p.liquidity?.usd) && usable.some((p) => /pump|launch|bonk|moon/i.test(p.dexId));
    const created = usable.map((p) => p.pairCreatedAt).filter((t): t is number => !!t).sort((a, b) => a - b)[0];
    report.mainPair = {
      dex: `${main.dexId}${main.labels?.length ? ` ${main.labels.join("/")}` : ""}`,
      pairAddress: main.pairAddress,
      quote: isBase ? main.quoteToken.symbol : main.baseToken.symbol,
      url: main.url,
      createdAt: created ? new Date(created).toISOString() : undefined,
      ageDays: created ? Math.floor((Date.now() - created) / 86_400_000) : undefined,
    };
    report.links.push({ label: "DexScreener", url: main.url });
    for (const w of main.info?.websites ?? []) report.links.push({ label: w.label || "Website", url: w.url });
    for (const s of main.info?.socials ?? []) report.links.push({ label: s.type[0].toUpperCase() + s.type.slice(1), url: s.url });
  }

  if (onElysium) { report.chain = ELYSIUM.slug; report.chainName = ELYSIUM.name; }
  const chain = report.chain ?? (isEvm ? undefined : "solana");
  if (!report.chain && !isEvm) { report.chain = "solana"; report.chainName = "Solana"; }

  // 2) Security
  if (chain === ELYSIUM.slug && ely?.found) {
    applyElysium(report, ely);
  } else if (chain === ELYSIUM.slug) {
    report.risks.push({ level: "info", text: "Elysium explorer data is unavailable right now — on-chain checks skipped." });
  } else if (chain === "solana") {
    const [gp, rc] = await Promise.all([
      getJson<{ code: number; result?: Record<string, GoPlusSol> }>(
        `https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${address}`),
      getJson<RugCheckSummary>(`https://api.rugcheck.xyz/v1/tokens/${address}/report/summary`),
    ]);
    const g = gp?.result ? Object.values(gp.result)[0] : undefined;
    if (g) {
      report.sources.push("GoPlus");
      report.found = true;
      report.name ??= g.metadata?.name;
      report.symbol ??= g.metadata?.symbol;
      report.holders = num(g.holder_count);
      report.security.mintable = g.mintable?.status === "1";
      report.security.freezable = g.freezable?.status === "1";
      report.security.metadataMutable = g.metadata_mutable?.status === "1";
      if (g.holders?.length) report.top10Percent = g.holders.slice(0, 10).reduce((s, h) => s + (num(h.percent) ?? 0), 0) * 100;
      if (g.mintable?.status === "1") report.risks.push({ level: "danger", text: "Mint authority is still enabled — supply can be increased." });
      if (g.freezable?.status === "1") report.risks.push({ level: "danger", text: "Freeze authority is enabled — wallets can be frozen." });
      if (g.balance_mutable_authority?.status === "1") report.risks.push({ level: "danger", text: "Balances can be changed by an authority." });
      if (g.non_transferable === "1") report.risks.push({ level: "danger", text: "Token is non-transferable." });
      if (g.transfer_hook?.length) report.risks.push({ level: "warn", text: "Token has a transfer hook." });
      if (g.metadata_mutable?.status === "1") report.risks.push({ level: "info", text: "Metadata is mutable." });
    }
    if (rc && (rc.score !== undefined || rc.risks)) {
      report.sources.push("RugCheck");
      report.found = true;
      report.security.rugcheckScore = rc.score_normalised;
      if (rc.lpLockedPct !== undefined) report.security.lpLockedPercent = rc.lpLockedPct;
      for (const r of rc.risks ?? []) {
        if (/mutable metadata/i.test(r.name) && report.security.metadataMutable !== undefined) continue; // already reported
        const text = `${r.name}${r.description ? ` — ${r.description}` : ""}`;
        if (report.risks.some((x) => x.text.toLowerCase().startsWith(r.name.toLowerCase()))) continue;
        report.risks.push({ level: r.level === "danger" ? "danger" : r.level === "warn" ? "warn" : "info", text });
      }
    }
  } else if (isEvm) {
    const ids = chain ? [GOPLUS_EVM[chain]].filter(Boolean) : ["1", "56", "8453"];
    for (const id of ids) {
      const gp = await getJson<{ code: number; result?: Record<string, GoPlusEvm> }>(
        `https://api.gopluslabs.io/api/v1/token_security/${id}?contract_addresses=${address}`);
      const g = gp?.result ? Object.values(gp.result)[0] : undefined;
      if (!g || !Object.keys(g).length) continue;
      report.sources.push("GoPlus");
      report.found = true;
      report.name ??= g.token_name;
      report.symbol ??= g.token_symbol;
      if (!report.chain) {
        const entry = Object.entries(GOPLUS_EVM).find(([, v]) => v === id);
        report.chain = entry?.[0];
        report.chainName = entry ? CHAIN_NAMES[entry[0]] ?? entry[0] : id;
      }
      const s = report.security;
      s.buyTax = num(g.buy_tax) !== undefined ? num(g.buy_tax)! * 100 : undefined;
      s.sellTax = num(g.sell_tax) !== undefined ? num(g.sell_tax)! * 100 : undefined;
      s.honeypot = flag(g.is_honeypot);
      s.mintable = flag(g.is_mintable);
      s.openSource = flag(g.is_open_source);
      s.proxy = flag(g.is_proxy);
      s.blacklist = flag(g.is_blacklisted);
      s.pausable = flag(g.transfer_pausable);
      s.ownerRenounced = g.owner_address !== undefined ? g.owner_address === "" || ZERO.test(g.owner_address) : undefined;
      if (g.is_in_cex?.listed === "1") s.cexListed = g.is_in_cex.cex_list;
      report.holders = num(g.holder_count);
      if (g.holders?.length) report.top10Percent = g.holders.slice(0, 10).reduce((t, h) => t + (num(h.percent) ?? 0), 0) * 100;
      // LP counts as locked when it sits in a locker, a burn address, or the token contract itself.
      const lockedLp = (g.lp_holders ?? []).filter(
        (h) => h.is_locked === 1 || /dead$|^0x0{40}$/i.test(h.address) || h.address.toLowerCase() === address.toLowerCase(),
      );
      if (g.lp_holders?.length) s.lpLockedPercent = lockedLp.reduce((t, h) => t + (num(h.percent) ?? 0), 0) * 100;

      const owned = s.ownerRenounced === false;
      if (s.honeypot) report.risks.push({ level: "danger", text: "Honeypot detected — tokens may not be sellable." });
      if (flag(g.cannot_sell_all)) report.risks.push({ level: "danger", text: "Holders cannot sell their full balance." });
      if (flag(g.cannot_buy)) report.risks.push({ level: "danger", text: "Token cannot be bought." });
      if ((s.sellTax ?? 0) > 10) report.risks.push({ level: "danger", text: `High sell tax: ${s.sellTax!.toFixed(1)}%.` });
      else if ((s.sellTax ?? 0) > 5) report.risks.push({ level: "warn", text: `Sell tax is ${s.sellTax!.toFixed(1)}%.` });
      if ((s.buyTax ?? 0) > 10) report.risks.push({ level: "danger", text: `High buy tax: ${s.buyTax!.toFixed(1)}%.` });
      else if ((s.buyTax ?? 0) > 5) report.risks.push({ level: "warn", text: `Buy tax is ${s.buyTax!.toFixed(1)}%.` });
      if (s.openSource === false) report.risks.push({ level: "danger", text: "Contract source code is not verified." });
      if (flag(g.hidden_owner)) report.risks.push({ level: "danger", text: "Contract has a hidden owner." });
      if (flag(g.can_take_back_ownership)) report.risks.push({ level: "danger", text: "Ownership can be reclaimed after renouncing." });
      if (flag(g.owner_change_balance)) report.risks.push({ level: "danger", text: "Owner can change wallet balances." });
      if (flag(g.selfdestruct)) report.risks.push({ level: "danger", text: "Contract can self-destruct." });
      if (s.mintable && owned) report.risks.push({ level: "warn", text: "Owner can mint new tokens." });
      if (s.proxy) report.risks.push({ level: "warn", text: "Upgradeable proxy contract — logic can change." });
      if (s.blacklist && owned) report.risks.push({ level: "warn", text: "Owner can blacklist wallets." });
      if (s.pausable && owned) report.risks.push({ level: "warn", text: "Owner can pause transfers." });
      if (flag(g.slippage_modifiable) && owned) report.risks.push({ level: "warn", text: "Owner can change taxes." });
      if (flag(g.trading_cooldown)) report.risks.push({ level: "info", text: "Trading cooldown is enabled." });
      break;
    }
  }

  // 3) Market-structure risks
  if (report.chain === ELYSIUM.slug && !report.sources.includes("DexScreener") && report.found) {
    report.risks.push({ level: "info", text: "No DexScreener pair yet — price comes from the Elysium explorer." });
  }
  if (report.found) {
    if (report.bondingCurve) report.risks.push({ level: "warn", text: `Still on the ${report.mainPair?.dex ?? "launchpad"} bonding curve — not migrated to a DEX pool yet.` });
    else if (report.liquidityUsd !== undefined && report.liquidityUsd < 10_000) report.risks.push({ level: "warn", text: `Low liquidity ($${Math.round(report.liquidityUsd).toLocaleString("en-US")}).` });
    if (report.top10Percent !== undefined && report.top10Percent > 50) report.risks.push({ level: "warn", text: `Top 10 holders own ${report.top10Percent.toFixed(1)}% of supply.` });
    const veryNew = report.mainPair?.ageDays !== undefined && report.mainPair.ageDays < 2;
    if (veryNew) report.risks.push({ level: "warn", text: "Very new token — pool is less than 2 days old. Expect high volatility." });
    if (!report.sources.includes("DexScreener") && report.chain !== ELYSIUM.slug) report.risks.push({ level: "info", text: "No DEX trading pair found yet." });

    const danger = report.risks.filter((r) => r.level === "danger").length;
    const warn = report.risks.filter((r) => r.level === "warn").length;
    report.verdict = danger > 0 ? "high" : warn >= 2 || veryNew ? "medium" : "low";
    if (report.sources.length === 1 && report.sources[0] === "DexScreener") report.verdict = warn ? "medium" : "unknown";
  }
  return report;
}

function applyElysium(report: TokenReport, e: ElysiumReport) {
  report.sources.push("Elysium explorer");
  report.found = true;
  report.name ??= e.name;
  report.symbol ??= e.symbol;
  report.imageUrl ??= e.imageUrl;
  report.priceUsd ??= e.priceUsd;
  if (report.marketCap === undefined && e.priceUsd && e.totalSupply) report.marketCap = e.priceUsd * e.totalSupply;
  report.holders = e.holderCount;
  report.top10Percent = e.top10WalletPercent;
  const s = report.security;
  s.openSource = e.isClone ? e.implementationVerified : e.verified;
  s.proxy = e.proxy;
  s.ownerRenounced = e.owner === null ? undefined : e.ownerRenounced;
  s.ownerStatus = e.owner === null ? "No owner function" : e.ownerRenounced ? "Renounced" : `Owned by ${e.owner!.slice(0, 6)}…${e.owner!.slice(-4)}`;
  report.elysium = {
    verified: e.verified, isClone: e.isClone, implementation: e.implementation, implementationVerified: e.implementationVerified,
    proxy: e.proxy, owner: e.owner, creator: e.creator, factory: e.factory, createdAt: e.createdAt,
    liquidityPercent: e.liquidityPercent, burnedPercent: e.burnedPercent, creatorPercent: e.creatorPercent,
    sourceFlags: e.sourceFlags, holderCountCapped: e.holderCountCapped, topHolders: e.topHolders.slice(0, 10),
  };
  if (!report.links.some((l) => l.url === e.explorerUrl)) report.links.unshift({ label: "Elysium Explorer", url: e.explorerUrl });
  for (const l of e.socials) if (!report.links.some((x) => x.url === l.url)) report.links.push(l);

  const owned = !!e.owner && !e.ownerRenounced;
  if (s.openSource === false) {
    report.risks.push({
      level: "warn",
      text: e.isClone
        ? "Contract is a launchpad clone whose implementation source is not verified on the Elysium explorer."
        : "Contract source code is not verified on the Elysium explorer.",
    });
  }
  if (e.proxy) report.risks.push({ level: "warn", text: "Upgradeable proxy contract — logic can change." });
  if (owned) report.risks.push({ level: "warn", text: "Contract still has an owner (not renounced)." });
  for (const f of e.sourceFlags) report.risks.push({ level: owned ? "warn" : "info", text: `${f}${owned ? "" : " (no active owner)"}.` });
  if ((e.creatorPercent ?? 0) > 10) report.risks.push({ level: "warn", text: `Deployer wallet still holds ${e.creatorPercent!.toFixed(1)}% of supply.` });
  report.risks.push({ level: "info", text: "Honeypot / tax simulation is not available on Elysium yet — test with a small sell first." });
}

// ---------- text formatting ----------
export function formatUsd(n?: number): string {
  if (n === undefined) return "—";
  if (n === 0) return "$0";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  if (n >= 1) return `$${n.toFixed(4)}`;
  // small prices: keep 4 significant digits
  return `$${n.toPrecision(4).replace(/\.?0+$/, "")}`;
}
export function formatAge(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60_000));
  if (mins < 60) return `${mins}m`;
  if (mins < 48 * 60) return `${Math.floor(mins / 60)}h`;
  const days = Math.floor(mins / 1440);
  return days < 365 ? `${days}d` : `${(days / 365).toFixed(1)}y`;
}
const pct = (n?: number) => (n === undefined ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(2)}%`);
const yn = (b?: boolean, yes = "Yes", no = "No") => (b === undefined ? "—" : b ? yes : no);

function elysiumLines(r: TokenReport): string[] {
  const e = r.elysium;
  if (!e) return ["- On-chain checks unavailable."];
  const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");
  return [
    `- Verified source: ${yn(r.security.openSource)}${e.isClone ? " (launchpad clone)" : ""} · Proxy: ${yn(e.proxy)} · Owner: ${r.security.ownerStatus ?? "—"}`,
    `- Deployer: ${short(e.creator)}${e.factory ? ` via factory ${short(e.factory)}` : ""}${e.createdAt ? ` · deployed ${formatAge(e.createdAt)} ago` : ""}`,
    ...(e.sourceFlags.length ? [`- Contract powers: ${e.sourceFlags.join("; ")}`] : []),
    "- Honeypot/tax simulation: not available on Elysium yet",
  ];
}

export function formatReport(r: TokenReport): string {
  if (!r.found) {
    return `No token found for \`${r.address}\`. Check the contract address — it may be on an unsupported chain or not traded yet.`;
  }
  const verdictText = { low: "🟢 LOW", medium: "🟡 MEDIUM", high: "🔴 HIGH", unknown: "⚪ UNKNOWN" }[r.verdict];
  const s = r.security;
  const lines = [
    `## ${r.name ?? "Unknown"} ($${r.symbol ?? "?"}) — ${r.chainName ?? r.chain ?? "?"}`,
    `CA: \`${r.address}\``,
    "",
    "### Market",
    `- Price: ${formatUsd(r.priceUsd)}  (5m ${pct(r.priceChange?.m5)} · 1h ${pct(r.priceChange?.h1)} · 6h ${pct(r.priceChange?.h6)} · 24h ${pct(r.priceChange?.h24)})`,
    `- Market cap: ${formatUsd(r.marketCap)} · FDV: ${formatUsd(r.fdv)}`,
    r.bondingCurve
      ? `- Liquidity: bonding curve (${r.mainPair?.dex ?? "launchpad"}) — not on a DEX pool yet`
      : `- Liquidity: ${formatUsd(r.liquidityUsd)} across ${r.pairCount ?? 0} pair(s)`,
    `- Volume 24h: ${formatUsd(r.volume24h)} · Txns 24h: ${r.txns24h ? `${r.txns24h.buys} buys / ${r.txns24h.sells} sells` : "—"}`,
    r.mainPair ? `- Main pool: ${r.mainPair.dex} (${r.symbol}/${r.mainPair.quote})${r.mainPair.createdAt ? `, created ${formatAge(r.mainPair.createdAt)} ago` : ""}` : "",
    "",
    "### Holders",
    `- Holders: ${r.holders !== undefined ? `${r.holders.toLocaleString("en-US")}${r.elysium?.holderCountCapped ? "+" : ""}` : "—"} · Top 10 ${r.chain === ELYSIUM.slug ? "wallets" : ""} hold: ${r.top10Percent !== undefined ? `${r.top10Percent.toFixed(1)}%` : "—"}`.replace("Top 10  hold", "Top 10 hold"),
    ...(r.elysium
      ? [
          `- In liquidity pools: ${r.elysium.liquidityPercent !== undefined ? `${r.elysium.liquidityPercent.toFixed(1)}%` : "—"} · Burned: ${r.elysium.burnedPercent !== undefined ? `${r.elysium.burnedPercent.toFixed(1)}%` : "—"} · Deployer holds: ${r.elysium.creatorPercent !== undefined ? `${r.elysium.creatorPercent.toFixed(1)}%` : "—"}`,
        ]
      : []),
    "",
    "### Security",
    ...(r.chain === ELYSIUM.slug ? elysiumLines(r) : []),
    r.chain === ELYSIUM.slug ? "" : r.chain === "solana"
      ? `- Mint authority: ${yn(s.mintable, "Enabled ⚠️", "Revoked ✅")} · Freeze authority: ${yn(s.freezable, "Enabled ⚠️", "Revoked ✅")} · Metadata: ${yn(s.metadataMutable, "Mutable", "Immutable")}`
      : `- Buy tax: ${s.buyTax !== undefined ? `${s.buyTax.toFixed(1)}%` : "—"} · Sell tax: ${s.sellTax !== undefined ? `${s.sellTax.toFixed(1)}%` : "—"} · Honeypot: ${yn(s.honeypot, "YES 🚨", "No ✅")}`,
    r.chain === ELYSIUM.slug ? "" : r.chain === "solana"
      ? `- LP locked: ${s.lpLockedPercent !== undefined ? `${s.lpLockedPercent.toFixed(1)}%` : "—"} · RugCheck score: ${s.rugcheckScore !== undefined ? `${s.rugcheckScore}/100 (lower is safer)` : "—"}`
      : `- Verified source: ${yn(s.openSource)} · Ownership renounced: ${yn(s.ownerRenounced)} · Mintable: ${yn(s.mintable)} · Proxy: ${yn(s.proxy)} · LP locked/burned: ${s.lpLockedPercent !== undefined ? `${s.lpLockedPercent.toFixed(1)}%` : "—"}`,
    s.cexListed?.length ? `- Listed on: ${s.cexListed.join(", ")}` : "",
    "",
    `### Risk: ${verdictText}`,
    ...(r.risks.length ? r.risks.map((x) => `- ${x.level === "danger" ? "🚨" : x.level === "warn" ? "⚠️" : "ℹ️"} ${x.text}`) : ["- No red flags found by the automated checks."]),
    "",
    r.links.length ? `Links: ${r.links.map((l) => `[${l.label}](${l.url})`).join(" · ")}` : "",
    `_Data: ${r.sources.join(", ")}. Automated checks, not financial advice — always DYOR._`,
  ];
  return lines.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
}
