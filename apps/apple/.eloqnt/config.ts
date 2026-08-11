import { defineConfig } from "@eloqnt/cli";
import { codexCli } from "ai-sdk-provider-codex-cli";

/**
 * Points Eloqnt at a Codex CLI installed outside this repo, matching
 * `@zoonk/i18n/define-eloqnt-config`.
 */
function getCodexPath() {
  return process.env.CODEX_PATH ?? "codex";
}

/**
 * The Apple app keeps every locale in one String Catalog, so `path` points at
 * the catalog itself and `locales: "infer"` reads them from inside it. No
 * `srcPath`: Xcode extracts strings from Swift code into the catalog.
 * @internal
 */
export default defineConfig({
  messages: {
    format: { codec: "@eloqnt/format-apple-xcstrings", extension: ".xcstrings" },
    locales: "infer",
    path: "./Shared/Resources/Localization/Navigation",
    sourceLocale: "en",
  },
  model: codexCli("gpt-5.6-sol", { codexPath: getCodexPath() }),
});
