/* oxlint-disable no-magic-numbers -- The fixtures are measurements in pixels. */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { element, failures, fixtureCapture, real } from "./alignment-fixtures.mts";
import { evaluateCapture } from "./alignment.mts";

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
  it("fails the Trickster row's date 8.3 px above its chevron", () => {
    const [line, ...rest] = failures(real("plan path, phone"));

    assert.equal(rest.length, 0);
    assert.equal(line?.rule, "line");
    assert.match(line?.detail ?? "", /The Trickster.*the value 8\.25 above the row's center/u);
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

  it("fails Material's chevrons 5.7 dp short by their ink, leaving a clipped one unmeasured", () => {
    const ends = evaluateCapture(real("android today rows with chevrons, phone")).filter(
      (finding) => finding.rule === "end-edge",
    );

    // b18-16: the chevron's ink ends inside its icon's box, short of where the dates end.
    assert.deepEqual(
      ends.map((finding) => finding.measured),
      [5.7],
    );
  });

  it("judges a row whose value stacked under its label by what still applies", () => {
    const findings = evaluateCapture(real("android plan rows stacked at 200%, phone"));
    const line = findings.find((finding) => finding.detail.includes("Learn Python"));

    // The stacked value no longer ends the row: only the chevron's own 6 dp short shows.
    assert.deepEqual(
      findings
        .filter((finding) => finding.rule === "end-edge" || finding.rule === "label-start")
        .map((finding) => finding.measured),
      [6, 6],
    );

    // E5: beside a title that wraps, the mark is centered on the row, as Android draws it: it is
    // 0.75 dp off the row's center, not 16.73 off the first line.
    assert.match(line?.detail ?? "", /the mark 0\.75 below the row's center/u);
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
      element({ bounds: [0, 0, 358, 44], id: "r0", part: "row" }),
      element({ bounds: [0, 44, 358, 44], id: "r1", part: "row" }),
      element({ firstLine: [16, 12, 100, 20], id: "l0", part: "label", row: "r0" }),
      element({ firstLine: [52, 56, 100, 20], id: "l1", part: "label", row: "r1" }),
    ]);

    assert.deepEqual(
      evaluateCapture(stack).map((finding) => finding.level),
      ["discovery"],
    );
  });
});
