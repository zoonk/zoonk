import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "vitest";
import { z } from "zod";
import { adoptRenders } from "./adopt.mts";
import { CLEAN, checkFixture, kinds, sha256 } from "./check-fixture.mts";
import { checkPictures } from "./check.mts";
import { type Side, readManifest, writeManifest } from "./media.mts";

const fixture = checkFixture();

/**
 * A real render's layout file (`PlanScreenshots.phone`, or `OnboardingScreenshots.phone`'s
 * connection lost, with `-Pzoonk.shots`), its picture stood in by a few bytes whose hash it
 * records, built from `commit` with `uncommitted` changes or none.
 */
function render(
  build: { commit?: string; uncommitted: string },
  { bytes = "picture", name = "plan-phone" }: { bytes?: string; name?: string } = {},
) {
  const folder = mkdtempSync(join(fixture.repository, "render-"));
  const text = readFileSync(join(import.meta.dirname, `fixtures/android-${name}.json`), "utf8");
  const capture = z.record(z.string(), z.unknown()).parse(JSON.parse(text));

  writeFileSync(join(folder, `${name}.png`), bytes);

  const picture = {
    build: { commit: fixture.current, ...build },
    file: `${name}.png`,
    sha256: sha256("picture"),
  };

  writeFileSync(join(folder, `${name}.json`), JSON.stringify({ ...capture, picture }));
  return join(folder, `${name}.json`);
}

async function adoptAndCheck(
  renders: string[],
  {
    name = "plan-phone",
    read = false,
    side = "after",
  }: { name?: string; read?: boolean; side?: Side } = {},
) {
  const to = mkdtempSync(join(fixture.repository, "capture-"));
  await adoptRenders({ renders, side, to });

  if (read) {
    const items = (await readManifest(to)) ?? [];

    await writeManifest(
      to,
      items.map((item) => ({ ...item, read: CLEAN })),
    );
  }

  const result = await checkPictures({
    manifests: [to],
    pictures: [join(to, `${name}.png`)],
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
      sha256: sha256("picture"),
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
      adoptAndCheck([render({ uncommitted: "clean" }, { bytes: "another picture" })]),
      /isn't the picture .* measured: render it again/u,
    );
  });

  it("fails a read render the evaluator leaves not measured, and leaves a before side alone", async () => {
    const lost = { name: "connection-lost-phone" };
    const clean = { uncommitted: "clean" };
    const after = await adoptAndCheck([render(clean, lost)], { ...lost, read: true });
    const before = await adoptAndCheck([render(clean, lost)], { ...lost, side: "before" });

    assert.deepEqual(kinds(after.result), ["alignment"]);
    assert.match(after.result.problems[0]?.detail ?? "", /no rows the read could find/u);
    assert.deepEqual(before.result.problems, []);
  });
});
