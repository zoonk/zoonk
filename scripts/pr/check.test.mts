import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { beforeAll, describe, it } from "vitest";
import { bodyPictures, checkPictures, formatCheck } from "./check.mts";
import { type CaptureItem, type ManifestItem, type Read } from "./media.mts";

const CLEAN: Read = { at: "2026-11-14T12:00:00.000Z", by: "reader", findings: [] };

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

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** A repository where `apps/main` changed after `older` and only docs changed after `current`. */
function makeRepository() {
  const repository = mkdtempSync(join(tmpdir(), "pr-media-check-"));
  git(repository, "init", "-q");
  git(repository, "config", "user.email", "agent@example.com");
  git(repository, "config", "user.name", "Agent");
  const older = commitFile(repository, "apps/main/page.txt", "one");
  const current = commitFile(repository, "packages/ui/row.txt", "two");
  commitFile(repository, "docs/notes.md", "unrelated");
  return { current, older, repository };
}

let fixture: ReturnType<typeof makeRepository>;

beforeAll(() => {
  fixture = makeRepository();
});

function shot(overrides: Partial<CaptureItem> & { file: string }): CaptureItem {
  return {
    build: { app: "main", commit: fixture.current, id: "build-1" },
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

/** Writes each picture with its own name as its bytes, and the manifest beside them. */
function capture(items: ManifestItem[], extra: { alignment?: unknown } = {}) {
  const folder = mkdtempSync(join(fixture.repository, "capture-"));

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
        repository: fixture.repository,
      }),
    folder,
  };
}

function kinds(result: Awaited<ReturnType<typeof checkPictures>>): string[] {
  return result.problems.map((problem) => problem.kind);
}

describe("pr:media check", () => {
  it("passes after pictures bound to the current build and read, ignoring unrelated commits", async () => {
    const result = await capture([shot({ file: "today.png" })]).check();

    assert.deepEqual(result.problems, []);
    assert.equal(result.checked, 1);
  });

  it("passes an old before picture from an unknown build with no read: it is provenance only", async () => {
    const before = shot({
      build: { app: "main", changes: sha256("draft"), commit: fixture.older, id: "unknown" },
      file: "today-before.png",
      read: undefined,
      side: "before",
    });

    const result = await capture([before]).check();

    assert.deepEqual(result.problems, []);
  });

  it("fails a picture whose bytes changed since its capture", async () => {
    const { check, folder } = capture([shot({ file: "today.png" })]);
    writeFileSync(join(folder, "today.png"), "edited by hand");

    assert.deepEqual(kinds(await check()), ["changed"]);
  });

  it("fails a picture in the body that no manifest records", async () => {
    const { check, folder } = capture([shot({ file: "today.png" })]);
    writeFileSync(join(folder, "copied.png"), "gathered by hand");

    assert.deepEqual(kinds(await check(["today.png", "copied.png"])), ["unrecorded"]);
  });

  it("fails an after picture from an unknown build", async () => {
    const item = shot({
      build: { app: "main", commit: fixture.current, id: "unknown" },
      file: "a.png",
    });

    assert.deepEqual(kinds(await capture([item]).check()), ["unknown-build"]);
  });

  it("fails an after picture built with uncommitted changes", async () => {
    const build = { app: "main", changes: sha256("draft"), commit: fixture.current, id: "build-1" };

    assert.deepEqual(kinds(await capture([shot({ build, file: "a.png" })]).check()), [
      "uncommitted",
    ]);
  });

  it("fails an after picture older than a later commit to its app or the shared packages", async () => {
    const build = { app: "main", commit: fixture.older, id: "build-1" };
    const result = await capture([shot({ build, file: "a.png" })]).check();

    assert.deepEqual(kinds(result), ["stale"]);
    assert.match(result.problems[0]?.detail ?? "", /change packages\/ui\/row\.txt/u);
  });

  it("fails an after picture nobody read", async () => {
    assert.deepEqual(kinds(await capture([shot({ file: "a.png", read: undefined })]).check()), [
      "unread",
    ]);
  });

  it("fails an open finding and a fix the picture predates, and passes a granted exception", async () => {
    const read: Read = {
      ...CLEAN,
      findings: [
        { id: "a-1", state: "open", text: "the date stops short of the edge" },
        { commit: fixture.current, id: "a-2", state: "fixed", text: "the gap is 12 px" },
        { grantedBy: "the user", id: "a-3", state: "exception", text: "the day bar is 40 px" },
      ],
    };

    const build = { app: "main", commit: fixture.older, id: "build-1" };
    const result = await capture([shot({ build, file: "a.png", read })]).check();

    assert.deepEqual(kinds(result), ["stale", "finding", "fixed-not-retaken"]);
  });

  it("holds a native picture with no capture record as pending, never as passed", async () => {
    const pending: ManifestItem = {
      file: "apple-today.png",
      kind: "shot",
      platform: "apple",
      read: CLEAN,
      sha256: sha256("apple-today.png"),
      side: "after",
    };

    assert.deepEqual(kinds(await capture([pending]).check()), ["pending"]);
  });

  it("fails what the capture's alignment report leaves unresolved or missing", async () => {
    const message = '"Dec 12" ends 28 px short of the group\'s end edge';

    const alignment = {
      findings: [
        { level: "fail", message },
        { level: "fail", message },
        { exception: "the day bar, granted by the user", level: "fail", message: "40 px tall" },
        { level: "discovery", message: "cut off" },
      ],
      summary: { scenariosMissing: 1, unresolved: 2 },
    };

    const result = await capture([shot({ file: "a.png" })], { alignment }).check();

    assert.deepEqual(kinds(result), ["alignment", "scenarios"]);
    assert.equal(result.problems[0]?.detail, message);
  });

  it("prints one finding per kind with its pictures under it, then one summary line", async () => {
    const { check, folder } = capture([
      shot({ file: "a.png", read: undefined }),
      shot({ file: "b.png", read: undefined }),
    ]);

    writeFileSync(join(folder, "c.png"), "gathered by hand");
    const lines = formatCheck(await check(["a.png", "b.png", "c.png"]), folder).split("\n");

    assert.deepEqual(lines, [
      "Not in any capture manifest: take it with pnpm pr:capture (1)",
      "  c.png",
      "No read recorded: run pnpm pr:media tiles, read, then pnpm pr:media read (2)",
      "  a.png",
      "  b.png",
      "FAIL: 1 not in any capture manifest; 2 with no read, of 3 pictures",
    ]);
  });
});

describe("the pictures a PR body shows", () => {
  it("lists Markdown images and img tags once each, in order, remote ones included", () => {
    const body = [
      "| ![](media/today-before.png) | ![After: today](media/final/today.png) |",
      '<img src="media/plan.png" width="300"> and ![](media/final/today.png "again")',
      "![](https://github.com/user-attachments/assets/abc)",
      "[a link, not a picture](media/notes.md)",
    ].join("\n");

    assert.deepEqual(bodyPictures(body), [
      "media/today-before.png",
      "media/final/today.png",
      "media/plan.png",
      "https://github.com/user-attachments/assets/abc",
    ]);
  });
});
