/**
 * Runs core's server code in plain Node for seed scripts
 * (`tsx --conditions=react-server --import=./scripts/seed/node-runtime.mjs <script>`): `.md`
 * imports (AI task prompts) load as their text, as the apps' bundlers and Vitest load them, and
 * `next/cache` is a stand-in with nothing to tag or expire outside a request (`next-cache-stub.mjs`).
 */
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

const NEXT_CACHE_STUB = new URL("next-cache-stub.mjs", import.meta.url).href;

registerHooks({
  load(url, context, nextLoad) {
    if (!url.endsWith(".md")) {
      return nextLoad(url, context);
    }

    const text = readFileSync(fileURLToPath(url), "utf8");

    return {
      format: "module",
      shortCircuit: true,
      source: `export default ${JSON.stringify(text)};`,
    };
  },
  resolve(specifier, context, nextResolve) {
    return specifier === "next/cache"
      ? { shortCircuit: true, url: NEXT_CACHE_STUB }
      : nextResolve(specifier, context);
  },
});
