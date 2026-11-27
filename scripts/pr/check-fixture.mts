import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterAll, onTestFinished } from "vitest";
import { checkPictures } from "./check.mts";
import { type CaptureItem, type ManifestItem, type Read } from "./media.mts";

export const CLEAN: Read = { at: "2026-11-14T12:00:00.000Z", by: "reader", findings: [] };

/** The fixture's commits are dated from here, a minute apart: no test reads the real clock. */
const FIRST_COMMIT = Date.parse("2026-01-01T12:00:00.000Z");
const MINUTE = 60_000;

/** Inside a test the folder goes when the test ends; a fixture a file or `describe` shares goes after them all. */
function removeAfterUse(folder: string) {
  const remove = () => rmSync(folder, { force: true, recursive: true });

  try {
    onTestFinished(remove);
  } catch {
    afterAll(remove);
  }
}

function git(repository: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: repository, encoding: "utf8" }).trim();
}

function commitFile(repository: string, path: string, text: string, at: number): string {
  mkdirSync(dirname(join(repository, path)), { recursive: true });
  writeFileSync(join(repository, path), text);
  git(repository, "add", path);
  const date = `${at / 1000} +0000`;

  execFileSync("git", ["commit", "-qm", `change ${path}`], {
    cwd: repository,
    env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
  });

  return git(repository, "rev-parse", "HEAD");
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function commitHistory() {
  const repository = mkdtempSync(join(tmpdir(), "pr-media-history-"));
  git(repository, "init", "-q");
  git(repository, "config", "user.email", "agent@example.com");
  git(repository, "config", "user.name", "Agent");
  const attributes = readFileSync(resolve(import.meta.dirname, "../../.gitattributes"), "utf8");
  commitFile(repository, ".gitattributes", attributes, FIRST_COMMIT - MINUTE);
  const older = commitFile(repository, "apps/main/page.txt", "one", FIRST_COMMIT);
  const current = commitFile(repository, "packages/ui/row.txt", "two", FIRST_COMMIT + MINUTE);
  commitFile(repository, "docs/notes.md", "unrelated", FIRST_COMMIT + 2 * MINUTE);
  return { current, older, repository };
}

/**
 * Committed once per test file, while it loads, and copied for each fixture: a busy runner can
 * take seconds over a dozen git processes, which a test's own time limit shouldn't pay for.
 */
const history = commitHistory();
removeAfterUse(history.repository);

/**
 * A repository where `apps/main` changed after `older` and only docs changed after `current`,
 * with captures written into it: each picture's bytes are its own name. `changedAt` is when its
 * code last changed (`packages/`, at `current`), from the fixture's own dates. It marks files with
 * the repository's own `.gitattributes`, and `commit` adds a later commit of one file.
 */
export function checkFixture() {
  const { current, older } = history;
  const repository = mkdtempSync(join(tmpdir(), "pr-media-check-"));
  removeAfterUse(repository);
  cpSync(history.repository, repository, { recursive: true });
  const changedAt = new Date(FIRST_COMMIT + MINUTE);

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

  const commit = (path: string) =>
    commitFile(repository, path, "changed", FIRST_COMMIT + 3 * MINUTE);

  return { capture, changedAt, commit, current, older, repository, shot };
}

export function kinds(result: Awaited<ReturnType<typeof checkPictures>>): string[] {
  return result.problems.map((problem) => problem.kind);
}
