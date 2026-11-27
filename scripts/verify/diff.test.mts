import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, test } from "vitest";

test("audits branch and working tree changes without changes from the base branch's tip", () => {
  const root = mkdtempSync(join(tmpdir(), "zoonk-diff-"));

  try {
    const git = (...args: string[]) =>
      execFileSync(
        "git",
        [
          "-c",
          "commit.gpgsign=false",
          "-c",
          "user.name=Test",
          "-c",
          "user.email=test@example.com",
          ...args,
        ],
        { cwd: root },
      );

    const write = (name: string, content: string) => writeFileSync(join(root, name), content);

    cpSync(import.meta.dirname, join(root, "scripts/verify"), { recursive: true });
    const json = "packages/utils/src/json.ts";
    cpSync(resolve(import.meta.dirname, "../..", json), join(root, json));
    symlinkSync(resolve(import.meta.dirname, "../../node_modules"), join(root, "node_modules"));

    git("init", "-q", "-b", "main");
    write(".gitignore", "/scripts/\n/packages/\n/node_modules\n");
    write("main.txt", "shared base\n");
    write("working.txt", "shared base\n");
    git("add", ".gitignore", "main.txt", "working.txt");
    git("commit", "-qm", "shared base");
    git("branch", "topic");

    write("main.txt", "new on main\n");
    git("commit", "-qam", "change on main");
    git("switch", "-q", "topic");

    write("committed.txt", "committed change\n");
    git("add", "committed.txt");
    git("commit", "-qm", "change on topic");
    write("staged.txt", "staged change\n");
    git("add", "staged.txt");
    write("working.txt", "unstaged change\n");
    write("untracked.txt", "untracked change\n");

    const audit = (...args: string[]) =>
      execFileSync(process.execPath, [join(root, "scripts/verify/diff.mts"), ...args], {
        cwd: root,
        encoding: "utf8",
      });

    expect(audit("--base", "main")).toContain("4 changed files");
    expect(audit()).toContain("3 changed files");
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});
