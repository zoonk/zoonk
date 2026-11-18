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
    // On 20 main-app strings in pt, es and ja (18 Nov 2026), two blind readers each ranked 6.1 Sol
    // at xhigh first or tied for first: GPT-6.2 Sol at xhigh and high lost meaning or wrote fragments
    // on 2 to 5 strings, and 6.2 Sol at medium on 6 or 7.
    model: codexCli("gpt-6.1-sol", { codexPath: getCodexPath(), reasoningEffort: "xhigh" }),
    srcPath: getSrcPath(options.srcPath),
    styleguides: fileURLToPath(new URL("../.eloqnt", import.meta.url)),
  });
}
