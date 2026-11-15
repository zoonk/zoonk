/* oxlint-disable no-magic-numbers -- The fixtures are measurements in pixels. */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { real } from "./alignment-fixtures.mts";
import { summaryLine } from "./alignment-summary.mts";
import { evaluateFile } from "./alignment.mts";

describe("a declared relationship is measured and holds, or the run fails", () => {
  it("fails a row whose value sits 5 off its label's line, with nothing left pending", () => {
    const { findings, summary } = evaluateFile({ captures: [real("round 2 pending-line")] });

    assert.equal(findings.find((finding) => finding.rule === "line")?.level, "fail");
    assert.equal(summary.failed, true);
    assert.doesNotMatch(summaryLine(summary), /waiting/u);
  });
});
