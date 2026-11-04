import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { readModes, readTailwindPalette } from "./palette.mts";
import { readSubjects } from "./subject-palette.mts";

export function readPalette() {
  const repoRoot = new URL("../../../../", import.meta.url);
  const globalsCss = readFileSync(new URL("packages/ui/src/styles/globals.css", repoRoot), "utf8");

  const tailwindTheme = createRequire(new URL("packages/ui/package.json", repoRoot)).resolve(
    "tailwindcss/theme.css",
  );

  return {
    palette: readTailwindPalette(readFileSync(tailwindTheme, "utf8")),
    subjects: readSubjects(globalsCss),
    tokens: readModes(globalsCss),
  };
}
