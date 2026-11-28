import { execFileSync, spawnSync } from "node:child_process";

const ROOT_ENTRIES = new Set([
  ".agents",
  ".claude",
  ".codex",
  ".gitattributes",
  ".github",
  ".gitignore",
  ".ignore",
  ".mcp.json",
  ".oxfmtrc.json",
  ".oxlintrc.json",
  ".tool-versions",
  ".vercelignore",
  "AGENTS.md",
  "CODE_OF_CONDUCT.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "README.md",
  "SECURITY.md",
  "SUPPORTERS.md",
  "THIRD_PARTY_NOTICES.md",
  "apps",
  "cubic.yaml",
  "knip.json",
  "package.json",
  "packages",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "scripts",
  "skills-lock.json",
  "t3.json",
  "turbo.json",
  "vitest.config.mts",
]);

const TASK_IDENTIFIER =
  "(^|[^[:alnum:]_])(FS-D[0-9]+|RV[0-9]{2,}|FIXES-[0-9]+|cw[/]fx-[[:alnum:]_/-]*)";

export function committedSourceProblems(root: string): string[] {
  const options = { cwd: root, encoding: "utf8" } as const;
  const entries = execFileSync("git", ["ls-tree", "--name-only", "-z", "HEAD"], options);

  const problems = entries
    .split("\0")
    .filter((entry) => entry && !ROOT_ENTRIES.has(entry))
    .map((entry) => `Unexpected top-level entry: ${entry}`);

  const matches = spawnSync(
    "git",
    ["grep", "-I", "-n", "-o", "--no-color", "-E", TASK_IDENTIFIER, "HEAD", "--"],
    options,
  );

  if (matches.error) {
    throw matches.error;
  }

  if (matches.status === 1) {
    return problems;
  }

  if (matches.status !== 0) {
    throw new Error(`Could not scan committed text: ${matches.stderr.trim()}`);
  }

  return [
    ...problems,
    ...matches.stdout
      .trimEnd()
      .split("\n")
      .map((line) => line.replace(/^HEAD:/u, "")),
  ];
}
