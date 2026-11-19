import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "vitest";
import { checkPictures } from "./check.mts";
import {
  type CaptureItem,
  type ManifestItem,
  readManifest,
  readOf,
  registerItems,
} from "./media.mts";
import { parseFindings, recordReads } from "./read.mts";

/** The reader's sort, made after its blind pass. */
const SORTED = { before: false, misleads: false, rule: "E9" };

/** A repository whose HEAD built two pictures with the same bytes, nobody's read yet. */
function twoEqualPictures() {
  const root = mkdtempSync(join(tmpdir(), "pr-media-read-"));
  execFileSync("git", ["init", "-q"], { cwd: root });

  execFileSync(
    "git",
    [
      "-c",
      "user.email=a@example.com",
      "-c",
      "user.name=A",
      "commit",
      "-q",
      "--allow-empty",
      "-m",
      "start",
    ],
    { cwd: root },
  );

  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const folder = join(root, "after");
  mkdirSync(folder);

  const items: CaptureItem[] = ["first", "second"].map((name) => {
    writeFileSync(join(folder, `${name}.png`), "the same loading screen");

    return {
      build: { app: "main", commit, id: "build" },
      file: `${name}.png`,
      kind: "shot",
      locale: "en",
      name,
      platform: "web",
      pointer: "coarse",
      scale: 3,
      scheme: "light",
      sha256: createHash("sha256").update("the same loading screen").digest("hex"),
      side: "after",
      steps: "steps",
      viewport: "phone",
    };
  });

  writeFileSync(join(folder, "capture.json"), JSON.stringify(items));
  return { folder, root };
}

