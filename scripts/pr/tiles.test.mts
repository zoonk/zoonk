import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { describe, it } from "vitest";
import { type CaptureItem } from "./media.mts";
import { tileBoxes, writeReadingSheet } from "./tiles.mts";

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

/** An after or before record of a phone picture of `name`. */
function item(name: string, side: CaptureItem["side"]): CaptureItem {
  return {
    build: { app: "main", commit: "c0ffee", id: "build" },
    file: `${name}.png`,
    kind: "shot",
    locale: "en",
    name,
    platform: "web",
    pointer: "coarse",
    scale: 3,
    scheme: "light",
    sha256: name,
    side,
    steps: "steps",
    viewport: "phone",
  };
}

/** A capture root with a before and an after of `today`, and an after of a new screen. */
async function capturedRoot() {
  const root = mkdtempSync(join(tmpdir(), "pr-media-sheet-"));

  const png = await sharp({ create: { background: "#fff", channels: 4, height: 40, width: 40 } })
    .png()
    .toBuffer();

  const sides = {
    after: [item("today", "after"), item("goal", "after")],
    before: [item("today", "before")],
  };

  for (const [side, items] of Object.entries(sides)) {
    mkdirSync(join(root, side));
    writeFileSync(join(root, side, "capture.json"), JSON.stringify(items));

    for (const { file } of items) {
      writeFileSync(join(root, side, file), png);
    }
  }

  return root;
}

describe("the reader's sheet", () => {
  it("shows the before pictures only after the blind pass, for the sort", async () => {
    const root = await capturedRoot();
    const { path } = await writeReadingSheet({ root, sheet: join(root, "read") });
    const sheet = await readFile(path, "utf8");
    const sort = sheet.indexOf("## Then sort each finding");

    assert.ok(sort > sheet.indexOf("## Then the words"));
    assert.ok(sheet.indexOf("before/today.png") > sort);
    assert.ok(sheet.includes("- after/today.png: [before/today.png](../before/today.png)"));
    assert.match(sheet, /- after\/goal\.png: no before, so everything on it is this change's/u);
  });
});
