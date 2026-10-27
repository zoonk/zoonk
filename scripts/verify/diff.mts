/* oxlint-disable no-console -- This CLI prints the checklist it builds. */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { addsVulnerability, auditDependencies } from "./dependencies.mts";
import { type ChangedFile, auditDiff, parseDiff, renderAudit } from "./diff-audit.mts";

/**
 * Reads the change (`pnpm verify:diff`: uncommitted work against HEAD, or `--base <ref>` for a
 * branch) as a principal engineer, a security researcher and a designer would, and prints every
 * line they'd question with the question to answer. It exits with 1 on what must be fixed.
 */
const repository = resolve(import.meta.dirname, "../..");
const OUTPUT_LIMIT_MB = 256;
const OUTPUT_LIMIT = OUTPUT_LIMIT_MB * 1024 * 1024;
const { values } = parseArgs({ options: { base: { default: "HEAD", type: "string" } } });

function git(args: string[]): string {
  return execFileSync("git", args, { cwd: repository, encoding: "utf8", maxBuffer: OUTPUT_LIMIT });
}

function read(path: string): string {
  try {
    return readFileSync(join(repository, path), "utf8");
  } catch {
    return "";
  }
}

/** Files git doesn't track yet count as created, every line added (binary files skipped). */
const untracked: ChangedFile[] = git(["ls-files", "--others", "--exclude-standard"])
  .split("\n")
  .filter(Boolean)
  .map((path) => ({ content: read(path), path }))
  .filter(({ content }) => !content.includes("\0"))
  .map(({ content, path }) => ({
    added: content.split("\n").map((text, index) => ({ line: index + 1, text })),
    created: true,
    path,
  }));

const files = [
  ...parseDiff(git(["diff", "--unified=0", "--no-color", "--no-ext-diff", values.base, "--"])),
  ...untracked,
];

const flags = auditDiff(files, (path) => /^\s*["']use client["']/mu.test(read(path)));
const lockfile = files.find((file) => file.path === "pnpm-lock.yaml");

const dependencies = lockfile
  ? auditDependencies(
      repository,
      lockfile.added.map((added) => added.text),
    )
  : [];

const blocking =
  flags.filter((flag) => flag.rule.blocks).length + Number(addsVulnerability(dependencies));

console.log(
  [
    `# Diff audit: ${files.length} changed files against ${values.base}`,
    "",
    flags.length + dependencies.length === 0
      ? "Nothing to question."
      : "Answer each item in your report: fix it, or say why it's right. Items marked **must fix** block.",
    "",
    ...renderAudit(flags),
    ...dependencies,
  ].join("\n"),
);

process.exitCode = blocking > 0 ? 1 : 0;