describe("recording a read", () => {
  it("takes a finding only once the reader has sorted it", () => {
    const entry = { file: "after/first.png", text: "The spinner sits off center" };

    const [parsed] = parseFindings([{ ...entry, ...SORTED }]) ?? [];
    const { before, misleads, rule, state } = parsed?.finding ?? {};

    assert.deepEqual(parsed?.files, [entry.file]);
    assert.deepEqual({ before, misleads, rule, state }, { ...SORTED, state: "open" });

    assert.equal(parseFindings([entry]), undefined);
    assert.equal(parseFindings([{ ...entry, ...SORTED, before: "yes" }]), undefined);
  });

  it("attaches a finding to the picture the reader named, and the gate holds its pixels to it", async () => {
    const { folder, root } = twoEqualPictures();

    const entries =
      parseFindings([
        { ...SORTED, file: "after/first.png", text: "The spinner sits off center" },
      ]) ?? [];

    await recordReads({ by: "reader", entries, root });

    const items = (await readManifest(folder)) ?? [];

    const result = await checkPictures({
      manifests: [folder],
      pictures: [join(folder, "first.png"), join(folder, "second.png")],
      repository: root,
    });

    assert.deepEqual(
      items.map((item) => [item.file, readOf(item)?.findings.length]),
      [
        ["first.png", 1],
        ["second.png", 0],
      ],
    );

    assert.deepEqual(
      result.problems.map(({ kind, picture }) => [kind, picture]),
      [
        ["finding", join(folder, "first.png")],
        ["finding", join(folder, "second.png")],
      ],
    );
  });

  it("keeps the findings already on a picture when a read replaces one with no name", async () => {
    const { folder, root } = twoEqualPictures();
    const [first, second] = (await readManifest(folder)) ?? [];
    const open = { id: "kept-1", state: "open" as const, text: "Known unresolved fault" };
    const unnamed = { at: "2026-11-14T12:00:00.000Z", by: "", findings: [open] };

    writeFileSync(
      join(folder, "capture.json"),
      JSON.stringify([{ ...first, read: unnamed }, second]),
    );

    await recordReads({ by: "reader", entries: [], root });

    const [reread] = (await readManifest(folder)) ?? [];

    const result = await checkPictures({
      manifests: [folder],
      pictures: [join(folder, "first.png")],
      repository: root,
    });

    assert.deepEqual(reread && readOf(reread)?.findings, [open]);

    assert.deepEqual(
      result.problems.map(({ kind }) => kind),
      ["finding"],
    );
  });

  it("keeps the findings of the read a retake replaced, and marks its read as a check of the fixes", async () => {
    const { folder, root } = twoEqualPictures();
    const [first, second] = (await readManifest(folder)) ?? [];

    const fixed = {
      ...SORTED,
      commit: "c0ffee",
      id: "fixed-1",
      state: "fixed" as const,
      text: "a",
    };

    const filed = { ...SORTED, id: "filed-1", issue: 2790, state: "issue" as const, text: "b" };
    const earlier = { at: "2026-11-14T12:00:00.000Z", by: "reader", findings: [fixed, filed] };
    const retakes = { file: "earlier/first.png", read: earlier };
    writeFileSync(join(folder, "capture.json"), JSON.stringify([{ ...first, retakes }, second]));

    const entries =
      parseFindings([{ ...SORTED, file: "after/first.png", text: "The fix moved the title" }]) ??
      [];

    await recordReads({ by: "another reader", entries, root });
    const [retaken] = (await readManifest(folder)) ?? [];
    const read = retaken && readOf(retaken);

    assert.deepEqual(
      read?.findings.map(({ state, text }) => [state, text]),
      [
        ["fixed", "a"],
        ["issue", "b"],
        ["open", "The fix moved the title"],
      ],
    );

    assert.equal(read?.retake, true);
  });

  it("opens again a fixed finding the check of the fixes reports again", async () => {
    const { folder, root } = twoEqualPictures();
    const [first, second] = (await readManifest(folder)) ?? [];

    const entries =
      parseFindings([{ ...SORTED, file: "after/first.png", text: "Cut title" }]) ?? [];

    const [reported] = entries;
    const fixed = reported && { ...reported.finding, commit: "c0ffee", state: "fixed" as const };
    const earlier = { at: "2026-11-14T12:00:00.000Z", by: "reader", findings: [fixed] };
    const retakes = { file: "earlier/first.png", read: earlier };
    writeFileSync(join(folder, "capture.json"), JSON.stringify([{ ...first, retakes }, second]));

    await recordReads({ by: "another reader", entries, root });
    const [retaken] = (await readManifest(folder)) ?? [];

    assert.deepEqual(retaken && readOf(retaken)?.findings.map(({ state }) => state), ["open"]);
  });

  it("keeps a picture's read and findings when it is registered again", async () => {
    const root = mkdtempSync(join(tmpdir(), "pr-media-register-"));
    const folder = join(root, "native");
    mkdirSync(folder);
    writeFileSync(join(folder, "after.png"), "an android screen");
    const sha256 = createHash("sha256").update("an android screen").digest("hex");

    const pending: ManifestItem = {
      file: "after.png",
      kind: "shot",
      platform: "android",
      sha256,
      side: "after",
    };

    await registerItems(folder, [pending]);

    const entries =
      parseFindings([
        { ...SORTED, file: "native/after.png", text: "The note sits under the status" },
      ]) ?? [];

    await recordReads({ by: "reader", entries, root });
    await registerItems(folder, [pending]);

    const [item] = (await readManifest(folder)) ?? [];

    assert.deepEqual(item && readOf(item)?.findings.map(({ text }) => text), [
      "The note sits under the status",
    ]);
  });

  it("never replaces a capture's record with one registered by hand", async () => {
    const { folder } = twoEqualPictures();
    const [first] = (await readManifest(folder)) ?? [];

    const pending: ManifestItem = {
      file: "first.png",
      kind: "shot",
      platform: "android",
      sha256: "other",
      side: "after",
    };

    await registerItems(folder, [pending]);
    const items = (await readManifest(folder)) ?? [];

    assert.deepEqual(items[0], first);
  });

  it("refuses a read with no reader's name", async () => {
    const { root } = twoEqualPictures();

    await assert.rejects(recordReads({ by: "  ", entries: [], root }), /who read/u);
  });
});
