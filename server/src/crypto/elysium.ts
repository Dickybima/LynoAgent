/**
 * Elysium (Kinetiq's Hyperliquid L2, chain id 99901, gas token HYPE) on-chain checks.
 * Uses the public Blockscout explorer API (Etherscan-compatible) and the public RPC.
 */

export const ELYSIUM = {
  chainId: 99901,
  slug: "elysium", // DexScreener chainId
  name: "Elysium",
  nativeSymbol: "HYPE",
  rpc: process.env.ELYSIUM_RPC_URL || "https://rpc.elysium.kinetiq.xyz",
  explorerApi: process.env.ELYSIUM_EXPLORER_API || "https://elysium.kinetiq.xyz/explorer/api",
  explorerUrl: "https://elysium.kinetiq.xyz/explorer",
};

const UA = { "user-agent": "LynoAgent/1.0 (+https://www.lynoagent.com)", accept: "application/json" };
const BURN = /^0x0{40}$|^0x0{36}dead$|^0xdead0{36}$/i;

async function explorer<T>(params: Record<string, string>, timeoutMs = 8000): Promise<T | null> {
  try {
    const url = `${ELYSIUM.explorerApi}?${new URLSearchParams(params)}`;
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const data = (await res.json()) as { status?: string; result?: T };
    return data.status === "1" && data.result !== undefined ? data.result : null;
  } catch {
    return null;
  }
}

