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
 * A String Catalog keeps every locale in one file, so `path` has no
 * `{locale}` placeholder and `locales: "infer"` reads them from inside the
 * catalogs. `{namespace}` matches each catalog by filename (currently only
 * `Navigation.xcstrings`), so new catalogs are picked up without config
 * changes. No `srcPath`: Xcode extracts strings from Swift code into the
 * catalogs.
 * @internal
 */
export default defineConfig({
  messages: {
    format: { codec: "@eloqnt/format-apple-xcstrings", extension: ".xcstrings" },
    locales: "infer",
    path: "./Shared/Resources/Localization/{namespace}",
    sourceLocale: "en",
  },
  model: codexCli("gpt-5.6-sol", { codexPath: getCodexPath() }),
});
