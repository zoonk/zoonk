import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { prepareStudio, repo } from "./prepare-studio.mjs";

const studio = mkdtempSync(path.join(tmpdir(), "zoonk-studio-check-"));

try {
  prepareStudio(studio, 0);
  const fonts = path.join(repo, "packages/player/src/_test-utils/fonts");
  const assets = path.join(studio, "assets/fonts");
  mkdirSync(assets, { recursive: true });
  cpSync(path.join(fonts, "geist-latin.woff2"), path.join(assets, "GeistVF.woff2"));
  cpSync(path.join(fonts, "geist-mono-latin.woff2"), path.join(assets, "GeistMonoVF.woff2"));

  for (const script of ["typecheck.mjs", "render-check.mjs"]) {
    execFileSync(process.execPath, [path.join(studio, "scripts", script)], {
      cwd: studio,
      stdio: "inherit",
    });
  }
} finally {
  rmSync(studio, { force: true, recursive: true });
}
