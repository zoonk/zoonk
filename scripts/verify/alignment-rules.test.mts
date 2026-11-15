/* oxlint-disable no-magic-numbers -- The fixtures are measurements in pixels. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "vitest";
import { type Bounds, type Capture } from "./alignment-capture.mts";
import {
  LABEL_TYPE,
  element,
  endFindings,
  failures,
  filledActions,
  fixtureCapture,
  labelledRows,
  real,
  valueList,
} from "./alignment-fixtures.mts";
import { alignmentLines, summarize, summaryLine } from "./alignment-summary.mts";
import { applyExceptions, evaluateCapture, evaluateFile } from "./alignment.mts";

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
    const rows = labelledRows(2);

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

    assert.deepEqual(
      findings.filter((finding) => finding.rule === "end-edge"),
      [],
    );
  });

  it("holds a list's values to one edge: a kept chevron slot passes, a value that ends the row fails", () => {
    assert.deepEqual(endFindings(valueList(330)), []);
    assert.match(endFindings(valueList(358))[0]?.message ?? "", /values .* don't end on one edge/u);
  });

  it("fails labels of one role in two type tokens", () => {
    const findings = evaluateCapture(
      fixtureCapture([
        element({ gap: 0, group: null, id: "g", part: "group" }),
        ...labelledRows(2),
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
        ...labelledRows(3),
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

  it("counts only enabled filled actions: a disabled one draws gray and isn't a choice yet", () => {
    assert.deepEqual(evaluateCapture(fixtureCapture(checkAndRun(true))), []);

    assert.equal(
      evaluateCapture(fixtureCapture(checkAndRun(false)))[0]?.detail,
      "Check, Run on page",
    );
  });
});

/** A lesson's Check beside an activity's own Run, both filled. */
function checkAndRun(disabled: boolean) {
  return filledActions("page", 2).map((action, index) =>
    index === 0 ? { ...action, disabled, name: "Check" } : { ...action, name: "Run" },
  );
}

const GROUP = element({ endEdge: 358, gap: 0, group: null, id: "g", part: "group" });

function marks(first: number, second: number) {
  return fixtureCapture([
    GROUP,
    ...labelledRows(2),
    element({ bounds: [first, 0, 16, 10], id: "m0", part: "mark", row: "r0" }),
    element({ bounds: [second, 44, 16, 10], id: "m1", part: "mark", row: "r1" }),
  ]);
}

function rules(capture: Capture) {
  return evaluateCapture(capture).map((finding) => `${finding.level} ${finding.rule}`);
}

function run(...files: { content: unknown; name: string }[]) {
  const folder = mkdtempSync(join(tmpdir(), "alignment-"));

  const paths = files.map(({ content, name }) => {
    const path = join(folder, name);
    writeFileSync(path, JSON.stringify(content));
    return path;
  });

  return spawnSync(process.execPath, [join(import.meta.dirname, "alignment-cli.mts"), ...paths])
    .status;
}

const MOVED: Bounds = [0, 46, 358, 44];

describe("what the review found the checks could pass unmeasured", () => {
  const group = GROUP;

  it("compares marks by their measured centers: 1.3 apart fails, 0.8 apart passes", () => {
    assert.equal(failures(marks(0.6, 1.9))[0]?.rule, "mark-axis");
    assert.deepEqual(failures(marks(0.4, 1.2)), []);
  });

  it("fails a declared group with no rows, a part whose ink wasn't measured, and an unknown piece", () => {
    assert.deepEqual(rules(fixtureCapture([group])), ["not-measured rows"]);

    assert.deepEqual(
      rules(
        fixtureCapture([
          group,
          ...labelledRows(2),
          element({ id: "v", ink: "not measured", part: "value", row: "r0" }),
        ]),
      ).filter((rule) => rule !== "not-measured line"),
      ["not-measured ink"],
    );

    assert.deepEqual(rules(fixtureCapture([{ ...group, piece: "typo" }])), ["not-measured piece"]);

    assert.equal(summarize(evaluateCapture(fixtureCapture([group]))).failed, true);
  });

  it("reads a native capture's group gap: rows 2 dp apart in a 2 dp group pass", () => {
    const native = fixtureCapture([
      { ...group, gap: 2 },
      ...labelledRows(2).map((part) =>
        part.part === "row" && part.id === "r1" ? { ...part, bounds: MOVED } : part,
      ),
    ]);

    assert.deepEqual(
      evaluateCapture(native).filter((finding) => finding.rule === "gap"),
      [],
    );
  });

  it("reads rows side by side as not measured instead of one column with an odd row", () => {
    const columns = fixtureCapture([
      group,
      element({ bounds: [0, 0, 150, 30], id: "r0", part: "row" }),
      element({ bounds: [152, 0, 150, 30], id: "r1", part: "row" }),
      element({ id: "l0", ink: [8, 5, 20, 20], part: "label", row: "r0", type: LABEL_TYPE }),
      element({ id: "l1", ink: [160, 5, 20, 20], part: "label", row: "r1", type: LABEL_TYPE }),
    ]);

    assert.deepEqual(
      evaluateCapture(columns).map((finding) => `${finding.level} ${finding.rule}`),
      ["not-measured stack"],
    );
  });
});

describe("the command", () => {
  it("exits 2 for a named file with no captures, and for one that isn't a capture", () => {
    const capture = real("plan roadmap after, phone");

    assert.equal(run({ content: { captures: [] }, name: "empty.json" }), 2);

    assert.equal(
      run({ content: capture, name: "one.json" }, { content: {}, name: "other.json" }),
      2,
    );

    assert.equal(
      run({ content: real("plan roadmap before 5ae2e06daa, phone"), name: "one.json" }),
      1,
    );
  });
});

/** A declared group of one row with no label, named `name`. */
function unlabelled(name: string) {
  return fixtureCapture([
    element({ endEdge: 358, gap: 0, group: null, id: "g", name, part: "group" }),
    element({ bounds: [0, 0, 358, 44], id: "r0", name: `${name} row`, part: "row" }),
  ]);
}

describe("printing and the summary line", () => {
  it("prints one fault once with each screen it showed on under it", () => {
    const before = real("conditions before 0387bba5c6, phone");
    const tablet = { ...before, configuration: { ...before.configuration, size: "tablet" } };
    const { findings } = evaluateFile({ captures: [before, tablet] });
    const lines = alignmentLines(findings);

    assert.equal(lines.filter((line) => line.startsWith("- **label-start**")).length, 1);
    assert.equal(lines.filter((line) => line.startsWith("  - ")).length, 10);
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
      "FAIL: 1 unresolved; scenarios not listed yet; 1 discovery leads; 4 not measured",
    );

    assert.equal(summarize(findings.filter((item) => item.level !== "fail")).unresolved, 0);
  });

  it("prints one not-measured reason once with its count, and every group's rows under it", () => {
    const lines = alignmentLines(
      evaluateFile({ captures: [unlabelled("Today"), unlabelled("Plan")] }).findings,
    );

    assert.deepEqual(
      lines.filter((line) => line.startsWith("- ")),
      ["- **label**: list-group: a row's label wasn't found (2 groups)"],
    );

    assert.match(lines.join("\n"), /list-group Today: Today row; list-group Plan: Plan row/u);
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
