/* oxlint-disable no-magic-numbers -- The fixtures are measurements in pixels. */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { type Bounds } from "./alignment-capture.mts";
import { element, fixtureCapture, labelledRows } from "./alignment-fixtures.mts";
import { evaluateCapture } from "./alignment.mts";

describe("Apple list sections", () => {
  it("counts section text between Apple list cells as space without looking for a row label", () => {
    const [first, firstLabel, next, nextLabel] = labelledRows(2);
    assert.ok(first && firstLabel && next && nextLabel);

    const section = element({
      bounds: [0, 44, 358, 22],
      flow: "section",
      gapBefore: 0,
      id: "s0",
      part: "section-text",
    });

    const capture = {
      ...fixtureCapture([
        element({ gap: 0, group: null, id: "g", part: "group" }),
        { ...first, flow: "section" },
        firstLabel,
        section,
        { ...next, bounds: [0, 66, 358, 44] as Bounds, flow: "section" },
        nextLabel,
      ]),
      platform: "apple" as const,
    };

    assert.deepEqual(
      evaluateCapture(capture).filter((item) => item.rule === "label" || item.rule === "gap"),
      [],
    );

    capture.elements = capture.elements.map((part) =>
      part.id === section.id ? { ...part, part: "row" } : part,
    );

    assert.ok(evaluateCapture(capture).some((item) => item.rule === "label"));
  });
});
