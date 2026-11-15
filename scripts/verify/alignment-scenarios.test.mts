/* oxlint-disable no-magic-numbers -- The fixtures are measurements in pixels. */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { type Capture, type CaptureElement } from "./alignment-capture.mts";
import { fixtureCapture } from "./alignment-fixtures.mts";
import { pairLeads, reconcile } from "./alignment-scenarios.mts";
import { summarize, summaryLine } from "./alignment-summary.mts";
import { evaluateFile } from "./alignment.mts";
import { SCENARIOS, type Scenario } from "./scenarios/scenarios.mts";

const PAIR: Scenario[] = [
  {
    anchors: [{ id: "action" }, { id: "notice" }],
    id: "screen.plain",
    prerequisites: { persona: "visitor" },
    proof: "Start",
    reach: [],
    screen: "/screen",
    sizes: [{ pointer: "touch", size: "phone" }],
  },
  {
    anchors: [{ id: "action" }, { id: "notice" }],
    id: "screen.notice",
    pair: { change: ["notice"], with: "screen.plain" },
    prerequisites: { persona: "visitor" },
    proof: "Start",
    reach: [],
    screen: "/screen",
    sizes: [{ pointer: "touch", size: "phone" }],
  },
];

function anchor(id: string, top: number, height = 44): CaptureElement {
  return {
    anchor: id,
    bounds: [16, top, 358, height],
    group: null,
    id,
    ink: [16, top, 358, height],
    part: "anchor",
    piece: "",
    row: null,
  };
}

function scenarioCapture(scenario: string, elements: CaptureElement[]): Capture {
  return { ...fixtureCapture(elements), scenario, screen: "/screen", unit: "px" };
}

describe("the scenario list", () => {
  it("names each scenario once", () => {
    const ids = SCENARIOS.map((scenario) => scenario.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("pairs each scenario with one the list names, on the same screen", () => {
    for (const scenario of SCENARIOS.filter((item) => item.pair)) {
      const other = SCENARIOS.find((item) => item.id === scenario.pair?.with);
      assert.equal(other?.screen, scenario.screen, scenario.id);
    }
  });
});

describe("reconciling a run with the list", () => {
  it("fails a required scenario that wasn't captured or whose words never showed", () => {
    const shown = scenarioCapture("screen.plain", []);
    const unreached = { ...scenarioCapture("screen.notice", []), reached: false };

    const { missing } = reconcile(
      { captures: [shown, unreached], required: ["screen.plain", "screen.notice"] },
      PAIR,
    );

    assert.equal(missing, 1);
  });

  it("can't measure a scenario the list doesn't name", () => {
    const { findings } = reconcile({ captures: [], required: ["screen.typo"] }, PAIR);

    assert.deepEqual(
      findings.map((finding) => finding.level),
      ["not-measured"],
    );
  });

  it("says nothing about scenarios when the run didn't name any", () => {
    assert.equal(reconcile({ captures: [] }).missing, null);
  });

  it("prints the missing scenarios in the summary line and fails the run", () => {
    const { summary } = evaluateFile({ captures: [], required: ["plan.path"] });

    assert.equal(summary.failed, true);

    assert.equal(
      summaryLine(summary),
      "FAIL: 0 unresolved; 1 required scenario missing; 0 discovery leads; 0 not measured",
    );

    assert.equal(summarize([], 0).failed, false);
  });
});

describe("state pairs", () => {
  it("fails an anchor that moved between the two states, and leaves the named change alone", () => {
    const plain = scenarioCapture("screen.plain", [
      anchor("action", 760),
      anchor("notice", 700, 0),
    ]);

    const notice = scenarioCapture("screen.notice", [
      anchor("action", 744),
      anchor("notice", 700, 40),
    ]);

    const [moved, ...rest] = pairLeads([plain, notice], PAIR);

    assert.equal(rest.length, 0);
    assert.equal(moved?.measured, 16);
    assert.match(moved?.detail ?? "", /^action: down -16/u);
  });

  it("passes an anchor within a layout value's rounding, and fails one that left", () => {
    const plain = scenarioCapture("screen.plain", [anchor("action", 760)]);
    const still = scenarioCapture("screen.notice", [anchor("action", 760.4)]);
    const gone = scenarioCapture("screen.notice", []);

    assert.deepEqual(pairLeads([plain, still], PAIR), []);
    assert.match(pairLeads([plain, gone], PAIR)[0]?.detail ?? "", /action is missing/u);
  });

  it("can't measure a pair whose other half wasn't captured", () => {
    const [record] = pairLeads([scenarioCapture("screen.notice", [anchor("action", 760)])], PAIR);
    assert.equal(record?.level, "not-measured");
  });
});
