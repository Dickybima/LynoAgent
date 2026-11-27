import Anthropic from "@anthropic-ai/sdk";
import { detectAddresses, formatReport, lookupToken, type TokenReport } from "../server/src/crypto/token.js";

const MODEL = process.env.LYNO_MODEL || "claude-opus-5-5";
const MAX_MESSAGE_CHARS = 2000;
const MAX_HISTORY = 8;
const MAX_ADDRESSES = 3;

const SYSTEM = `You are Lyno Agent, a calm, sharp crypto token analyst with a hooded-hacker persona, built for the Elysium network
(Kinetiq's Hyperliquid L2, chain id 99901, gas token HYPE; tokens trade on Uniswap v4 against HYPE or KNTQ, often launched from a launchpad factory).
People paste token contract addresses (CAs) and you explain what the on-chain and market data means. Elysium comes first: an address is always checked on Elysium before other chains.

Rules:
- Reply in the same language the user writes in (Indonesian if they write Indonesian).
- When token data is provided, it is the source of truth. Never invent numbers, holders, links or audits that are not in it.
- The full data report is already shown to the user above your reply, so do not repeat it. Give your take in 3-6 short bullet points: what stands out, the biggest risks, and what to double-check manually.
- Be direct about red flags (honeypot, high tax, mint/freeze authority, unlocked LP, concentrated holders, brand-new pools, bonding-curve tokens).
- For Elysium tokens: tokens held by the Uniswap v4 PoolManager are liquidity, not a whale; honeypot/tax simulation is not available there, so suggest a small test sell; an unverified launchpad clone is common but worth noting.
- Never tell people to buy or sell, never promise returns. End with a short DYOR reminder.
- If there is no token data, answer briefly and explain that they can paste an Elysium (0x…) contract address — or one from another EVM chain or Solana — to get a full report.`;

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AgentReply {
  reply: string;
  tokens: TokenReport[];
  ai: boolean;
  aiError?: string;
}

const HELP = `Paste an **Elysium** token **contract address (CA)** and I'll pull the details: price, market cap, liquidity, volume, holders (pools vs wallets), deployer and launchpad factory, owner status, contract verification, and a risk verdict.

Elysium is checked first. Other chains work too: Ethereum, BNB Chain, Base, Arbitrum, Polygon (\`0x…\`) and Solana (including pump.fun).

Example: \`0xfF273B5eE754c4c017065DE3889Fa3eE06D69929\``;

function compactForModel(r: TokenReport) {
  // Keep the prompt small: drop links/images, keep the facts the model reasons about.
  const { imageUrl: _i, links: _l, ...rest } = r;
  return rest;
}

async function aiTake(message: string, history: ChatTurn[], reports: TokenReport[]): Promise<string> {
  const client = new Anthropic();
  const context = reports.length
    ? `\n\n<token_data>\n${JSON.stringify(reports.map(compactForModel))}\n</token_data>`
    : "";
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...history.slice(-MAX_HISTORY).map((t) => ({ role: t.role, content: t.content })),
    { role: "user", content: `${message}${context}` },
  ];
  // The API needs the first message to be from the user.
  while (messages.length && messages[0].role !== "user") messages.shift();

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 2000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system: SYSTEM,
    messages,
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to answer this request.");
  }
  return response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

export async function runAgent(rawMessage: string, rawHistory: unknown): Promise<AgentReply> {
  const message = rawMessage.slice(0, MAX_MESSAGE_CHARS);
  const history: ChatTurn[] = Array.isArray(rawHistory)
    ? rawHistory
        .filter((t): t is ChatTurn => !!t && (t.role === "user" || t.role === "assistant") && typeof t.content === "string")
        .map((t) => ({ role: t.role, content: t.content.slice(0, MAX_MESSAGE_CHARS) }))
    : [];

  const addresses = detectAddresses(message).slice(0, MAX_ADDRESSES);
  const tokens = await Promise.all(addresses.map((a) => lookupToken(a.address)));
  const reportText = tokens.map(formatReport).join("\n\n---\n\n");
  const hasKey = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

  if (!hasKey) {
    return { reply: tokens.length ? reportText : HELP, tokens, ai: false };
  }

  try {
    const take = await aiTake(message, history, tokens.filter((t) => t.found));
    const reply = tokens.length ? `${reportText}\n\n### 🧠 Lyno's take\n${take}` : take;
    return { reply, tokens, ai: true };
  } catch (err) {
    let aiError = "AI analysis is unavailable right now.";
    if (err instanceof Anthropic.RateLimitError) aiError = "AI analysis is rate-limited, try again shortly.";
    else if (err instanceof Anthropic.AuthenticationError) aiError = "AI analysis is misconfigured (invalid API key).";
    else if (err instanceof Anthropic.APIError) aiError = `AI analysis failed (HTTP ${err.status}).`;
    console.error("[lyno-agent] AI error:", err);
    return { reply: tokens.length ? reportText : HELP, tokens, ai: false, aiError };
  }
}
