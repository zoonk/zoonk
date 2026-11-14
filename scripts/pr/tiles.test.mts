import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { tileBoxes } from "./tiles.mts";

const PIXELS = 1_150_000;
const SIDE = 1568;
const PHONE = { height: 2532, width: 1170 };
const WIDE = { height: 1440, width: 2560 };

function covers(tiles: ReturnType<typeof tileBoxes>, width: number, height: number): boolean {
  return [0, Math.floor(width / 2), width - 1].every((x) =>
    [0, Math.floor(height / 2), height - 1].every((y) =>
      tiles.some((t) => x >= t.left && x < t.left + t.width && y >= t.top && y < t.top + t.height),
    ),
  );
}

describe("cutting a picture into tiles a reader sees at original size", () => {
  it("leaves a picture that already fits whole", () => {
    assert.deepEqual(tileBoxes({ height: 844, width: 390 }), [
      { height: 844, left: 0, top: 0, width: 390 },
    ]);
  });

  it("cuts a tall phone picture into full-width strips that overlap and stay under the limits", () => {
    const tiles = tileBoxes(PHONE);

    const overlapping = tiles
      .slice(1)
      .every((tile, index) => tile.top < (tiles[index]?.top ?? 0) + (tiles[index]?.height ?? 0));

    assert.equal(tiles.length, 3);
    assert.ok(tiles.every((tile) => tile.width === PHONE.width));
    assert.ok(tiles.every((tile) => tile.width * tile.height <= PIXELS));
    assert.ok(overlapping);
    assert.ok(covers(tiles, PHONE.width, PHONE.height));
  });

  it("splits a picture wider than a side's limit into columns too", () => {
    const tiles = tileBoxes(WIDE);

    assert.ok(tiles.every((tile) => tile.width <= SIDE && tile.height <= SIDE));
    assert.ok(tiles.every((tile) => tile.width * tile.height <= PIXELS));
    assert.ok(covers(tiles, WIDE.width, WIDE.height));
  });
});
