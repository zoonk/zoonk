import { fileURLToPath } from "node:url";
import { defineConfig } from "@eloqnt/cli";
import { codexCli } from "ai-sdk-provider-codex-cli";

type EloqntMessages = Parameters<typeof defineConfig>[0]["messages"];

type EloqntProjectOptions = {
  messages?: Partial<EloqntMessages>;
  srcPath?: string | string[] | null;
};

/** Runs a trusted Codex CLI from outside the repo, not the optional binary the provider can install under node_modules. */
function getCodexPath() {
  return process.env.CODEX_PATH ?? "codex";
}

function getSrcPath(srcPath: EloqntProjectOptions["srcPath"]) {
  if (srcPath === null) {
    return;
  }

  return srcPath ?? "./src";
}

/** @public */
export default function defineEloqntConfig(options: EloqntProjectOptions = {}) {
  return defineConfig({
    messages: {
      format: "po",
      locales: "infer",
      path: "./messages",
      sourceLocale: "en",
      ...options.messages,
    },
    model: codexCli("gpt-6.1-terra", { codexPath: getCodexPath() }),
    srcPath: getSrcPath(options.srcPath),
    styleguides: fileURLToPath(new URL("../.eloqnt", import.meta.url)),
  });
}
