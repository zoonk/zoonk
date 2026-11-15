/* oxlint-disable no-magic-numbers -- The fixtures are measurements in pixels. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "vitest";
import { type Capture } from "./alignment-capture.mts";
import { fixtureCapture, real } from "./alignment-fixtures.mts";
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

  it("writes a failing record for an area of a declared group the platform couldn't read", () => {
    const record = evaluateCapture(real("android lesson wait before 43c393b7c4, writing")).find(
      (finding) => finding.rule === "unreadable",
    );

    assert.equal(record?.level, "not-measured");
    assert.match(record?.detail ?? "", /4 areas: a parent replaced its children's semantics/u);
  });

  it("checks each neighbor pair's gap: a row's own gap doesn't stand in for the group's", () => {
    assert.deepEqual(unmeasured(real("round 2 partial-gap")), ["gap"]);
    assert.equal(evaluateFile({ captures: [real("round 2 partial-gap")] }).summary.failed, true);
  });
});

/** The command's exit for one file holding `content`. */
function exitFor(content: unknown) {
  const path = join(mkdtempSync(join(tmpdir(), "alignment-")), "capture.json");
  writeFileSync(path, JSON.stringify(content));

  return spawnSync(process.execPath, [join(import.meta.dirname, "alignment-cli.mts"), path]).status;
}

describe("what the command accepts", () => {
  it("exits 2 for a capture of another version, a missing field, an unknown unit or a dangling part", () => {
    const valid = fixtureCapture([]);
    const { screen: _screen, ...unnamed } = valid;

    assert.equal(exitFor({ elements: [], version: 99 }), 2);
    assert.equal(exitFor(unnamed), 2);
    assert.equal(exitFor(real("round 2 invalid-unit")), 2);
    assert.equal(exitFor({ ...valid, platform: "web" }), 2);

    assert.equal(
      exitFor(
        fixtureCapture([
          {
            bounds: [0, 0, 1, 1],
            group: "g",
            id: "l",
            ink: null,
            part: "label",
            piece: "list-group",
            row: null,
          },
        ]),
      ),
      2,
    );
  });

  it("passes a valid capture with nothing declared", () => {
    assert.equal(exitFor(fixtureCapture([])), 0);
  });
});
