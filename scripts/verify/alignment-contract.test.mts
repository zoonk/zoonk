/* oxlint-disable no-magic-numbers -- The fixtures are measurements in pixels. */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { type Capture } from "./alignment-capture.mts";
import { real } from "./alignment-fixtures.mts";
import { summaryLine } from "./alignment-summary.mts";
import { evaluateCapture, evaluateFile } from "./alignment.mts";

/** The not-measured records a capture writes, by relationship. */
function unmeasured(capture: Capture) {
  return evaluateCapture(capture)
    .filter((finding) => finding.level === "not-measured")
    .map((finding) => finding.rule);
}

describe("a declared relationship is measured and holds, or the run fails", () => {
  it("fails a row whose value sits 5 off its label's line, with nothing left pending", () => {
    const { findings, summary } = evaluateFile({ captures: [real("round 2 pending-line")] });

    assert.equal(findings.find((finding) => finding.rule === "line")?.level, "fail");
    assert.equal(summary.failed, true);
    assert.doesNotMatch(summaryLine(summary), /waiting/u);
  });

  it("writes a failing record for an end edge, a type token or a gap the read couldn't give", () => {
    assert.deepEqual(unmeasured(real("round 2 missing-end")), ["end-edge"]);
    assert.deepEqual(unmeasured(real("round 2 explicit-missing-type")), ["type"]);

    const untyped = real("round 2 explicit-missing-type");

    assert.deepEqual(
      unmeasured({
        ...untyped,
        elements: untyped.elements.map(({ type: _type, ...element }) => element),
      }),
      ["type"],
    );

    assert.deepEqual(unmeasured(real("round 2 missing-gap")), ["gap"]);
  });

  it("checks each neighbor pair's gap: a row's own gap doesn't stand in for the group's", () => {
    assert.deepEqual(unmeasured(real("round 2 partial-gap")), ["gap"]);
    assert.equal(evaluateFile({ captures: [real("round 2 partial-gap")] }).summary.failed, true);
  });
});
