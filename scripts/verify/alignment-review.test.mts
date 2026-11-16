// @vitest-environment jsdom
/* oxlint-disable no-magic-numbers -- Review fixtures describe browser geometry in pixels. */
import assert from "node:assert/strict";
import { describe, it, vi } from "vitest";
import { element, fixtureCapture } from "./alignment-fixtures.mts";
import { read, setUpProbeDom } from "./alignment-probe-dom.mts";
import { evaluateCapture, evaluateFile } from "./alignment.mts";

setUpProbeDom();

function hits(rule: string) {
  return evaluateCapture(read()).filter((finding) => finding.rule === rule);
}

describe("reviewed relationships", () => {
  it("excludes the composer's addon and a checkbox from full-height controls (q01, p08)", () => {
    document.body.innerHTML = `<div data-slot="input-group" data-box="16,0,358,44">
      <textarea data-box="16,0,310,44"></textarea><div data-slot="input-group-addon" data-box="326,0,48,44">
      <button data-slot="composer-send" data-box="330,7,30,30">Send</button></div></div>
      <div data-box="16,60,358,44"><input type="checkbox" data-box="16,75,13,13"><button data-box="37,60,120,44">Remember me</button></div>`;

    assert.deepEqual(hits("one-height"), []);
  });

  it("compares sibling buttons and fields with a half-pixel tolerance", () => {
    const controls = [44, 44.75].map((height, index) =>
      element({
        bounds: [index * 108, 100, 100, height],
        group: null,
        id: String(index),
        part: "control",
        piece: "page",
      }),
    );

    assert.equal(
      evaluateCapture(fixtureCapture(controls)).filter((finding) => finding.rule === "one-height")
        .length,
      1,
    );
  });

  it("does not compare controls from separate sibling containers", () => {
    document.body.innerHTML = `<div data-box="0,0,100,44"><button data-box="0,0,100,44">First</button></div>
      <div data-box="108,0,100,36"><button data-box="108,4,100,36">Second</button></div>`;

    assert.deepEqual(hits("one-height"), []);
  });

  it("reads a palette's and cause button's stacked blocks as separate text flows (q02, q03)", () => {
    document.body.innerHTML = `<button style="display:flex;flex-direction:column" data-box="16,0,170,56">
      <span data-box="60,0,50,24">Aa</span><span style="display:flex" data-box="60,26,50,16">Tall</span></button>
      <button style="display:flex;flex-direction:column" data-box="16,70,358,70">
      <span style="display:flex" data-box="28,80,200,16">1929</span><span data-box="28,98,200,20">Crash</span></button>`;

    assert.deepEqual(hits("lone-word"), []);
    assert.equal(read().elements.filter((part) => part.part === "text").length, 4);
  });

  it("reads different font sizes on one baseline as one line (p04)", () => {
    document.body.innerHTML = `<h2 data-box="16,0,200,40"><span data-box="16,0,50,40">$9</span><span data-box="66,23,50,16">/month</span></h2>`;
    assert.deepEqual(hits("lone-word"), []);
  });

  it("does not judge a dash alone or wrapped prose as a trailing separator (p01, p02)", () => {
    document.body.innerHTML = `<div data-box="16,0,100,20">–</div><p data-box="16,30,150,40">A sentence – then more words</p>`;

    vi.spyOn(Range.prototype, "getClientRects").mockImplementation(function rects(this: Range) {
      const at = this.commonAncestorContainer.parentElement;
      const line = this.startOffset < 12 ? 30 : 50;
      const rect = new DOMRect(16, at?.matches("p") ? line : 0, 8, 20);

      return {
        0: rect,
        item: () => rect,
        length: 1,
        [Symbol.iterator]: () => [rect][Symbol.iterator](),
      };
    });

    assert.deepEqual(hits("line-end"), []);
  });

  it("fails plain horizontal overflow but allows the kit's signposted scroller (c02)", () => {
    document.body.innerHTML = `<div style="overflow-x:auto" data-box="16,0,200,44"><button data-box="16,0,400,44">SELECT FROM WHERE</button></div>`;
    const scroller = document.querySelector("div");
    assert.ok(scroller);
    Object.defineProperties(scroller, { clientWidth: { value: 200 }, scrollWidth: { value: 400 } });
    assert.equal(hits("cut").length, 1);
    scroller.dataset.slot = "horizontal-scroll";
    assert.deepEqual(hits("cut"), []);
  });

  it("fails a final word of any length (f05: concluído)", () => {
    const capture = fixtureCapture([
      element({
        group: null,
        id: "facts",
        lineTexts: ["12 lições ·", "concluído"],
        part: "text",
        piece: "page",
        textRole: "facts",
      }),
    ]);

    assert.equal(
      evaluateCapture(capture).filter((finding) => finding.rule === "lone-word").length,
      1,
    );
  });

  it("never turns a helper-only row into a title (h03)", () => {
    document.body.innerHTML = `<div data-slot="list-group" data-box="16,0,358,44"><div data-slot="list-row" data-box="16,0,358,44">
      <span data-slot="list-row-content" data-box="16,0,358,44"><span data-slot="list-row-description" data-box="16,12,200,20">Nothing to review yet</span></span></div></div>`;

    assert.equal(read().elements.filter((part) => part.part === "label").length, 0);
    assert.deepEqual(hits("helper"), []);
  });

  it("fails a ghost hang whose glyph stops inside the column (g01)", () => {
    document.body.innerHTML = `<div data-slot="page" data-box="16,0,358,200"><button style="--button-variant:ghost;background:rgb(240,240,240)" data-box="254,20,160,36">
      <span data-box="318,28,32,20">Skip</span></button></div>`;

    assert.equal(hits("column").length, 1);
    assert.equal(hits("column")[0]?.measured, 24);
  });

  it.each(["web", "apple", "android"] as const)(
    "marks four new relationships unmeasured in an old %s capture",
    (platform) => {
      const capture = {
        ...fixtureCapture([]),
        platform,
        unit: ({ android: "dp", apple: "pt", web: "px" } as const)[platform],
        version: 1 as const,
      };

      const { findings, summary } = evaluateFile({ captures: [capture] });

      assert.deepEqual(
        findings
          .filter((finding) => finding.level === "not-measured")
          .map((finding) => finding.rule)
          .toSorted(),
        ["cut", "line-end", "lone-word", "one-height"],
      );

      assert.equal(summary.notMeasured, 4);
      assert.equal(summary.failed, true);
    },
  );
});
