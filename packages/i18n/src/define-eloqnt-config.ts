import { fileURLToPath } from "node:url";
import { defineConfig } from "@eloqnt/cli";
import { codexCli } from "ai-sdk-provider-codex-cli";

type EloqntMessages = Parameters<typeof defineConfig>[0]["messages"];

type EloqntProjectOptions = {
  messages?: Partial<EloqntMessages>;
  srcPath?: string | string[] | null;
};

/**
 * Points Eloqnt at a Codex CLI installed outside this repo.
 * This avoids running the optional Codex binary that the provider can install
 * under node_modules while still letting each developer choose a trusted CLI path.
 */
function getCodexPath() {
  return process.env.CODEX_PATH ?? "codex";
}

/**
 * Translates with eloqnt's hosted engine when `ELOQNT_TOKEN` is set, as in Claude Code's cloud
 * sessions, which have no Codex CLI; otherwise with the Codex CLI on this machine.
 */
function getModel() {
  if (process.env.ELOQNT_TOKEN) {
    return {};
  }

  return { model: codexCli("gpt-6-luna", { codexPath: getCodexPath() }) };
}

function getSrcPath(srcPath: EloqntProjectOptions["srcPath"]) {
  if (srcPath === null) {
    return;
  }

  return srcPath ?? "./src";
}

/**
 * Shares configuration for consumers while allowing local overrides.
 * @public
 */
export default function defineEloqntConfig(options: EloqntProjectOptions = {}) {
  return defineConfig({
    messages: {
      format: "po",
      locales: "infer",
      path: "./messages",
      sourceLocale: "en",
      ...options.messages,
    },
    ...getModel(),
    srcPath: getSrcPath(options.srcPath),
    styleguides: fileURLToPath(new URL("../.eloqnt", import.meta.url)),
  });
}
