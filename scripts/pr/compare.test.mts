import assert from "node:assert/strict";
import sharp from "sharp";
import { describe, it } from "vitest";
import { compareShots, describeChange } from "./compare.mts";

const SIZE = 10;

async function png({
  height = SIZE,
  mark,
  width = SIZE,
}: { height?: number; mark?: { left: number; top: number }; width?: number } = {}) {
  const base = sharp({ create: { background: "#fff", channels: 4, height, width } });

  const marked = mark
    ? base.composite([
        { input: { create: { background: "#000", channels: 4, height: 2, width: 3 } }, ...mark },
      ])
    : base;

  return marked.png().toBuffer();
}

describe("comparing a before shot with its after shot", () => {
  it("finds nothing when the shots match", async () => {
    const change = await compareShots(await png(), await png());

    assert.deepEqual(change, { box: undefined, height: SIZE, share: 0, width: SIZE });

    assert.equal(
      describeChange({ change, row: "today · phone · light" }),
      "today · phone · light: nothing changed, left out of media.md",
    );
  });

  it("boxes the pixels that changed, in the shot's own pixels", async () => {
    const change = await compareShots(await png(), await png({ mark: { left: 4, top: 6 } }));

    assert.deepEqual(change, {
      box: { height: 2, width: 3, x: 4, y: 6 },
      height: SIZE,
      share: 0.06,
      width: SIZE,
    });

    assert.equal(
      describeChange({ change, row: "today · phone · light" }),
      "today · phone · light: 6.0% changed, x 4–7, y 6–8 of 10×10 px",
    );
  });

  it("counts what only the taller shot covers as changed", async () => {
    const taller = SIZE + 2;
    const change = await compareShots(await png(), await png({ height: taller }));

    assert.deepEqual(change, {
      box: { height: 2, width: SIZE, x: 0, y: SIZE },
      height: taller,
      share: 2 / taller,
      width: SIZE,
    });
  });

  it("counts only what one shot covers and the other doesn't when their shapes differ", async () => {
    const long = SIZE * 2;
    const change = await compareShots(await png({ height: long }), await png({ width: long }));

    assert.deepEqual(change, {
      box: { height: long, width: long, x: 0, y: 0 },
      height: long,
      share: 0.5,
      width: long,
    });
  });
});
