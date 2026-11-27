import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "vitest";
import { CLEAN, checkFixture, kinds, sha256 } from "./check-fixture.mts";
import { type ManifestItem, type Read } from "./media.mts";
import { formatCheck } from "./report.mts";

const fixture = checkFixture();
const { capture, shot } = fixture;

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

  it("passes an after picture when later commits change only tests, which never reach a screen", async () => {
    const tested = checkFixture();
    const picture = tested.capture([tested.shot({ file: "a.png" })]);

    for (const path of [
      "apps/main/e2e/saved-lessons.test.ts",
      "apps/main/e2e/fixtures.ts",
      "packages/core/src/plans/plan.test.ts",
      "packages/core/src/plans/_test-utils/plan.ts",
      "packages/player/src/_browser-tests/choice.test.tsx",
      "apps/main/__mocks__/server-only.ts",
      "apps/main/vitest.config.mts",
      "apps/main/playwright.config.ts",
    ]) {
      tested.commit(path);
    }

    const afterTests = await picture.check();

    assert.deepEqual(afterTests.problems, []);
    tested.commit("packages/core/src/plans/plan.ts");
    assert.deepEqual(kinds(await picture.check()), ["stale"]);
  });

  it("fails an after picture after a commit to .gitattributes, which decides what counts", async () => {
    const marked = checkFixture();
    const picture = marked.capture([marked.shot({ file: "a.png" })]);
    const current = await picture.check();

    marked.commit(".gitattributes");

    assert.deepEqual(current.problems, []);
    assert.deepEqual(kinds(await picture.check()), ["stale"]);
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
        { id: "a-4", issue: 2790, state: "issue", text: "the chevrons end 4 px apart" },
        { id: "a-5", reason: "the seed's date", state: "not-a-fault", text: "the date is Nov 16" },
      ],
    };

    const build = { app: "main", commit: fixture.older, id: "build-1" };
    const result = await capture([shot({ build, file: "a.png", read })]).check();

    assert.deepEqual(kinds(result), ["stale", "finding", "fixed-not-retaken"]);
  });

  it("passes the records written before findings were sorted, and counts how each closed", async () => {
    const read: Read = {
      ...CLEAN,
      findings: [
        { commit: fixture.current, id: "a-1", state: "fixed", text: "the gap is 12 px" },
        { grantedBy: "the user", id: "a-2", state: "exception", text: "the day bar is 40 px" },
        { id: "a-3", issue: 2790, state: "issue", text: "the chevrons end 4 px apart" },
      ],
    };

    const { check, folder } = capture([
      shot({ file: "a.png", read }),
      shot({ file: "b.png", read: { ...read, findings: read.findings.slice(0, 1) } }),
    ]);

    const result = await check();
    const lines = formatCheck(result, folder).split("\n");

    assert.deepEqual(result.problems, []);

    assert.ok(
      lines.includes(
        "Findings: 1 fixed, 1 filed in an issue, 1 by an exception the user granted; pnpm pr:media closed prints the PR's list of those not fixed",
      ),
    );
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

  it("passes an existing before picture registered by hand with where it came from", async () => {
    const registered: ManifestItem = {
      file: "today-before.png",
      kind: "shot",
      platform: "web",
      sha256: sha256("today-before.png"),
      side: "before",
      source: "B1/shots/before/today-learn-maya-top-phone.png",
    };

    const result = await capture([registered]).check();

    assert.deepEqual(result.problems, []);
  });
});

describe("pr:media check, on a native app's build stamp", () => {
  const apple = checkFixture();
  const stamp = { changesDigest: "", commit: apple.current, dirty: false };
  const picture = { file: "settings.png", platform: "apple" as const, scale: 3 };

  it("fails an Apple picture built with uncommitted changes", async () => {
    const dirty = { ...stamp, changesDigest: sha256("draft"), dirty: true };
    const result = await apple.capture([apple.shot({ ...picture, build: dirty })]).check();

    assert.deepEqual(kinds(result), ["uncommitted"]);
  });

  it("passes a clean Apple picture until a commit changes the Apple app", async () => {
    const clean = apple.capture([apple.shot({ ...picture, build: stamp })]);
    const current = await clean.check();

    apple.commit("apps/apple/App.swift");

    assert.deepEqual(current.problems, []);
    assert.deepEqual(kinds(await clean.check()), ["stale"]);
  });
});

describe("pr:media check, on an Android render's build stamp", () => {
  const android = checkFixture();
  const picture = { file: "plan-phone.png", platform: "android" as const, scale: 2.625 };
  const stamp = { commit: android.current, uncommitted: "clean" };

  it("fails a render from an uncommitted tree, or one whose cleanliness wasn't recorded", async () => {
    const results = await Promise.all(
      [sha256("draft"), "unknown"].map(async (uncommitted) =>
        android.capture([android.shot({ ...picture, build: { ...stamp, uncommitted } })]).check(),
      ),
    );

    assert.deepEqual(
      results.map((result) => kinds(result)),
      [["uncommitted"], ["uncommitted"]],
    );
  });

  it("passes a clean render until a commit changes the Android app", async () => {
    const clean = android.capture([android.shot({ ...picture, build: stamp })]);
    const current = await clean.check();

    android.commit("apps/android/Plan.kt");

    assert.deepEqual(current.problems, []);
    assert.deepEqual(kinds(await clean.check()), ["stale"]);
  });

  it.each([
    "apps/android/app/src/testDebug/kotlin/PlanScreenshots.kt",
    "apps/android/feature/today/src/test/kotlin/TodayFlowTest.kt",
  ])("counts a commit to %s, test code that draws renders", async (path) => {
    const drawn = checkFixture();
    const render = drawn.shot({ ...picture, build: { ...stamp, commit: drawn.current } });
    const clean = drawn.capture([render]);
    const current = await clean.check();

    drawn.commit(path);

    assert.deepEqual(current.problems, []);
    assert.deepEqual(kinds(await clean.check()), ["stale"]);
  });
});
