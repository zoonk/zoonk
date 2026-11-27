import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { describe, it, test } from "vitest";
import { checkPictures } from "../../../scripts/pr/check.mts";
import { type Read, isRecorded, readManifest, writeManifest } from "../../../scripts/pr/media.mts";
import { type Capture, mergeCapture, parseCapture, saveCapture } from "./layout-capture.mts";

function capture(overrides: Partial<Capture>): Capture {
  return {
    build: { commit: "abc" },
    configuration: { height: 912, size: "phone", width: 420 },
    elements: [],
    picture: { file: "plan.after.png", sha256: "1" },
    platform: "apple",
    scale: 3,
    scenario: "plan",
    screen: "/plan",
    side: "after",
    unit: "pt",
    version: 1,
    ...overrides,
  };
}

describe(mergeCapture, () => {
  it("keeps a before and an after of one scenario", () => {
    const before = capture({ picture: { file: "plan.before.png", sha256: "1" }, side: "before" });
    const after = capture({ picture: { file: "plan.after.png", sha256: "2" }, side: "after" });

    assert.deepEqual(mergeCapture([before], after), [before, after]);
  });

  it("replaces a retake of the same shot", () => {
    const first = capture({ build: { commit: "abc" } });

    const retake = capture({
      build: { commit: "def" },
      picture: { file: "plan.after.png", sha256: "2" },
    });

    assert.deepEqual(mergeCapture([first], retake), [retake]);
  });

  it("refuses another screen under the same scenario and side", () => {
    const plan = capture({ screen: "/plan" });
    const today = capture({ screen: "/today" });

    assert.throws(() => mergeCapture([plan], today), /another screen or configuration/u);
  });

  it("refuses another configuration under the same scenario and side", () => {
    const phone = capture({});
    const tablet = capture({ configuration: { height: 1366, size: "tablet", width: 1024 } });

    assert.throws(() => mergeCapture([phone], tablet), /another screen or configuration/u);
  });
});

/** A capture the app wrote, with its picture's bytes, named `name` (`bytes` when they're text). */
async function answer(
  folder: string,
  bytes: Buffer | string,
  overrides: Partial<Capture> = {},
  name = String(bytes),
) {
  const picture = path.join(folder, `${name}.png`);
  await writeFile(picture, bytes);

  return {
    answer: capture({
      picture: { file: `${name}.png`, sha256: createHash("sha256").update(bytes).digest("hex") },
      ...overrides,
    }),
    picture,
  };
}

/** A plain frame; `effort` changes the bytes, never the pixels. */
async function frame({ background = "#fff", effort = 7 } = {}) {
  return sharp({ create: { background, channels: 4, height: 40, width: 40 } })
    .png({ effort })
    .toBuffer();
}

const READ: Read = { at: "2026-11-14T12:00:00.000Z", by: "reader", findings: [] };

/** Saves `first`, records a read on it, then saves `again` over it, as the app would answer each. */
async function readThenRetake(first: Buffer, again: Buffer) {
  const { app, out } = await folders();

  const save = async (bytes: Buffer, name: string) =>
    saveCapture({ ...(await answer(app, bytes, {}, name)), out, scenario: "plan", side: "after" });

  await save(first, "first");
  const items = (await readManifest(out)) ?? [];

  await writeManifest(
    out,
    items.map((item) => ({ ...item, read: READ })),
  );

  await save(again, "again");

  const [saved] = (await readManifest(out)) ?? [];
  return { item: saved && isRecorded(saved) ? saved : undefined, out };
}

async function folders() {
  const root = await mkdtemp(path.join(tmpdir(), "layout-capture-"));
  return { app: root, out: path.join(root, "out") };
}

const shot = (out: string) => readFile(path.join(out, "plan.after.png"), "utf8");
const saved = (out: string) => readFile(path.join(out, "alignment.json"), "utf8");

