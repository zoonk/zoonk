import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { markBusy } from "./busy.mts";

describe("judging on a busy machine", () => {
  it("keeps timing to look at, marked inconclusive, and everything else as it was", () => {
    const findings = markBusy([
      { check: "content", level: "fail", message: "over 2500 ms", unit: "ms", value: 3000 },
      { check: "navigation", level: "fail", message: "the tap didn't reach the page" },
      {
        check: "blank frame",
        level: "fail",
        message: "the viewport was blank",
        unit: "ms",
        value: 40,
      },
      { check: "slow query", level: "warn", message: "took over 100 ms", unit: "ms", value: 240 },
    ]);

    assert.deepEqual(
      findings.map((finding) => `${finding.level} ${finding.check}`),
      ["warn content", "fail navigation", "fail blank frame", "warn slow query"],
    );

    assert.match(findings[0]?.message ?? "", /inconclusive: the machine was busy/u);
    assert.match(findings[3]?.message ?? "", /inconclusive: the machine was busy/u);
  });
});
