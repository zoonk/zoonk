import { defineConfig } from "@eloqnt/cli";

// Can be extended as necessary
type EloqntProjectOptions = { srcPath?: string | string[] };

/**
 * Shares configuration for consumers while allowing local overrides.
 * @public
 */
export default function defineEloqntConfig(options: EloqntProjectOptions = {}) {
  return defineConfig({
    messages: { format: "po", locales: "infer", path: "./messages", sourceLocale: "en" },
    srcPath: options.srcPath ?? "./src",
  });
}
