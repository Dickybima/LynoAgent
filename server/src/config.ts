import os from "node:os";
import path from "node:path";

export const AGENT_NAME = "lyno-agent";
export const AGENT_TITLE = "Lyno Agent";
export const AGENT_VERSION = "1.0.0";

/** Root folder the filesystem tools are allowed to touch. */
export const WORKSPACE = path.resolve(process.env.LYNO_WORKSPACE ?? process.cwd());

/** Where Lyno keeps its long-term memory. */
export const DATA_DIR = path.resolve(
  process.env.LYNO_DATA_DIR ?? path.join(os.homedir(), ".lyno-agent"),
);

/** Set LYNO_READ_ONLY=1 to disable every tool that writes to disk. */
export const READ_ONLY = /^(1|true|yes)$/i.test(process.env.LYNO_READ_ONLY ?? "");

export const MAX_READ_BYTES = 512 * 1024;
export const MAX_FETCH_CHARS = 20_000;
