import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { hash, hashJson } from "./identity";

const root = path.resolve(import.meta.dirname, "../../../../..");

// A resumed comparison can reach a case it has never rendered. Pin its generation source before
// the first call so that case cannot silently introduce a new prompt version.
export function generationSourceHash() {
  const files = execFileSync(
    "git",
    [
      "ls-files",
      "-z",
      "--cached",
      "--others",
      "--exclude-standard",
      "--",
      "apps/evals/src/lib",
      "apps/evals/src/tasks",
      "apps/evals/package.json",
      ":(glob)packages/*/src/**",
      ":(glob)packages/*/package.json",
      "pnpm-lock.yaml",
    ],
    { cwd: root, encoding: "utf8" },
  );

  return hashJson(
    [...new Set(files.split("\0").filter(Boolean))].toSorted().flatMap((file) => {
      const absolute = path.join(root, file);
      return existsSync(absolute) ? [[file, hash(readFileSync(absolute))]] : [];
    }),
  );
}
