import { defineConfig } from "@eloqnt/cli";
import { codexCli } from "ai-sdk-provider-codex-cli";

// Can be extended as necessary
type EloqntProjectOptions = { srcPath?: string | string[] };

/**
 * Points Eloqnt at a Codex CLI installed outside this repo.
 * This avoids running the optional Codex binary that the provider can install
 * under node_modules while still letting each developer choose a trusted CLI path.
 */
function getCodexPath() {
  return process.env.CODEX_PATH ?? "codex";
}

/**
 * Shares configuration for consumers while allowing local overrides.
 * @public
 */
export default function defineEloqntConfig(options: EloqntProjectOptions = {}) {
  return defineConfig({
    messages: { format: "po", locales: "infer", path: "./messages", sourceLocale: "en" },
    model: codexCli("gpt-5.6-sol", { codexPath: getCodexPath() }),
    srcPath: options.srcPath ?? "./src",
  });
}
