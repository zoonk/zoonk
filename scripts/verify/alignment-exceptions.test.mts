/* oxlint-disable no-magic-numbers -- The fixtures are measurements in pixels. */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { failures, real } from "./alignment-fixtures.mts";
import { summarize } from "./alignment-summary.mts";
import { applyExceptions } from "./alignment.mts";

describe("alignment exceptions", () => {
  it("keeps an excepted fault listed but resolved", () => {
    const findings = applyExceptions(failures(real("plan roadmap before 5ae2e06daa, phone")), [
      {
        configuration: "phone touch",
        grantedBy: "user",
        maxMeasured: 28,
        piece: "plan-roadmap",
        reason: "granted",
        relation: "end-edge",
        scenario: "/plan",
      },
    ]);

    assert.equal(findings[0]?.exception, "granted");
    assert.equal(summarize(findings).unresolved, 0);
  });

  it("resolves a fault the base has too, tracked in an issue, as it does a granted one", () => {
    const findings = applyExceptions(failures(real("plan roadmap before 5ae2e06daa, phone")), [
      {
        configuration: "phone touch",
        issue: 2790,
        maxMeasured: 28,
        piece: "plan-roadmap",
        reason: "on main too, fixed by #2790",
        relation: "end-edge",
        scenario: "/plan",
      },
    ]);

    assert.equal(findings[0]?.exception, "on main too, fixed by #2790");
    assert.equal(summarize(findings).unresolved, 0);
  });

  it("fails a known relationship that got worse in either direction", () => {
    const [original] = failures(real("plan roadmap before 5ae2e06daa, phone"));
    assert.ok(original);

    const findings = applyExceptions(
      [original, { ...original, measured: 108 }, { ...original, measured: -108 }],
      [
        {
          configuration: "phone touch",
          issue: 2790,
          maxMeasured: 28,
          piece: "plan-roadmap",
          reason: "on main too",
          relation: "end-edge",
          scenario: "/plan",
        },
      ],
    );

    assert.deepEqual(
      findings.map((item) => item.exception),
      ["on main too", undefined, undefined],
    );

    assert.equal(summarize(findings).unresolved, 1);
  });
});
