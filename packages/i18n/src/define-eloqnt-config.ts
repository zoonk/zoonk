import { defineConfig } from "@eloqnt/cli";
import { codexCli } from "ai-sdk-provider-codex-cli";
import { NEXT_INTL_PO_FORMAT } from "./next-intl/po-format";

type EloqntMessages = Parameters<typeof defineConfig>[0]["messages"];

// Can be extended as necessary. `messages` overrides are shallow-merged into
// the next-intl defaults so a consumer with a different message format (e.g.
// the Apple app's String Catalogs) can replace `format` and `path` while
// inheriting `locales` and `sourceLocale`. `srcPath: null` disables source
// code analysis for consumers whose messages aren't used from TypeScript.
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
 * Distinguishes "not passed" (use the `./src` default) from an explicit
 * `null` (no source code to scan, e.g. the Apple app where Xcode extracts
 * strings from Swift). Eloqnt skips source analysis when `srcPath` is absent.
 */
function getSrcPath(srcPath: EloqntProjectOptions["srcPath"]) {
  if (srcPath === null) return undefined;
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
  });
}
