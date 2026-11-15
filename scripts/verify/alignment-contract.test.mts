/* oxlint-disable no-magic-numbers -- The fixtures are measurements in pixels. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "vitest";
import { type Capture } from "./alignment-capture.mts";
import { filledActions, fixtureCapture, real } from "./alignment-fixtures.mts";
import { summaryLine } from "./alignment-summary.mts";
import { readCaptures } from "./alignment-validate.mts";
import { alignmentSection } from "./alignment-web.mts";
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

    // A word in a value's place ("Off") isn't compared with figures, but its type is still read.
    assert.deepEqual(unmeasured(real("round 3 missing-word-value-type")), ["type"]);
  });

  it("writes a failing record for an area of a declared group the platform couldn't read", () => {
    const record = evaluateCapture(real("android lesson wait before 43c393b7c4, writing")).find(
      (finding) => finding.rule === "unreadable",
    );

    assert.equal(record?.level, "not-measured");
    assert.match(record?.detail ?? "", /4 areas: a parent replaced its children's semantics/u);
  });

  it("writes a failing record for a row middle the capture says wasn't measured, never a pass", () => {
    assert.deepEqual(unmeasured(real("round 3 line-unknown-middle")), ["line"]);

    assert.equal(
      evaluateFile({ captures: [real("round 3 line-unknown-middle")] }).summary.failed,
      true,
    );

    // The same row with its middle measured: its value is 20 above the row's center.
    assert.match(
      evaluateCapture(real("round 3 known-middle")).find((finding) => finding.rule === "line")
        ?.detail ?? "",
      /the value 20 above the row's center/u,
    );
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

/** What the check says of `content`: its kind, so a refusal reads as "invalid". */
function kindOf(content: unknown) {
  return readCaptures(content).kind;
}

describe("what the command accepts", () => {
  it("refuses a capture of another version, a missing field, an unknown unit or a dangling part", () => {
    const valid = fixtureCapture([]);
    const { screen: _screen, ...unnamed } = valid;

    assert.equal(kindOf({ elements: [], version: 99 }), "invalid");
    assert.equal(kindOf(unnamed), "invalid");
    assert.equal(kindOf(real("round 2 invalid-unit")), "invalid");
    assert.equal(kindOf({ ...valid, platform: "web" }), "invalid");

    assert.equal(
      kindOf(
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
      "invalid",
    );

    assert.equal(kindOf(valid), "captures");
  });

  it("refuses an optional field the evaluator reads when it has another type", () => {
    assert.equal(kindOf(real("round 3 bad-specimen")), "invalid");

    const row = real("round 3 known-middle");

    for (const [field, value] of [
      ["middle", "30"],
      ["lines", "2"],
      ["stacked", "false"],
      ["current", 1],
      ["margins", ["0", 0]],
      ["type", 42],
    ] as const) {
      assert.equal(
        kindOf({
          ...row,
          elements: row.elements.map((item) =>
            item.part === "row" || item.part === "label" ? { ...item, [field]: value } : item,
          ),
        }),
        "invalid",
        field,
      );
    }
  });

  it("exits 2 for a capture it refuses", () => {
    assert.equal(exitFor({ elements: [], version: 99 }), 2);
  });
});

describe("what the command prints of a scenarios file", () => {
  it("counts the missing ones from the file's own list, as verify:scenarios does", () => {
    const capture = { ...fixtureCapture([]), scenario: "plan.path" };
    const path = join(mkdtempSync(join(tmpdir(), "alignment-")), "alignment.json");

    writeFileSync(
      path,
      JSON.stringify({ captures: [capture], required: ["plan.path", "plan.adjust"] }),
    );

    const { stdout } = spawnSync(
      process.execPath,
      [join(import.meta.dirname, "alignment-cli.mts"), path],
      { encoding: "utf8" },
    );

    assert.match(stdout, /; 1 required scenario missing;/u);
  });
});

describe("what the command says it reads", () => {
  it("names the one pseudo-element it reads and the fills it can't, in the help as in a report", () => {
    const { stdout } = spawnSync(
      process.execPath,
      [join(import.meta.dirname, "alignment-cli.mts"), "--help"],
      { encoding: "utf8" },
    );

    const report = alignmentSection([]).join("\n");

    for (const text of [stdout, report]) {
      assert.match(text, /a row's `::before` highlight/u);
      assert.match(text, /hover/u);
    }
  });
});

describe("a folder holding more than one capture file (AP1's run1/)", () => {
  it("names each file a finding came from, so an earlier run's never reads as the latest's", () => {
    const folder = mkdtempSync(join(tmpdir(), "alignment-runs-"));
    const capture = fixtureCapture(filledActions("page", 2));

    mkdirSync(join(folder, "run1"));
    writeFileSync(join(folder, "alignment.json"), JSON.stringify({ captures: [capture] }));
    writeFileSync(join(folder, "run1", "alignment.json"), JSON.stringify({ captures: [capture] }));

    const { stdout } = spawnSync(
      process.execPath,
      [join(import.meta.dirname, "alignment-cli.mts"), folder],
      { encoding: "utf8" },
    );

    assert.match(stdout, / · phone touch · alignment\.json: /u);
    assert.match(stdout, / · phone touch · run1\/alignment\.json: /u);
  });
});

describe("capture files named by path (RV97)", () => {
  it("names each by its path from the folder they share, so old/ and new/ never merge", () => {
    const folder = mkdtempSync(join(tmpdir(), "alignment-paths-"));
    const capture = fixtureCapture(filledActions("page", 2));

    for (const run of ["old", "new"]) {
      mkdirSync(join(folder, run));
      writeFileSync(join(folder, run, "alignment.json"), JSON.stringify({ captures: [capture] }));
    }

    const { stdout } = spawnSync(
      process.execPath,
      [
        join(import.meta.dirname, "alignment-cli.mts"),
        join(folder, "old", "alignment.json"),
        join(folder, "new", "alignment.json"),
      ],
      { encoding: "utf8" },
    );

    assert.match(stdout, / · phone touch · old\/alignment\.json: /u);
    assert.match(stdout, / · phone touch · new\/alignment\.json: /u);
  });
});
