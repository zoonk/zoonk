/* oxlint-disable no-magic-numbers -- The fixtures are measurements in pixels. */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { type Capture } from "./alignment-capture.mts";
import { element, fixtureCapture, real } from "./alignment-fixtures.mts";
import { evaluateCapture } from "./alignment.mts";

/** A box at `x` and `width` on a phone whose column runs 16 to 374 in a 390-wide frame. */
function fill(kind: "box" | "hairline" | "highlight" | "picture", x: number, width: number) {
  return fixtureCapture([
    element({
      bounds: [x, 100, width, kind === "hairline" ? 1 : 44],
      column: [16, 374],
      frame: [0, 390],
      group: null,
      id: "f",
      kind,
      part: "fill",
      piece: "page",
    }),
  ]);
}

/** Top-level groups, each `[x, y, width]`, in a phone column running 16 to 374. */
function groups(...boxes: [number, number, number][]) {
  return fixtureCapture(
    boxes.map(([x, y, width], index) =>
      element({
        bounds: [x, y, width, 88],
        column: [16, 374],
        frame: [0, 390],
        group: null,
        id: `g${index}`,
        name: `"list ${index}"`,
        part: "group",
        piece: "list-group",
      }),
    ),
  );
}

function columnMisses(capture: Capture) {
  return evaluateCapture(capture)
    .filter((finding) => finding.rule === "column")
    .map((finding) => finding.detail);
}

describe("the page's column (craft E7)", () => {
  it("fails what passed the column on the head: a current row's fill, a tab line, a tab pill", () => {
    assert.deepEqual(columnMisses(real("plan current row fill 98ae571b1b, phone")), [
      '"Functions and graphs" starts 18 inside it and ends 10 past it',
    ]);

    assert.deepEqual(columnMisses(real("level tab line 98ae571b1b, laptop")), [
      '"Statistics Across all your goals" starts 10 past it and ends 10 past it',
    ]);

    assert.equal(columnMisses(real("mind maps tab pill 98ae571b1b, phone")).length, 1);
  });

  it("lets a highlighted row pass by 10 on each side, and nothing more or uneven", () => {
    assert.deepEqual(columnMisses(fill("highlight", 6, 378)), []);
    assert.equal(columnMisses(fill("highlight", 4, 382)).length, 1);
    assert.equal(columnMisses(fill("highlight", 6, 370)).length, 1);
  });

  it("scales the kit's 10 with the text, since every length is in rem: 20 at 2x text", () => {
    const scaled = (x: number, width: number) => {
      const capture = fill("highlight", x, width);
      return { ...capture, configuration: { ...capture.configuration, textScale: 2 } };
    };

    assert.deepEqual(columnMisses(scaled(-4, 398)), []);
    assert.equal(columnMisses(scaled(-14, 418)).length, 1);
  });

  it("lets a hairline or a picture pass only across the frame's whole room, and never a box", () => {
    assert.deepEqual(columnMisses(fill("hairline", 0, 390)), []);
    assert.deepEqual(columnMisses(fill("picture", 0, 390)), []);
    assert.equal(columnMisses(fill("hairline", 6, 378)).length, 1);
    assert.equal(columnMisses(fill("box", 6, 378)).length, 1);
  });

  it("fails a list or a strip that stops short of its column, alone in its band (#13, #14)", () => {
    assert.deepEqual(columnMisses(groups([16, 0, 358])), []);

    assert.deepEqual(columnMisses(groups([16, 0, 175])), [
      '"list 0" starts on it and ends 183 short of it',
    ]);

    assert.deepEqual(columnMisses(groups([20.3, 0, 310.7])), [
      '"list 0" starts 4.3 inside it and ends 43 short of it',
    ]);
  });

  it("passes a list set in from the start that reaches the end, beside a rail or a grid's cell", () => {
    assert.deepEqual(columnMisses(groups([44, 0, 330])), []);
  });

  it("judges lists side by side as one band, so two halves of the column pass", () => {
    assert.deepEqual(columnMisses(groups([16, 0, 169], [205, 20, 169])), []);
    // Apart, the left half stops short (#13); the right half reaches the end.
    assert.equal(columnMisses(groups([16, 0, 169], [205, 200, 169])).length, 1);
  });
});
