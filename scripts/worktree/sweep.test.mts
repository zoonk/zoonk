import { mkdirSync, mkdtempSync, realpathSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findBuildOutputs, lastChange } from "./sweep.mts";

function makeTree(paths: string[]): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "zoonk-sweep-")));

  for (const path of paths) {
    const target = join(root, path);

    if (path.endsWith("/")) {
      mkdirSync(target, { recursive: true });
    } else {
      mkdirSync(join(target, ".."), { recursive: true });
      writeFileSync(target, "");
    }
  }

  return root;
}

describe(findBuildOutputs, () => {
  it("finds a worktree's builds and keeps its dependencies, sources and notes", () => {
    const root = makeTree([
      "node_modules/next/dist/",
      "apps/main/.next/server/",
      "apps/main/.next-e2e/cache/",
      "apps/apple/DerivedData/Make/Build/",
      "apps/android/settings.gradle.kts",
      "apps/android/build/",
      "apps/android/.gradle/",
      "apps/android/core/ui/build.gradle.kts",
      "apps/android/core/ui/build/",
      "apps/main/node_modules/.bin/",
      "packages/ui/src/build/index.ts",
      "tmp/review/build/REPORT.md",
    ]);

    expect(findBuildOutputs({ inWorktree: true, root }).toSorted()).toStrictEqual(
      [
        "apps/android/.gradle",
        "apps/android/build",
        "apps/android/core/ui/build",
        "apps/apple/DerivedData",
        "apps/main/.next",
        "apps/main/.next-e2e",
      ].map((path) => join(root, path)),
    );
  });

  it("finds builds and dependencies in a scratch folder, whatever Xcode's build folder is called", () => {
    const root = makeTree([
      "session/scratchpad/before-dd/info.plist",
      "session/scratchpad/before-dd/Build/Products/",
      "session/scratchpad/shots/home.png",
      "session/verify/node_modules/zod/",
      "task/build/lane/apple/DerivedData/SourcePackages/",
      "task/build/REPORT.md",
      "copy/apps/android/build.gradle.kts",
      "copy/apps/android/build/",
    ]);

    expect(findBuildOutputs({ inWorktree: false, root }).toSorted()).toStrictEqual(
      [
        "copy/apps/android/build",
        "session/scratchpad/before-dd",
        "session/verify/node_modules",
        "task/build/lane/apple/DerivedData",
      ].map((path) => join(root, path)),
    );
  });

  it("leaves the folders it's told to skip, such as worktrees inside a scratch folder", () => {
    const root = makeTree(["worktree/node_modules/zod/", "other/node_modules/zod/"]);

    expect(
      findBuildOutputs({ inWorktree: false, root, skip: new Set([join(root, "worktree")]) }),
    ).toStrictEqual([join(root, "other/node_modules")]);
  });
});

describe(lastChange, () => {
  it("sees a build log written a few folders down", () => {
    const root = makeTree(["DerivedData/Make/Logs/Build/run.xcactivitylog"]);
    const old = new Date("2026-01-01T00:00:00Z");

    for (const path of ["DerivedData", "DerivedData/Make", "DerivedData/Make/Logs"]) {
      utimesSync(join(root, path), old, old);
    }

    expect(lastChange(join(root, "DerivedData"))).toBeGreaterThan(old.getTime());
  });
});
