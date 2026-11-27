import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { instructionFileProblems } from "./instruction-files.mts";

const roots: string[] = [];

const SMALL_BUDGET = 200;
const CEILING = 500;
const PADDING = 400;
const MANY_WORDS = 200;

function repository(files: Record<string, string>, linkedSkills: string[] = []): string {
  const root = mkdtempSync(join(tmpdir(), "instruction-files-"));

  roots.push(root);

  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
  }

  mkdirSync(join(root, ".claude/skills"), { recursive: true });

  for (const name of linkedSkills) {
    symlinkSync(join("../../.agents/skills", name), join(root, ".claude/skills", name));
  }

  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

test("passes small files whose links, anchors and skill symlinks resolve", () => {
  const root = repository(
    {
      ".agents/guides/checks.md": "# Checks\n\n## Before a commit\n\nRun them.\n",
      ".agents/skills/verify/SKILL.md":
        "# Verify\n\nSee [checks](../../guides/checks.md#before-a-commit), [the top](#verify) and `[not a link](missing.md)`.\n\n```md\n[also not a link](missing.md)\n```\n",
      "AGENTS.md":
        "# Root\n\n[Checks](.agents/guides/checks.md) and [a site](https://example.com).\n",
    },
    ["verify"],
  );

  expect(instructionFileProblems(root, { overBudget: {} })).toStrictEqual([]);
});

test("reports a link to a missing file and a link to a missing heading", () => {
  const root = repository({
    ".agents/guides/checks.md": "# Checks\n\n## Before a commit\n",
    "AGENTS.md":
      "# Root\n\n[gone](.agents/guides/gone.md) [moved](.agents/guides/checks.md#before-a-pr)\n",
  });

  expect(instructionFileProblems(root, { overBudget: {} })).toStrictEqual([
    "AGENTS.md: the link to .agents/guides/gone.md points at a file that doesn't exist",
    "AGENTS.md: the link to .agents/guides/checks.md#before-a-pr names a heading .agents/guides/checks.md doesn't have",
  ]);
});

test("numbers a repeated heading the way GitHub does", () => {
  const root = repository({
    ".agents/guides/checks.md": "# Checks\n\n## Run it\n\n## Run it\n",
    "AGENTS.md": "# Root\n\n[second](.agents/guides/checks.md#run-it-1)\n",
  });

  expect(instructionFileProblems(root, { overBudget: {} })).toStrictEqual([]);
});

test("holds each file to its budget, ignoring the padding a formatter adds to tables", () => {
  const padded = `# Guide\n\n| A${" ".repeat(PADDING)} |\n| ${"-".repeat(PADDING)} |\n`;

  const root = repository({
    ".agents/guides/long.md": `# Long\n\n${"word ".repeat(60)}\n`,
    ".agents/guides/padded.md": padded,
    "AGENTS.md": `# Root\n\n${"word ".repeat(60)}\n`,
    "apps/main/AGENTS.md": `# Main\n\n${"word ".repeat(60)}\n`,
  });

  const problems = instructionFileProblems(root, {
    fileBytes: SMALL_BUDGET,
    overBudget: { "apps/main/AGENTS.md": CEILING },
    rootBytes: SMALL_BUDGET,
  });

  expect(problems).toHaveLength(2);
  expect(problems[0]).toContain("AGENTS.md is 309 bytes, over its 200");
  expect(problems[1]).toContain(".agents/guides/long.md is 309 bytes, over the 200");
});

test("holds a file waiting to be split to its own ceiling, and asks to drop it once it fits or is gone", () => {
  const root = repository({
    ".agents/guides/grown.md": `# Grown\n\n${"word ".repeat(MANY_WORDS)}\n`,
    ".agents/guides/split.md": "# Split\n",
    "AGENTS.md": "# Root\n",
  });

  const problems = instructionFileProblems(root, {
    fileBytes: SMALL_BUDGET,
    overBudget: {
      ".agents/guides/grown.md": CEILING,
      ".agents/guides/removed.md": CEILING,
      ".agents/guides/split.md": CEILING,
    },
  });

  expect(problems).toStrictEqual([
    ".agents/guides/grown.md is 1010 bytes, over the 500 it may hold until it's split. Split it: move what not every task needs into its own file and link it, then lower this ceiling.",
    ".agents/guides/split.md is under the budget now: remove it from OVER_BUDGET_UNTIL_SPLIT.",
    ".agents/guides/removed.md is gone: remove it from OVER_BUDGET_UNTIL_SPLIT.",
  ]);
});

test("leaves an installed skill's files alone but still asks for its symlink", () => {
  const root = repository({
    ".agents/skills/installed/SKILL.md": `# Installed\n\n[broken](missing.md)\n\n${"word ".repeat(MANY_WORDS)}\n`,
    "AGENTS.md": "# Root\n",
    "skills-lock.json": JSON.stringify({ skills: { installed: {} }, version: 1 }),
  });

  expect(instructionFileProblems(root, { fileBytes: SMALL_BUDGET, overBudget: {} })).toStrictEqual([
    ".claude/skills/installed doesn't resolve to .agents/skills/installed: add its relative symlink.",
  ]);
});
