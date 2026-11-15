import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "vitest";
import { type Capture, mergeCapture, saveCapture } from "./layout-capture.mts";

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

/** A capture the app wrote, with its picture's bytes. */
async function answer(folder: string, bytes: string, overrides: Partial<Capture> = {}) {
  const picture = path.join(folder, `${bytes}.png`);
  await writeFile(picture, bytes);

  return {
    answer: capture({
      picture: { file: `${bytes}.png`, sha256: createHash("sha256").update(bytes).digest("hex") },
      ...overrides,
    }),
    picture,
  };
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
