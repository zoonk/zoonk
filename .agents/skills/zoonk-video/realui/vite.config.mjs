import { readFileSync } from "node:fs";
import path from "node:path";
// Serves the app's own components outside Next: npm run harness (from the studio).
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import catalogLoader from "next-intl/extractor/catalogLoader";
import extractionLoader from "next-intl/extractor/extractionLoader";

const studio = path.dirname(import.meta.dirname);
const { repo } = JSON.parse(readFileSync(path.join(studio, "studio.json"), "utf8"));
const shims = path.join(repo, "packages/player/src/_test-utils/shims");

/** Runs one of next-intl's webpack loaders, the ones Main's build uses. */
function runLoader(loader, source, resourcePath, options) {
  return new Promise((resolve, reject) => {
    const context = {
      async: () => (error, code) => (error ? reject(error) : resolve({ code, map: null })),
      getOptions: () => options,
      resourcePath,
      rootContext: repo,
      sourceMap: false,
    };
    loader.call(context, source);
  });
}

/** Compiles `useExtracted` calls and `.po` catalogs as next-intl does in Main's build. */
const nextIntlMessages = {
  name: "next-intl-messages",
  enforce: "pre",
  transform(code, id) {
    const file = id.split("?")[0];
    if (file.endsWith(".po")) {
      return runLoader(catalogLoader, code, file, {
        messages: { format: "po", precompile: false, sourceLocale: "en" },
      });
    }
    if (/\.[jt]sx?$/.test(file) && /\b(useExtracted|getExtracted)\b/.test(code)) {
      return runLoader(extractionLoader, code, file, {});
    }
    return null;
  },
};

export default {
  root: import.meta.dirname,
  publicDir: path.join(studio, "assets"),
  logLevel: "warn",
  plugins: [nextIntlMessages, react(), tailwindcss()],
  resolve: {
    alias: [
      { find: /^@repo\//, replacement: `${repo}/` },
      { find: /^next\/image$/, replacement: path.join(shims, "next-image.tsx") },
      { find: /^web-haptics\/react$/, replacement: path.join(shims, "web-haptics-react.ts") },
    ],
    dedupe: ["react", "react-dom"],
  },
  // Overlays and reloads blank the frame mid-capture.
  server: { fs: { strict: false }, hmr: { overlay: false }, port: 5199, strictPort: true },
};
