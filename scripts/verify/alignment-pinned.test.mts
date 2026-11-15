/* oxlint-disable no-magic-numbers -- The fixtures are measurements in pixels. */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { element, fixtureCapture } from "./alignment-fixtures.mts";
import { evaluateCapture } from "./alignment.mts";

/** At the scroll's end, a Save bar from 760 down and a last row whose caption ends at `bottom`. */
function lastRow(bottom: number) {
  return fixtureCapture([
    element({ bounds: [16, 0, 358, bottom], group: null, id: "g", part: "group" }),
    element({ bounds: [16, bottom - 60, 358, 60], id: "r0", part: "row" }),
    element({
      bounds: [16, bottom - 24, 200, 20],
      id: "n0",
      ink: [16, bottom - 22, 190, 16],
      part: "note",
      row: "r0",
    }),
    element({
      bounds: [0, 760, 390, 84],
      group: null,
      id: "pinned.0",
      name: '"Save"',
      part: "pinned",
      piece: "page",
    }),
  ]);
}

function under(bottom: number) {
  return evaluateCapture(lastRow(bottom))
    .filter((finding) => finding.rule === "pinned")
    .map((finding) => finding.detail);
}

describe("nothing rests under a pinned bar at the scroll's end", () => {
  it("passes a last row that ends above the bar", () => {
    assert.deepEqual(under(752), []);
  });

  it("fails a last row the bar covers, by how much (#12)", () => {
    assert.deepEqual(under(790), ['"Save" covers 30 of row r0']);
  });

  it("leaves the bar's own rows alone: they are what it pins", () => {
    const capture = lastRow(752);

    const own = {
      ...capture,
      elements: [
        ...capture.elements,
        element({
          bounds: [0, 760, 390, 84],
          group: null,
          id: "bar",
          part: "group",
          piece: "bottom-bar",
        }),
        element({
          bounds: [16, 776, 358, 48],
          group: "bar",
          id: "bar.0",
          part: "row",
          piece: "bottom-bar",
        }),
      ],
    };

    assert.deepEqual(
      evaluateCapture(own).filter((finding) => finding.rule === "pinned"),
      [],
    );
  });

  it("leaves a control the bar holds alone: Skip beside Continue rides with the bar (C-L04)", () => {
    const capture = lastRow(752);

    const skip = (pinnedIn?: string) => ({
      ...capture,
      elements: [
        ...capture.elements,
        element({
          bounds: [16, 784, 95, 44],
          group: null,
          id: "skip",
          part: "group",
          piece: "glyph-label",
          ...(pinnedIn ? { pinnedIn } : {}),
        }),
        element({
          bounds: [16, 784, 95, 44],
          group: "skip",
          id: "skip.0",
          name: '"Skip"',
          part: "row",
          piece: "glyph-label",
        }),
      ],
    });

    assert.deepEqual(
      evaluateCapture(skip("pinned.0")).filter((finding) => finding.rule === "pinned"),
      [],
    );

    // A page's own control the bar covers still fails: only what the bar holds rides with it.
    assert.deepEqual(
      evaluateCapture(skip())
        .filter((finding) => finding.rule === "pinned")
        .map((finding) => finding.detail),
      ['"Save" covers 68 of "Skip"'],
    );
  });
});
