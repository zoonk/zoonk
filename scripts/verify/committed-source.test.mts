import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { expect, test } from "vitest";
import { committedSourceProblems } from "./committed-source.mts";

test("reports unknown root entries and each kind of task identifier in committed text", () => {
  const root = mkdtempSync(join(tmpdir(), "committed-source-"));

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

    const markers = [
      ["FS-D", "35"].join(""),
      ["RV", "79"].join(""),
      ["FIXES-", "4"].join(""),
      ["cw", "fx-local"].join("/"),
    ];

    git("init", "-q");

    for (const [file, text] of Object.entries({
      "SWEEP/status.md": "Pending work",
      "handoff.md": "Completed work",
      "scripts/probe.mts": markers.join("\n"),
    })) {
      const path = join(root, file);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, text);
    }

    git("add", "SWEEP/status.md", "handoff.md", "scripts/probe.mts");
    git("commit", "-qm", "fixture");

    expect(committedSourceProblems(root)).toStrictEqual([
      "Unexpected top-level entry: SWEEP",
      "Unexpected top-level entry: handoff.md",
      ...markers.map((marker, index) => `scripts/probe.mts:${index + 1}:${marker}`),
    ]);

    git("rm", "-qr", "SWEEP", "handoff.md");
    writeFileSync(join(root, "scripts/probe.mts"), `sha512-aT${markers[1]}P5==\n`);
    git("commit", "-qam", "clean fixture");

    writeFileSync(join(root, "scripts/probe.mts"), markers.join("\n"));
    writeFileSync(join(root, "untracked.md"), markers.join("\n"));
    git("add", "scripts/probe.mts");
    expect(committedSourceProblems(root)).toStrictEqual([]);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});