describe(saveCapture, () => {
  it("leaves the shot it would replace when it refuses another screen", async () => {
    const { app, out } = await folders();
    await saveCapture({ ...(await answer(app, "plan")), out, scenario: "plan", side: "after" });
    const before = await saved(out);

    const today = await answer(app, "today", { screen: "/today" });

    await assert.rejects(
      saveCapture({ ...today, out, scenario: "plan", side: "after" }),
      /another screen/u,
    );

    assert.equal(await shot(out), "plan");
    assert.equal(await saved(out), before);
  });

  it("leaves the shot when the picture isn't the frame the capture measured", async () => {
    const { app, out } = await folders();
    await saveCapture({ ...(await answer(app, "plan")), out, scenario: "plan", side: "after" });
    const retake = await answer(app, "retake");

    retake.answer.picture.sha256 = "0";

    await assert.rejects(
      saveCapture({ ...retake, out, scenario: "plan", side: "after" }),
      /isn't the frame/u,
    );

    assert.equal(await shot(out), "plan");
  });

  it("leaves the shot when the folder's capture can't be read", async () => {
    const { app, out } = await folders();
    await saveCapture({ ...(await answer(app, "plan")), out, scenario: "plan", side: "after" });

    await writeFile(path.join(out, "alignment.json"), "{ not json");

    await assert.rejects(
      saveCapture({ ...(await answer(app, "retake")), out, scenario: "plan", side: "after" }),
    );

    assert.equal(await shot(out), "plan");
  });

  it("leaves the shot when the folder's picture records can't be read", async () => {
    const { app, out } = await folders();
    await saveCapture({ ...(await answer(app, "plan")), out, scenario: "plan", side: "after" });
    const before = await saved(out);

    await writeFile(path.join(out, "capture.json"), "[null]");

    await assert.rejects(
      saveCapture({ ...(await answer(app, "retake")), out, scenario: "plan", side: "after" }),
      /isn't a capture folder's/u,
    );

    assert.equal(await shot(out), "plan");
    assert.equal(await saved(out), before);
  });

  /**
   * The picture, `alignment.json` and `capture.json` can't change as one, so a save killed after the
   * picture moved in leaves a picture its records don't describe; the PR's check refuses it.
   */
  it("leaves a folder the PR check refuses when a save stops after the picture moved in", async () => {
    const { app, out } = await folders();
    await saveCapture({ ...(await answer(app, "plan")), out, scenario: "plan", side: "after" });

    await writeFile(path.join(out, "plan.after.png"), "retake");

    const result = await checkPictures({
      manifests: [out],
      pictures: [path.join(out, "plan.after.png")],
      repository: path.resolve(import.meta.dirname, "../../.."),
    });

    assert.deepEqual(
      result.problems.map(({ kind }) => kind),
      ["changed"],
    );
  });

  it("clears what a stopped save left staged", async () => {
    const { app, out } = await folders();
    // No process has this id.
    const left = path.join(out, ".plan.after.png.2147483646.staged");

    await mkdir(out, { recursive: true });
    await writeFile(left, "half");
    await saveCapture({ ...(await answer(app, "plan")), out, scenario: "plan", side: "after" });

    assert.equal(existsSync(left), false);
  });

  it("keeps a read when a retake shows the same pixels", async () => {
    const { item } = await readThenRetake(await frame(), await frame({ effort: 1 }));

    assert.equal(item?.read?.by, READ.by);
    assert.equal(item?.retakes, undefined);
  });

  it("keeps the read and the picture a retake with other pixels replaces, for a check of its fixes", async () => {
    const first = await frame();
    const { item, out } = await readThenRetake(first, await frame({ background: "#eee" }));
    const file = "earlier/plan.after.png";

    assert.equal(item?.read, undefined);

    assert.deepEqual(item?.retakes, {
      file,
      read: READ,
      sha256: createHash("sha256").update(first).digest("hex"),
    });

    assert.deepEqual(await readFile(path.join(out, file)), first);
  });

  it("refuses an answer that isn't a capture before counting it", async () => {
    const { app, out } = await folders();
    const partial = await answer(app, "plan");
    const { elements: _elements, unit: _unit, version: _version, ...rest } = partial.answer;

    await assert.rejects(
      saveCapture({ ...partial, answer: rest, out, scenario: "plan", side: "after" }),
      /isn't a capture/u,
    );
  });
});

test("accepts version 2 native measurements and preserves explicit limits", () => {
  const native = capture({
    measuredRules: ["one-height"],
    notMeasurable: { "line-end": "Text.Layout has no resolved source string" },
    version: 2,
  });

  assert.deepEqual(parseCapture(native), native);
});
