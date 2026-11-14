/* oxlint-disable no-magic-numbers -- The fixtures are measurements in pixels. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "vitest";
import { type AlignmentFinding, type Capture, type CaptureElement } from "./alignment-capture.mts";
import { alignmentLines, summarize, summaryLine } from "./alignment-summary.mts";
import { applyExceptions, evaluateCapture, evaluateFile } from "./alignment.mts";

/** Captures read from real pages, each fault's commit reversed in the working tree, then fixed. */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The tooling's own fixture.
const CASES = JSON.parse(
  readFileSync(join(import.meta.dirname, "alignment-cases.json"), "utf8"),
) as Record<string, Capture>;

function real(name: string): Capture {
  const capture = CASES[name];
  assert.ok(capture, name);
  return capture;
}

function failures(capture: Capture): AlignmentFinding[] {
  return evaluateCapture(capture).filter((finding) => finding.level === "fail");
}

function fixtureCapture(elements: CaptureElement[], activeSurface = "page"): Capture {
  return {
    activeSurface,
    configuration: {
      height: 844,
      locale: "en",
      pointer: "touch",
      scheme: "light",
      size: "phone",
      textScale: 1,
      width: 390,
    },
    elements,
    platform: "android",
    scale: 3,
    scenario: "fixture",
    screen: "fixture",
    unit: "dp",
    version: 1,
  };
}

function element(fields: Partial<CaptureElement> & Pick<CaptureElement, "id" | "part">) {
  return {
    bounds: [0, 0, 10, 10],
    group: "g",
    ink: [0, 0, 10, 10],
    piece: "list-group",
    row: null,
    ...fields,
  } satisfies CaptureElement;
}

function filledActions(surface: string, count: number) {
  return Array.from({ length: count }, (_, index) =>
    element({
      group: null,
      id: `${surface}${index}`,
      part: "action",
      piece: "action",
      surface,
      variant: "filled",
    }),
  );
}

