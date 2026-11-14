import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { checkPictures } from "./check.mts";
import { type CaptureItem, type ManifestItem, type Read } from "./media.mts";

export const CLEAN: Read = { at: "2026-11-14T12:00:00.000Z", by: "reader", findings: [] };

function git(repository: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: repository, encoding: "utf8" }).trim();
}

function commitFile(repository: string, path: string, text: string): string {
  mkdirSync(dirname(join(repository, path)), { recursive: true });
  writeFileSync(join(repository, path), text);
  git(repository, "add", path);
  git(repository, "commit", "-qm", `change ${path}`);
  return git(repository, "rev-parse", "HEAD");
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * A repository where `apps/main` changed after `older` and only docs changed after `current`,
 * with captures written into it: each picture's bytes are its own name.
 */
export function checkFixture() {
  const repository = mkdtempSync(join(tmpdir(), "pr-media-check-"));
  git(repository, "init", "-q");
  git(repository, "config", "user.email", "agent@example.com");
  git(repository, "config", "user.name", "Agent");
  const older = commitFile(repository, "apps/main/page.txt", "one");
  const current = commitFile(repository, "packages/ui/row.txt", "two");
  commitFile(repository, "docs/notes.md", "unrelated");

  function shot(overrides: Partial<CaptureItem> & { file: string }): CaptureItem {
    return {
      build: { app: "main", commit: current, id: "build-1" },
      kind: "shot",
      locale: "en",
      name: overrides.file.replace(".png", ""),
      platform: "web",
      pointer: "coarse",
      read: CLEAN,
      scale: 3,
      scheme: "light",
      sha256: sha256(overrides.file),
      side: "after",
      steps: sha256("steps"),
      viewport: "phone",
      ...overrides,
    };
  }

  function capture(items: ManifestItem[], extra: { alignment?: unknown } = {}) {
    const folder = mkdtempSync(join(repository, "capture-"));

    for (const item of items) {
      writeFileSync(join(folder, item.file), item.file);
    }

    writeFileSync(join(folder, "capture.json"), JSON.stringify(items));

    if (extra.alignment) {
      writeFileSync(join(folder, "alignment.json"), JSON.stringify(extra.alignment));
    }

    return {
      check: async (files = items.map((item) => item.file)) =>
        checkPictures({
          manifests: [folder],
          pictures: files.map((file) => join(folder, file)),
          repository,
        }),
      folder,
    };
  }

  return { capture, current, older, repository, shot };
}

export function kinds(result: Awaited<ReturnType<typeof checkPictures>>): string[] {
  return result.problems.map((problem) => problem.kind);
}
