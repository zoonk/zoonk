/* oxlint-disable no-magic-numbers -- The fixtures are measurements in pixels. */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { element, fixtureCapture } from "./alignment-fixtures.mts";
import { evaluateCapture } from "./alignment.mts";

/**
 * A bottom bar at 700 whose note's box starts at 640 (its line) with its first line `above` lower,
 * and whose buttons start `below` under the note's box.
 */
function bar(above: number, below: number) {
  return fixtureCapture([
    element({
      bounds: [0, 700, 390, 100],
      group: null,
      id: "bar",
      part: "group",
      piece: "bottom-bar",
    }),
    element({
      bounds: [16, 640, 358, 60],
      firstLine: [16, 640 + above, 300, 20],
      group: "bar",
      id: "note",
      ink: [16, 644 + above, 300, 14],
      lines: 1,
      name: '"Start free, no account needed."',
      part: "note",
      piece: "bottom-bar",
      row: null,
    }),
    element({
      bounds: [16, 700 + below, 358, 48],
      group: "bar",
      id: "buttons",
      ink: [16, 700 + below, 358, 48],
      part: "end",
      piece: "bottom-bar",
      row: null,
    }),
  ]);
}

function room(capture: ReturnType<typeof bar>) {
  return evaluateCapture(capture)
    .filter((finding) => finding.rule === "room")
    .map((finding) => finding.detail);
}

describe("a bottom bar's note sits as far from its line as its buttons sit from it", () => {
  it("passes a note with the same room above and below", () => {
    assert.deepEqual(room(bar(16, 16)), []);
  });

  it("fails a note that hugs its line and floats from its buttons (#2)", () => {
    assert.deepEqual(room(bar(8, 16)), [
      '"Start free, no account needed." has 8 above it and 16 below it',
    ]);
  });
});
