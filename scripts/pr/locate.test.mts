import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "vitest";
import { findManifests, manifestsAbove } from "./locate.mts";

describe("where the check looks for capture manifests", () => {
  it("walks up from each picture, and searches named folders without node_modules", async () => {
    const root = mkdtempSync(join(tmpdir(), "pr-media-find-"));

    for (const folder of ["tmp/pr-media/after", "elsewhere", "node_modules/pkg"]) {
      mkdirSync(join(root, folder), { recursive: true });
      writeFileSync(join(root, folder, "capture.json"), "[]");
    }

    const picture = join(root, "tmp/pr-media/after/phone/light/today.png");

    assert.deepEqual(manifestsAbove([picture]), [join(root, "tmp/pr-media/after")]);

    assert.deepEqual(await findManifests(root), [
      join(root, "elsewhere"),
      join(root, "tmp/pr-media/after"),
    ]);
  });
});
