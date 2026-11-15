/* oxlint-disable no-magic-numbers -- The fixtures are measurements in pixels. */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { type Bounds, type Capture } from "./alignment-capture.mts";
import { LABEL_TYPE, element, fixtureCapture } from "./alignment-fixtures.mts";
import { evaluateCapture } from "./alignment.mts";

/**
 * A row 60 tall (center 30) whose label's first line has its capitals' middle at 15, with a mark,
 * a lead, a value or an end centered at `at`, and `notes` descriptions under the label.
 */
function lineRow(part: "end" | "lead" | "mark" | "value", at: number, notes: number) {
  return fixtureCapture([
    element({ group: null, id: "g", part: "group" }),
    element({ bounds: [0, 0, 358, 60], id: "r0", part: "row" }),
    element({
      capBottom: 20,
      capTop: 10,
      id: "l0",
      ink: [28, 8, 100, 14],
      lines: 1,
      part: "label",
      row: "r0",
    }),
    ...Array.from({ length: notes }, (_, index) =>
      element({ id: `n${index}`, ink: [28, 24 + index * 14, 100, 12], part: "note", row: "r0" }),
    ),
    part === "mark" || part === "end"
      ? element({ id: "p", ink: [0, at - 5, 10, 10], part, row: "r0" })
      : element({
          capBottom: at + 4,
          capTop: at - 4,
          id: "p",
          ink: [0, at - 6, 10, 12],
          part,
          row: "r0",
        }),
  ]);
}

/** The same row 30 tall, so its one line is the row. */
function oneLine(at: number) {
  const capture = lineRow("mark", at, 0);

  return {
    ...capture,
    elements: capture.elements.map((item) =>
      item.part === "row" ? { ...item, bounds: [0, 0, 358, 30] as Bounds } : item,
    ),
  };
}

/** The same row with a text lead (a date) on its label's first line. */
function led(capture: Capture): Capture {
  return {
    ...capture,
    elements: [
      ...capture.elements,
      element({
        capBottom: 19,
        capTop: 11,
        id: "date",
        ink: [0, 9, 20, 12],
        part: "lead",
        row: "r0",
        type: LABEL_TYPE,
      }),
    ],
  };
}

/** The same capture with its label measured by its ideographic face (Japanese, Korean). */
function faced(capture: Capture): Capture {
  return {
    ...capture,
    elements: capture.elements.map((item) =>
      item.part === "label" ? { ...item, textBox: "ideographic face" } : item,
    ),
  };
}

function lineMiss(capture: Capture) {
  return evaluateCapture(capture).find((finding) => finding.rule === "line")?.detail ?? "";
}

describe("one line of a row, as craft E5 places each part", () => {
  it("puts a mark beside one line on that line's middle", () => {
    assert.equal(lineMiss(oneLine(15)), "");
    assert.match(lineMiss(oneLine(16)), /the mark 1 below the label's middle/u);
  });

  it("puts a mark beside a title and one description on the row's center", () => {
    assert.equal(lineMiss(lineRow("mark", 30, 1)), "");
    assert.match(lineMiss(lineRow("mark", 15, 1)), /the mark 15 above the row's center/u);
  });

  it("puts a mark beside a title and two descriptions on the first line", () => {
    assert.equal(lineMiss(lineRow("mark", 15, 2)), "");
    assert.match(lineMiss(lineRow("mark", 30, 2)), /the mark 15 below the label's first line/u);
  });

  it("puts a text lead on the first line however many follow, and a value on the row's center", () => {
    assert.equal(lineMiss(lineRow("lead", 15, 1)), "");
    assert.match(lineMiss(lineRow("lead", 30, 1)), /the lead 15 below the label's first line/u);
    assert.equal(lineMiss(lineRow("value", 30, 2)), "");
    assert.match(lineMiss(lineRow("value", 15, 2)), /the value 15 above the row's center/u);
  });

  it("puts every part of a row with a text lead on its first entry's line (craft E6)", () => {
    assert.equal(lineMiss(led(lineRow("value", 15, 1))), "");

    assert.match(
      lineMiss(led(lineRow("value", 20, 1))),
      /the value 5 below the label's first line/u,
    );
  });

  it("sets a label with no capitals (Japanese, Korean) on its ideographic face, and says so", () => {
    assert.equal(lineMiss(faced(oneLine(15))), "");

    assert.match(
      lineMiss(faced(oneLine(16))),
      /the mark 1 below the label's middle \(the label by its ideographic face: it has no capitals\)/u,
    );
  });
});

function line(capture: Capture) {
  return evaluateCapture(capture).filter((finding) => finding.rule === "line");
}

/** The `type` findings, the row's label given the kit's label type. */
function type(capture: Capture) {
  const typed = {
    ...capture,
    elements: capture.elements.map((item) =>
      item.id === "l0" ? { ...item, type: LABEL_TYPE } : item,
    ),
  };

  return evaluateCapture(typed).filter((finding) => finding.rule === "type");
}

/** The row with a value drawn only as glyphs (a day's kind marks), its ink centered at `at`. */
function glyphValue(at: number) {
  const capture = lineRow("value", at, 0);

  return {
    ...capture,
    elements: capture.elements.map((item) =>
      item.id === "p"
        ? { ...item, capBottom: undefined, capTop: undefined, type: undefined }
        : item,
    ),
  };
}

describe("a value drawn only as glyphs", () => {
  it("is read by its ink, as a mark is, and a value whose words weren't measured still isn't", () => {
    assert.deepEqual(line(glyphValue(15)), []);
    assert.equal(line(glyphValue(19))[0]?.level, "fail");

    const unmeasured = lineRow("value", 15, 0);

    const words = {
      ...unmeasured,
      elements: unmeasured.elements.map((item) =>
        item.id === "p" ? { ...item, capTop: "not measured" as const } : item,
      ),
    };

    assert.equal(line(words)[0]?.level, "not-measured");
  });

  it("has no type to compare, while a value whose words weren't typed still fails as unmeasured", () => {
    assert.deepEqual(type(glyphValue(15)), []);

    const words = lineRow("value", 15, 0);

    const untyped = {
      ...words,
      elements: words.elements.map((item) =>
        item.id === "p" ? { ...item, type: undefined } : item,
      ),
    };

    assert.equal(type(untyped)[0]?.level, "not-measured");
  });
});

/** AP1's stacked row at accessibility sizes: its mark at `markTop`, the label from 40 to 60. */
function stackedRow(markTop: number) {
  return fixtureCapture([
    element({ group: null, id: "g", part: "group" }),
    element({ bounds: [0, 0, 358, 120], id: "r0", part: "row", stacked: true }),
    element({ id: "m", ink: [16, markTop, 24, 24], part: "mark", row: "r0" }),
    element({
      capBottom: 56,
      capTop: 44,
      id: "l0",
      ink: [16, 40, 200, 20],
      lines: 1,
      part: "label",
      row: "r0",
      type: LABEL_TYPE,
    }),
  ]);
}

describe("a stacked row's mark (AP1's C4)", () => {
  it("has a line of its own above the words, and one beside them still shares theirs", () => {
    assert.deepEqual(line(stackedRow(8)), []);
    assert.equal(line(stackedRow(44))[0]?.level, "fail");
  });
});
