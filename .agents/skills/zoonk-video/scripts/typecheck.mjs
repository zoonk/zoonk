// npm run typecheck: the harness's views against the app's current contracts. Run it after pulling.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const studio = path.dirname(import.meta.dirname);
const { repo } = JSON.parse(readFileSync(path.join(studio, "studio.json"), "utf8"));

try {
  execFileSync(path.join(repo, "node_modules/.bin/tsc"), ["-p", "realui/tsconfig.json"], {
    cwd: studio,
    stdio: "inherit",
  });
  console.log("Views match the app's contracts.");
} catch {
  console.error(
    "\nA view no longer matches the app. Fix it before filming: a drifted view draws wrong numbers.",
  );
  process.exit(1);
}
