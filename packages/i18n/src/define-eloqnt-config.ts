import { fileURLToPath } from "node:url";
import { defineConfig } from "@eloqnt/cli";
import { codexCli } from "ai-sdk-provider-codex-cli";
import { NEXT_INTL_PO_FORMAT } from "./next-intl/po-format";

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
      format: NEXT_INTL_PO_FORMAT,
      locales: "infer",
      path: "./messages",
      sourceLocale: "en",
      ...options.messages,
    },
    model: codexCli("gpt-5.6-sol", { codexPath: getCodexPath() }),
    srcPath: getSrcPath(options.srcPath),
    styleguides: fileURLToPath(new URL("../.eloqnt", import.meta.url)),
  });
}