async function rpcBatch(calls: { method: string; params: unknown[] }[], timeoutMs = 8000): Promise<(string | null)[]> {
  if (!calls.length) return [];
  try {
    const res = await fetch(ELYSIUM.rpc, {
      method: "POST",
      headers: { ...UA, "content-type": "application/json" },
      body: JSON.stringify(calls.map((c, i) => ({ jsonrpc: "2.0", id: i, ...c }))),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const out = (await res.json()) as { id: number; result?: string; error?: unknown }[];
    const byId = new Map(out.map((r) => [r.id, r.error ? null : r.result ?? null]));
    return calls.map((_, i) => byId.get(i) ?? null);
  } catch {
    return calls.map(() => null);
  }
}

interface TokenInfo {
  tokenName?: string; symbol?: string; divisor?: string; totalSupply?: string; tokenPriceUSD?: string;
  website?: string; twitter?: string; telegram?: string; discord?: string; image?: string; tokenType?: string;
}
interface SourceInfo { SourceCode?: string; ContractName?: string; Proxy?: string; Implementation?: string }
interface Creation { contractCreator?: string; contractFactory?: string; creationBytecode?: string; timestamp?: string }
interface Holder { TokenHolderAddress: string; TokenHolderQuantity: string }

export interface ElysiumHolder {
  address: string;
  percent: number;
  kind: "wallet" | "contract" | "liquidity" | "burn";
  label?: string;
}

export interface ElysiumReport {
  found: boolean;
  name?: string;
  symbol?: string;
  decimals?: number;
  totalSupply?: number;
  priceUsd?: number;
  imageUrl?: string;
  socials: { label: string; url: string }[];
  verified?: boolean;
  contractName?: string;
  isClone?: boolean;
  implementation?: string;
  implementationVerified?: boolean;
  proxy?: boolean;
  owner?: string | null; // null = no owner() function
  ownerRenounced?: boolean;
  creator?: string;
  factory?: string;
  createdAt?: string;
  holderCount?: number;
  holderCountCapped?: boolean;
  topHolders: ElysiumHolder[];
  top10WalletPercent?: number;
  liquidityPercent?: number;
  burnedPercent?: number;
  creatorPercent?: number;
  sourceFlags: string[];
  explorerUrl: string;
}

/** Extract the implementation address from an EIP-1167 minimal-proxy creation bytecode. */
function cloneImplementation(bytecode?: string): string | undefined {
  const m = bytecode?.toLowerCase().match(/363d3d373d3d3d363d73([0-9a-f]{40})5af43d82803e903d91/);
  return m ? `0x${m[1]}` : undefined;
}

/** Look for owner-controlled powers in verified source. */
function scanSource(src: string): string[] {
  const flags: string[] = [];
  const has = (re: RegExp) => re.test(src);
  if (has(/function\s+mint\w*\s*\(/i)) flags.push("Has a mint function");
  if (has(/function\s+\w*(blacklist|blocklist|setBot|addBot)\w*\s*\(/i)) flags.push("Can blacklist wallets");
  if (has(/function\s+\w*(setFee|setTax|updateFee|setBuyFee|setSellFee|setSwapFee)\w*\s*\(/i)) flags.push("Owner can change taxes/fees");
  if (has(/function\s+\w*pause\w*\s*\(/i)) flags.push("Transfers can be paused");
  if (has(/function\s+\w*(setMaxTx|setMaxWallet|setMaxTransaction)\w*\s*\(/i)) flags.push("Owner can change max tx / wallet limits");
  if (has(/selfdestruct\s*\(/)) flags.push("Contains selfdestruct");
  return flags;
}

export async function lookupElysium(address: string): Promise<ElysiumReport> {
  const report: ElysiumReport = {
    found: false, socials: [], topHolders: [], sourceFlags: [],
    explorerUrl: `${ELYSIUM.explorerUrl}/token/${address}`,
  };

  const [infoArr, srcArr, creationArr, holders, ownerRes] = await Promise.all([
    explorer<TokenInfo[]>({ module: "token", action: "tokeninfo", contractaddress: address }),
    explorer<SourceInfo[]>({ module: "contract", action: "getsourcecode", address }),
    explorer<Creation[]>({ module: "contract", action: "getcontractcreation", contractaddresses: address }),
    explorer<Holder[]>({ module: "token", action: "tokenholderlist", contractaddress: address, page: "1", offset: "1000" }, 10_000),
    rpcBatch([{ method: "eth_call", params: [{ to: address, data: "0x8da5da5b" }, "latest"] }]), // owner()
  ]);

  const info = infoArr?.[0];
  if (!info?.symbol && !info?.tokenName) return report;
  report.found = true;
  report.name = info.tokenName;
  report.symbol = info.symbol;
  report.decimals = Number(info.divisor ?? 18);
  const scale = 10 ** (report.decimals || 18);
  const supplyRaw = Number(info.totalSupply ?? 0);
  report.totalSupply = supplyRaw / scale;
  const price = parseFloat(info.tokenPriceUSD ?? "");
  if (Number.isFinite(price) && price > 0) report.priceUsd = price;
  if (info.image) report.imageUrl = info.image;
  for (const [k, label] of [["website", "Website"], ["twitter", "Twitter"], ["telegram", "Telegram"], ["discord", "Discord"]] as const) {
    const v = info[k];
    if (v) report.socials.push({ label, url: v });
  }

  // Contract source / proxy
  const src = srcArr?.[0];
  if (src) {
    report.verified = !!src.SourceCode;
    report.contractName = src.ContractName || undefined;
    report.proxy = src.Proxy === "1";
    if (src.SourceCode) report.sourceFlags.push(...scanSource(src.SourceCode));
  }

  // Creation: creator, factory, clone implementation
  const creation = creationArr?.[0];
  if (creation) {
    report.creator = creation.contractCreator;
    report.factory = creation.contractFactory || undefined;
    if (creation.timestamp) report.createdAt = new Date(Number(creation.timestamp) * 1000).toISOString();
    const impl = cloneImplementation(creation.creationBytecode);
    if (impl) {
      report.isClone = true;
      report.implementation = impl;
      const implSrc = (await explorer<SourceInfo[]>({ module: "contract", action: "getsourcecode", address: impl }))?.[0];
      report.implementationVerified = !!implSrc?.SourceCode;
      if (implSrc?.SourceCode) report.sourceFlags.push(...scanSource(implSrc.SourceCode));
    }
  }

  // owner()
  const ownerHex = ownerRes[0];
  if (ownerHex && ownerHex.length >= 66) {
    const owner = `0x${ownerHex.slice(-40)}`;
    report.owner = owner;
    report.ownerRenounced = BURN.test(owner);
  } else {
    report.owner = null; // no Ownable owner() — nobody holds admin rights through it
  }

  // Holders: classify the top ones as wallet / contract / liquidity / burn
  if (holders?.length && supplyRaw > 0) {
    report.holderCount = holders.length;
    report.holderCountCapped = holders.length >= 1000;
    const top = holders.slice(0, 20);
    const codes = await rpcBatch(top.map((h) => ({ method: "eth_getCode", params: [h.TokenHolderAddress, "latest"] })));
    const contracts = top.filter((_, i) => {
      const c = codes[i];
      return c && c !== "0x" && !c.toLowerCase().startsWith("0xef0100"); // 0xef0100… = EIP-7702 delegated wallet
    });
    const names = await Promise.all(
      contracts.slice(0, 6).map(async (h) => {
        const s = (await explorer<SourceInfo[]>({ module: "contract", action: "getsourcecode", address: h.TokenHolderAddress }))?.[0];
        return [h.TokenHolderAddress.toLowerCase(), s?.ContractName || ""] as const;
      }),
    );
    const nameOf = new Map(names);
    const contractSet = new Set(contracts.map((h) => h.TokenHolderAddress.toLowerCase()));

    report.topHolders = top.map((h) => {
      const addr = h.TokenHolderAddress.toLowerCase();
      const percent = (Number(h.TokenHolderQuantity) / supplyRaw) * 100;
      const label = nameOf.get(addr) || undefined;
      let kind: ElysiumHolder["kind"] = "wallet";
      if (BURN.test(addr)) kind = "burn";
      else if (label && /poolmanager|pair|pool|vault|locker|bondingcurve|launch/i.test(label)) kind = "liquidity";
      else if (contractSet.has(addr)) kind = "contract";
      return { address: h.TokenHolderAddress, percent, kind, label };
    });
    const wallets = report.topHolders.filter((h) => h.kind === "wallet");
    report.top10WalletPercent = wallets.slice(0, 10).reduce((s, h) => s + h.percent, 0);
    report.liquidityPercent = report.topHolders.filter((h) => h.kind === "liquidity").reduce((s, h) => s + h.percent, 0);
    report.burnedPercent = report.topHolders.filter((h) => h.kind === "burn").reduce((s, h) => s + h.percent, 0);
    if (report.creator) {
      const c = holders.find((h) => h.TokenHolderAddress.toLowerCase() === report.creator!.toLowerCase());
      report.creatorPercent = c ? (Number(c.TokenHolderQuantity) / supplyRaw) * 100 : 0;
    }
  }

  // Dedupe flags (proxy + implementation may both match)
  report.sourceFlags = [...new Set(report.sourceFlags)];
  return report;
}
