import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "vitest";
import { z } from "zod";
import { adoptRenders } from "./adopt.mts";
import { checkFixture, kinds, sha256 } from "./check-fixture.mts";
import { checkPictures } from "./check.mts";
import { readManifest } from "./media.mts";

const fixture = checkFixture();

/**
 * A real render's layout file (`PlanScreenshots.phone` with `-Pzoonk.shots`), its picture stood in
 * by a few bytes whose hash it records, built from `commit` with `uncommitted` changes or none.
 */
function render(build: { commit?: string; uncommitted: string }, bytes = "plan picture") {
  const folder = mkdtempSync(join(fixture.repository, "render-"));
  const text = readFileSync(join(import.meta.dirname, "fixtures/android-plan-phone.json"), "utf8");
  const capture = z.record(z.string(), z.unknown()).parse(JSON.parse(text));

  writeFileSync(join(folder, "plan-phone.png"), bytes);

  const picture = {
    build: { commit: fixture.current, ...build },
    file: "plan-phone.png",
    sha256: sha256("plan picture"),
  };

  writeFileSync(join(folder, "plan-phone.json"), JSON.stringify({ ...capture, picture }));
  return join(folder, "plan-phone.json");
}

async function adoptAndCheck(renders: string[]) {
  const to = mkdtempSync(join(fixture.repository, "capture-"));
  await adoptRenders({ renders, side: "after", to });

  const result = await checkPictures({
    manifests: [to],
    pictures: [join(to, "plan-phone.png")],
    repository: fixture.repository,
  });

  return { result, to };
}

describe("pr:media adopt, an Android render into a capture folder", () => {
  it("records a clean, current render as captured and current, still to read, its layout measured", async () => {
    const { result, to } = await adoptAndCheck([render({ uncommitted: "clean" })]);
    const [item] = (await readManifest(to)) ?? [];

    assert.deepEqual(kinds(result), ["unread"]);
    assert.equal(result.notMeasured, 0);

    assert.deepEqual(item && { ...item, steps: "" }, {
      build: { commit: fixture.current, uncommitted: "clean" },
      file: "plan-phone.png",
      kind: "shot",
      locale: "en-US",
      name: "plan-phone",
      platform: "android",
      pointer: "coarse",
      scale: 3,
      scheme: "light",
      sha256: sha256("plan picture"),
      side: "after",
      steps: "",
      viewport: "phone 411×1900",
    });
  });

  it("fails a render from an uncommitted tree, or one older than a commit to the app", async () => {
    const dirty = await adoptAndCheck([render({ uncommitted: sha256("draft") })]);
    const stale = await adoptAndCheck([render({ commit: fixture.older, uncommitted: "clean" })]);

    assert.deepEqual(kinds(dirty.result), ["uncommitted", "unread"]);
    assert.deepEqual(kinds(stale.result), ["stale", "unread"]);
  });

  it("refuses a picture that isn't the one its layout file measured", async () => {
    await assert.rejects(
      adoptAndCheck([render({ uncommitted: "clean" }, "another picture")]),
      /isn't the picture .* measured: render it again/u,
    );
  });
});