describe("the declared relationships on the faults the owner caught", () => {
  it("fails the Plan's date 28 px short of its bar, naming the empty slot that holds the room", () => {
    const [finding, ...rest] = failures(real("plan roadmap before 5ae2e06daa, phone"));

    assert.equal(rest.length, 0);
    assert.equal(finding?.rule, "end-edge");
    assert.equal(finding?.measured, 28);
    assert.match(finding?.holder ?? "", /^<span> \(16×16\) draws nothing/u);
  });

  it("passes the date on the bar's edge, and the line that ends with its chevron", () => {
    assert.deepEqual(failures(real("plan roadmap after, phone")), []);
    assert.deepEqual(failures(real("plan roadmap with its chevron, phone")), []);
  });

  it("fails 46 px between Send feedback and Log in, naming the hidden button that holds it", () => {
    const [finding, ...rest] = failures(real("visitor sidebar before c96189d356, laptop"));

    assert.equal(rest.length, 0);
    assert.equal(finding?.rule, "gap");
    assert.equal(finding?.measured, 44);
    assert.match(finding?.holder ?? "", /^"Build my plan" \(215×36\)/u);
  });

  it("passes the 2 px gap, and the collapsed sidebar's 6 px from the Log in button's own margin", () => {
    assert.deepEqual(failures(real("visitor sidebar after, laptop")), []);
    assert.deepEqual(failures(real("visitor sidebar after, collapsed")), []);
  });

  it("fails answers 10 and 11 starting 32 px right on a phone, naming the empty key cell", () => {
    const [finding, ...rest] = failures(real("conditions before 0387bba5c6, phone"));

    assert.equal(rest.length, 0);
    assert.equal(finding?.rule, "label-start");
    assert.equal(finding?.measured, 32);
    assert.match(finding?.detail ?? "", /^"Anxiety", "Something else/u);
    assert.match(finding?.holder ?? "", /^<span list-row-leading> \(20×0\)/u);
  });

  it("fails answers 10 and 11 starting 32 px left on a laptop once the empty key cell collapsed", () => {
    const [finding, ...rest] = failures(real("conditions before 113f756f74, laptop"));

    assert.equal(rest.length, 0);
    assert.equal(finding?.rule, "label-start");
    assert.equal(finding?.measured, 32);
    assert.equal(finding?.holder, undefined);
  });

  it("passes the conditions on both pointers, a laptop's kept empty key cell included", () => {
    assert.deepEqual(failures(real("conditions before 0387bba5c6, laptop")), []);
    assert.deepEqual(failures(real("conditions after, phone")), []);
    assert.deepEqual(failures(real("conditions after, laptop")), []);
  });
});

describe("the Plan's path and Android's captures", () => {
  it("prints the Trickster row's date 8.3 px above its chevron as a line miss, failing nothing yet", () => {
    const findings = evaluateCapture(real("plan path, phone"));
    const line = findings.find((finding) => finding.detail.includes("The Trickster"));

    assert.deepEqual(failures(real("plan path, phone")), []);
    assert.equal(line?.level, "not-measured");
    assert.match(line?.detail ?? "", /the value 8\.25 above the row's center/u);
  });

  it("fails Android's note 0 dp under its wait where the piece lays out 24, from the group's gap", () => {
    const [finding, ...rest] = failures(real("android lesson wait before 43c393b7c4, writing"));

    assert.equal(rest.length, 0);
    assert.equal(finding?.rule, "gap");
    assert.equal(finding?.measured, -24);
    assert.deepEqual(failures(real("android lesson wait after, writing")), []);
  });

  it("fails Android's two filled actions beside a failed lesson, and passes its fix", () => {
    assert.equal(
      failures(real("android lesson wait before 43c393b7c4, failed"))[0]?.rule,
      "one-filled",
    );

    assert.deepEqual(failures(real("android lesson wait after, failed")), []);
  });

  it("passes Material's chevrons by their box and a chevron clipped under a bar by its slot", () => {
    const ends = evaluateCapture(real("android today rows with chevrons, phone")).filter(
      (finding) => finding.rule === "end-edge",
    );

    assert.deepEqual(ends, []);
  });

  it("judges a row whose value stacked under its label by what still applies", () => {
    const findings = evaluateCapture(real("android plan rows stacked at 200%, phone"));
    const line = findings.find((finding) => finding.detail.includes("Learn Python"));

    assert.deepEqual(
      findings.filter((finding) => finding.rule === "end-edge" || finding.rule === "label-start"),
      [],
    );

    assert.match(line?.detail ?? "", /the mark 16\.73 below the label's first line/u);
  });

  it("reads a right-to-left group mirrored, so its start is its right edge", () => {
    const rtl = fixtureCapture([
      element({ direction: "rtl", endEdge: 16, group: null, id: "g", part: "group" }),
      element({ bounds: [16, 0, 358, 44], id: "r0", part: "row" }),
      element({ bounds: [16, 44, 358, 44], id: "r1", part: "row" }),
      element({ firstLine: [200, 12, 150, 20], id: "l0", part: "label", row: "r0" }),
      element({ firstLine: [250, 56, 100, 20], id: "l1", part: "label", row: "r1" }),
    ]);

    assert.deepEqual(evaluateCapture(rtl), []);
  });

  it("makes a stack-grouped row's fault a lead, not a failure", () => {
    const stack = fixtureCapture([
      element({ group: null, id: "g", part: "group", source: "stack" }),
      element({ firstLine: [16, 12, 100, 20], id: "l0", part: "label", row: "r0" }),
      element({ firstLine: [52, 56, 100, 20], id: "l1", part: "label", row: "r1" }),
    ]);

    assert.deepEqual(
      evaluateCapture(stack).map((finding) => finding.level),
      ["discovery"],
    );
  });
});

describe("relationships with no vote", () => {
  it("fails two neighbors farther apart than their flow's gap, with two rows alone", () => {
    const findings = evaluateCapture(
      fixtureCapture([
        element({ group: null, id: "g", part: "group", piece: "sidebar-stack" }),
        element({
          bounds: [0, 0, 100, 32],
          flow: "f",
          gapBefore: 2,
          id: "a",
          part: "row",
          piece: "sidebar-stack",
        }),
        element({
          bounds: [0, 40, 100, 32],
          flow: "f",
          gapBefore: 2,
          id: "b",
          part: "row",
          piece: "sidebar-stack",
        }),
      ]),
    );

    assert.equal(findings[0]?.rule, "gap");
    assert.equal(findings[0]?.measured, 6);
  });

  it("lets a row without a chevron end its value where the rows with one end theirs", () => {
    const rows = [0, 1].map((index) =>
      element({ bounds: [0, index * 44, 358, 44], endEdge: 358, id: `r${index}`, part: "row" }),
    );

    const findings = evaluateCapture(
      fixtureCapture([
        element({ endEdge: 358, group: null, id: "g", part: "group" }),
        ...rows,
        element({ id: "v0", ink: [300, 14, 30, 16], part: "value", row: "r0" }),
        element({ id: "e0", ink: [347.5, 15, 10.5, 14], part: "end", row: "r0" }),
        element({ id: "v1", ink: [300, 58, 30, 16], part: "value", row: "r1" }),
        element({ bounds: [342, 58, 16, 16], id: "h1", ink: null, part: "holder", row: "r1" }),
      ]),
    );

    assert.deepEqual(findings, []);
  });

  it("fails labels of one role in two type tokens", () => {
    const findings = evaluateCapture(
      fixtureCapture([
        element({ group: null, id: "g", part: "group" }),
        element({ id: "r0", part: "row" }),
        element({ id: "r1", part: "row" }),
        element({ id: "l0", part: "label", row: "r0", type: "Geist 14px 500 19.25px" }),
        element({ id: "l1", part: "label", row: "r1", type: "Geist 14px 400 19.25px" }),
      ]),
    );

    assert.equal(findings[0]?.rule, "type");
  });

  it("fails marks off one axis", () => {
    const findings = evaluateCapture(
      fixtureCapture([
        element({ group: null, id: "g", part: "group" }),
        element({ bounds: [0, 0, 16, 16], id: "m0", part: "mark", row: "r0" }),
        element({ bounds: [0, 44, 16, 16], id: "m1", part: "mark", row: "r1" }),
        element({ bounds: [3, 88, 16, 16], id: "m2", part: "mark", row: "r2" }),
      ]),
    );

    assert.equal(findings[0]?.rule, "mark-axis");
    assert.equal(findings[0]?.measured, 3);
  });

  it("counts filled actions on the active surface only, so a dialog over a page is its own", () => {
    assert.deepEqual(
      evaluateCapture(
        fixtureCapture([...filledActions("page", 1), ...filledActions("Rename", 1)], "Rename"),
      ),
      [],
    );

    assert.equal(evaluateCapture(fixtureCapture(filledActions("page", 2)))[0]?.rule, "one-filled");
  });
});

describe("printing and the summary line", () => {
  it("prints one fault once with each screen it showed on under it", () => {
    const before = real("conditions before 0387bba5c6, phone");
    const tablet = { ...before, configuration: { ...before.configuration, size: "tablet" } };
    const { findings } = evaluateFile({ captures: [before, tablet] });
    const lines = alignmentLines(findings);

    assert.equal(lines.filter((line) => line.startsWith("- **label-start**")).length, 1);
    assert.equal(lines.filter((line) => line.startsWith("  - ")).length, 2);
  });

  it("counts faults, not instances, and fails on any unresolved one", () => {
    const { findings, summary } = evaluateFile({
      captures: [real("plan roadmap before 5ae2e06daa, phone"), real("plan roadmap after, phone")],
      discovery: [
        {
          configuration: "phone touch",
          detail: "",
          level: "discovery",
          message: "cut off",
          piece: "page",
          rule: "cut off",
          scenario: null,
          screen: "/",
        },
      ],
    });

    assert.equal(
      summaryLine(summary),
      "FAIL: 1 unresolved; scenarios not listed yet; 1 discovery leads; 0 not measured",
    );

    assert.equal(summarize(findings.filter((item) => item.level !== "fail")).unresolved, 0);
  });

  it("keeps an excepted fault listed but resolved", () => {
    const findings = applyExceptions(failures(real("plan roadmap before 5ae2e06daa, phone")), [
      {
        configuration: "phone touch",
        grantedBy: "user",
        piece: "plan-roadmap",
        reason: "granted",
        relation: "end-edge",
        scenario: "/plan",
      },
    ]);

    assert.equal(findings[0]?.exception, "granted");
    assert.equal(summarize(findings).unresolved, 0);
  });
});
