import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";

/**
 * Next loads prompt files with raw-loader; this does the same for the eval scripts so tasks can
 * import `*.prompt.md` as a string outside the Next build.
 */
registerHooks({
  load(url, context, nextLoad) {
    if (!url.endsWith(".md")) {
      return nextLoad(url, context);
    }

    const source = readFileSync(new URL(url), "utf8");

    return {
      format: "module",
      shortCircuit: true,
      source: `export default ${JSON.stringify(source)};`,
    };
  },
});
