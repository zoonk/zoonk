import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative, resolve } from "node:path";
import { z } from "zod";

const ROOT = resolve(import.meta.dirname, "..");

const manifestSchema = z.object({ dependencies: z.record(z.string(), z.string()).default({}) });

function readOptional(path: string): string | null {
  return statSync(path, { throwIfNoEntry: false })?.isFile() ? readFileSync(path, "utf8") : null;
}

function dependsOnNext(appDir: string): boolean {
  const manifest = readOptional(join(appDir, "package.json"));
  return manifest !== null && "next" in manifestSchema.parse(JSON.parse(manifest)).dependencies;
}

const NEXT_APPS = readdirSync(join(ROOT, "apps"))
  .map((name) => join(ROOT, "apps", name))
  .filter((appDir) => dependsOnNext(appDir));

const AGENT_FILES = [ROOT, ...NEXT_APPS].map((dir) => join(dir, "AGENTS.md"));

function syncNextRules(appDir: string) {
  const require = createRequire(join(appDir, "package.json"));
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the writer agent-run `next dev` calls, which its block names.
  const { writeAgentFiles } = require("next/dist/server/lib/generate-agent-files.js") as {
    writeAgentFiles: (dir: string) => unknown;
  };

  writeAgentFiles(appDir);
}

function syncTurboRules() {
  // turbo has no command for its block: it refreshes it before any repository command, only when it detects an agent.
  execFileSync("turbo", ["ls"], {
    cwd: ROOT,
    env: { ...process.env, AI_AGENT: process.env.AI_AGENT ?? "agent-rules" },
    stdio: "ignore",
  });
}

function restore({ path, content }: { path: string; content: string | null }) {
  if (content === null) {
    rmSync(path, { force: true });
    return;
  }

  writeFileSync(path, content);
}

const before = AGENT_FILES.map((path) => ({ content: readOptional(path), path }));

for (const appDir of NEXT_APPS) {
  syncNextRules(appDir);
}

syncTurboRules();

if (process.argv.includes("--check")) {
  const stale = before.filter(({ content, path }) => readOptional(path) !== content);

  for (const file of stale) {
    restore(file);
  }

  if (stale.length > 0) {
    const paths = stale.map(({ path }) => relative(ROOT, path)).join(", ");

    throw new Error(
      `Agent rules are stale in ${paths}. Run pnpm agent-rules:sync and commit them.`,
    );
  }
}
