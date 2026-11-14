import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "vitest";
import { checkPictures } from "./check.mts";
import { type CaptureItem, readManifest, readOf } from "./media.mts";
import { parseFindings, recordReads } from "./read.mts";

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
  it("attaches a finding to the picture the reader named, and the gate holds its pixels to it", async () => {
    const { folder, root } = twoEqualPictures();

    const entries =
      parseFindings([{ file: "after/first.png", text: "The spinner sits off center" }]) ?? [];

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

  it("refuses a read with no reader's name", async () => {
    const { root } = twoEqualPictures();

    await assert.rejects(recordReads({ by: "  ", entries: [], root }), /who read/u);
  });
});
