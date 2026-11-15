/* oxlint-disable no-magic-numbers -- The fixtures are measurements in pixels. */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { type CaptureElement } from "./alignment-capture.mts";
import { element, fixtureCapture } from "./alignment-fixtures.mts";
import { evaluateCapture } from "./alignment.mts";

/**
 * The relationships the sweep found by eye that no check measured (WHY-MISSED.md, class M), each
 * with its number: what a capture records of the page, and the count that fails.
 */
function findings(rule: string, elements: CaptureElement[]) {
  return evaluateCapture(fixtureCapture(elements))
    .filter((finding) => finding.rule === rule)
    .map((finding) => finding.detail);
}

function text(lineTexts: string[], textRole?: CaptureElement["textRole"]) {
  return element({
    group: null,
    id: "text",
    lineTexts,
    name: `"${lineTexts.join(" ")}"`,
    part: "text",
    piece: "page",
    ...(textRole ? { textRole } : {}),
  });
}

describe("a line never ends with a separator: lines ending in a dot, a dash or a slash = 0", () => {
  it("fails a facts line that wraps after its middle dot (C-W04)", () => {
    assert.deepEqual(findings("line-end", [text(["2 min · Nível A2 ·", "4 objetivos"], "facts")]), [
      '"2 min · Nível A2 · 4 objetivos": line 1 ends with "·"',
    ]);
  });

  it("fails a spaced dash or slash at a line's end, in any text", () => {
    assert.equal(findings("line-end", [text(["Monday —", "Friday"])]).length, 1);
    assert.equal(findings("line-end", [text(["3 /", "5 done"])]).length, 1);
  });

  it("passes a hyphenated word or a path broken where it may break, and a dot that starts a line", () => {
    assert.deepEqual(findings("line-end", [text(["a well-", "known rule"])]), []);
    assert.deepEqual(findings("line-end", [text(["zoonk.com/plan/", "abc"])]), []);
    assert.deepEqual(findings("line-end", [text(["2 min", "· Nível A2"], "facts")]), []);
  });
});

describe("a wrapped title, facts line or button label never leaves one short word alone", () => {
  it('fails a last line of one word of 8 characters or fewer (C-W04\'s "dias")', () => {
    assert.deepEqual(findings("lone-word", [text(["Faltam 3", "dias"], "title")]), [
      '"Faltam 3 dias": "dias" alone on its last line',
    ]);
  });

  it("passes two words, a longer word, one line, and running text that isn't a title", () => {
    assert.deepEqual(findings("lone-word", [text(["Your plan for", "the week"], "title")]), []);
    assert.deepEqual(findings("lone-word", [text(["Uma semana", "concluídas"], "facts")]), []);
    assert.deepEqual(findings("lone-word", [text(["Build my plan"], "button")]), []);
    assert.deepEqual(findings("lone-word", [text(["A sentence that wraps", "here"])]), []);
  });

  it("counts a number as a word and a separator alone as none", () => {
    assert.equal(findings("lone-word", [text(["Level A2 ·", "+200"], "facts")]).length, 1);
    assert.deepEqual(findings("lone-word", [text(["Level A2 · 4", "·"], "facts")]), []);
  });
});

function control(
  id: string,
  [x, y, width, height]: [number, number, number, number],
  surface = "page",
) {
  return element({
    bounds: [x, y, width, height],
    group: null,
    id,
    name: `"${id}"`,
    part: "control",
    piece: "page",
    surface,
  });
}

describe("controls in one row share a height: distinct heights per row = 1", () => {
  it("fails a 36 px Save beside a 44 px date field (C-W06)", () => {
    assert.deepEqual(
      findings("one-height", [
        control("date", [16, 100, 260, 44]),
        control("Save", [284, 104, 90, 36]),
      ]),
      ['"date" 44, "Save" 36'],
    );
  });

  it("fails a label that wraps to 62 px beside a 44 px button (C-W07)", () => {
    assert.equal(
      findings("one-height", [
        control("Back to Today", [16, 780, 170, 44]),
        control("Create a free account", [194, 771, 180, 62]),
      ]).length,
      1,
    );
  });

  it("passes one height, controls in different rows or far apart, and a dialog's over the page's", () => {
    assert.deepEqual(
      findings("one-height", [
        control("Skip", [16, 784, 95, 44]),
        control("Continue", [119, 784, 255, 44]),
      ]),
      [],
    );

    assert.deepEqual(
      findings("one-height", [
        control("Add", [16, 100, 90, 36]),
        control("Save", [16, 150, 90, 44]),
      ]),
      [],
    );

    assert.deepEqual(
      findings("one-height", [
        control("Back", [16, 20, 44, 44]),
        control("Share", [300, 24, 74, 36]),
      ]),
      [],
    );

    assert.deepEqual(
      findings("one-height", [
        control("Field", [16, 100, 260, 44]),
        control("Close", [284, 104, 36, 36], "Rename #1"),
      ]),
      [],
    );
  });
});

function cut(name: string, overflow: [number, number]) {
  return element({
    bounds: [16, 300, 358, 120],
    group: null,
    id: `cut.${name}`,
    name: '"Card"',
    overflow,
    part: "cut",
    piece: "page",
    text: name,
  });
}

describe("nothing is cut that isn't in a scroller: a text or control past its visible box = 0", () => {
  it("fails a keyboard wider than its card, by how far it passes (C-W51)", () => {
    assert.deepEqual(findings("cut", [cut('"C D E F G A B"', [96, 0])]), [
      '"C D E F G A B" is cut by "Card": 96 past it across',
    ]);
  });

  it("says how far down, too", () => {
    assert.deepEqual(findings("cut", [cut('"SELECT name"', [0, 18])]), [
      '"SELECT name" is cut by "Card": 18 past it down',
    ]);
  });
});

/** A list row whose title's capitals are `title` tall and its helper's `helper`. */
function helped(title: number, helper: number) {
  return [
    element({ bounds: [16, 0, 358, 300], group: null, id: "g", part: "group" }),
    element({ bounds: [16, 0, 358, 56], id: "r0", part: "row" }),
    element({
      capBottom: 20 + title,
      capTop: 20,
      id: "t0",
      ink: [16, 14, 120, 20],
      part: "label",
      row: "r0",
      text: "Rename",
    }),
    element({
      capBottom: 40 + helper,
      capTop: 40,
      id: "n0",
      ink: [16, 36, 160, 16],
      part: "note",
      row: "r0",
      text: "Change what you call it",
    }),
  ];
}

describe("a helper's text is smaller than its title in the same group", () => {
  it("compares multiword font families even when the script has no measured capitals", () => {
    const elements = helped(0, 0).map((part) => ({
      ...part,
      capBottom: "not measured" as const,
      capTop: "not measured" as const,
      type: part.part === "label" ? "Geist Mono 14px 500 20px" : "Geist Mono 12px 400 16px",
    }));

    assert.deepEqual(findings("helper", elements), []);
  });

  it("passes a 12 px helper under a 14 px title, by their capitals", () => {
    assert.deepEqual(findings("helper", helped(9.9, 8.5)), []);
  });

  it("fails a helper as large as its title or larger (C-A06, C-N10)", () => {
    assert.deepEqual(findings("helper", helped(9.9, 9.9)), [
      '"Rename": its helper "Change what you call it" is 9.9 tall, its title 9.9',
    ]);

    assert.equal(findings("helper", helped(8.5, 9.9)).length, 1);
  });
});
