/* oxlint-disable no-magic-numbers -- The fixtures are measurements in points and pixels. */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { type Capture } from "./alignment-capture.mts";
import { element, fixtureCapture, labelledRows } from "./alignment-fixtures.mts";
import { evaluateCapture } from "./alignment.mts";

/** Two rows whose chevrons' boxes end on the edge (358), their ink inset 2.5 in the box. */
function chevronRows(platform: Capture["platform"]) {
  return {
    ...fixtureCapture([
      element({ endEdge: 358, group: null, id: "g", part: "group" }),
      ...labelledRows(2),
      element({
        bounds: [346, 15, 12, 14],
        id: "e0",
        ink: [348.5, 16, 7, 12],
        part: "end",
        row: "r0",
      }),
      element({
        bounds: [346, 59, 12, 14],
        id: "e1",
        ink: [348.5, 60, 7, 12],
        part: "end",
        row: "r1",
      }),
    ]),
    platform,
  };
}

function chevronEnds(platform: Capture["platform"]) {
  return evaluateCapture(chevronRows(platform)).filter((finding) => finding.rule === "end-edge");
}

describe("an end glyph's column on Apple (AP1's C2)", () => {
  it("is its box, where the system insets its chevron's ink; elsewhere the ink decides", () => {
    assert.deepEqual(chevronEnds("apple"), []);
    assert.equal(chevronEnds("android")[0]?.level, "fail");
  });
});

function finishRow(slotWidth: number) {
  const capture = {
    ...fixtureCapture([
      element({ endEdge: 374, group: null, id: "g", part: "group" }),
      ...labelledRows(2).map((part) => (part.part === "row" ? { ...part, endEdge: 374 } : part)),
      element({
        bounds: [361, 14, 16, 16],
        id: "end",
        ink: [364, 20, 10, 5],
        part: "end",
        row: "r0",
      }),
      element({
        bounds: [303, 56, 43, 20],
        id: "date",
        ink: [303, 59, 43, 16],
        part: "value",
        row: "r1",
      }),
      element({
        bounds: [374 - slotWidth, 58, slotWidth, 16],
        id: "chevron-slot",
        ink: null,
        part: "holder",
        row: "r1",
      }),
    ]),
    platform: "web" as const,
  };

  return evaluateCapture(capture).filter((finding) => finding.rule === "end-edge");
}

describe("a row that keeps the chevron column", () => {
  it("accepts the chevron's reserved space when other rows draw only the chevron", () => {
    assert.deepEqual(finishRow(16), []);
  });

  it("still reports a short end when the holder is narrower than the chevron", () => {
    assert.equal(finishRow(8)[0]?.measured, 28);
  });
});
