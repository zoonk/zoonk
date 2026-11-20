// @vitest-environment jsdom
/* oxlint-disable no-magic-numbers -- Fixtures reproduce browser geometry measured on real pages. */
import assert from "node:assert/strict";
import { describe, it, vi } from "vitest";
import { read, setUpProbeDom } from "./alignment-probe-dom.mts";
import { evaluateCapture } from "./alignment.mts";

setUpProbeDom();

function hits(rule: string) {
  return evaluateCapture(read()).filter((finding) => finding.rule === rule);
}

function rangeRect(rect: DOMRect) {
  return {
    0: rect,
    item: () => rect,
    length: 1,
    [Symbol.iterator]: () => [rect][Symbol.iterator](),
  };
}

describe("alignment of text and controls", () => {
  it("separates Geist title lines even when their glyph boxes overlap", () => {
    document.body.innerHTML = '<h2 data-box="16,0,150,48">Faltam 3 dias</h2>';

    vi.spyOn(Range.prototype, "getClientRects").mockImplementation(function rects(this: Range) {
      return rangeRect(new DOMRect(16, this.startOffset < 9 ? 0 : 24, 8, 28));
    });

    assert.deepEqual(read().elements.find((part) => part.part === "text")?.lineTexts, [
      "Faltam 3",
      "dias",
    ]);

    assert.equal(hits("lone-word").length, 1);
  });

  it("keeps a row description distinct from its button label", () => {
    document.body.innerHTML = `<button data-slot="list-row" style="display:flex" data-box="16,0,358,80">
      <span data-slot="list-row-content" style="display:flex;flex-direction:column" data-box="16,0,358,80">
      <span data-slot="list-row-title" data-box="16,0,200,20">Mistakes</span>
      <span data-slot="list-row-description" data-box="16,24,170,40">Review before – tomorrow</span></span></button>`;

    vi.spyOn(Range.prototype, "getClientRects").mockImplementation(function rects(this: Range) {
      const description = this.commonAncestorContainer.parentElement?.matches(
        "[data-slot=list-row-description]",
      );

      const line = this.startOffset < 16 ? 24 : 44;
      return rangeRect(new DOMRect(16, description ? line : 0, 8, 20));
    });

    assert.deepEqual(hits("line-end"), []);
    assert.deepEqual(hits("lone-word"), []);

    assert.equal(
      read().elements.find((part) => part.name?.includes("Review before"))?.textRole,
      undefined,
    );
  });

  it.each(["answer-option", "match-entry"])("allows prose wrapping in %s cards", (slot) => {
    const option = document.createElement("button");
    option.dataset.slot = slot;
    option.dataset.box = "16,0,150,48";
    option.textContent = "Review the answers";
    document.body.append(option);

    vi.spyOn(Range.prototype, "getClientRects").mockImplementation(function rects(this: Range) {
      return rangeRect(new DOMRect(16, this.startOffset < 11 ? 0 : 24, 8, 20));
    });

    assert.deepEqual(read().elements.find((part) => part.part === "text")?.lineTexts, [
      "Review the",
      "answers",
    ]);

    assert.deepEqual(hits("lone-word"), []);
  });

  it("recognizes the calendar's kit viewport by slot", () => {
    document.body.innerHTML =
      '<div data-slot="contribution-calendar-viewport" style="overflow-x:auto" data-box="16,0,200,100"><div data-box="16,0,600,100">Calendar</div></div>';

    const viewport = document.querySelector("div");
    assert.ok(viewport);
    Object.defineProperties(viewport, { clientWidth: { value: 200 }, scrollWidth: { value: 600 } });
    assert.deepEqual(hits("cut"), []);
    delete viewport.dataset.slot;
    viewport.className = "scroll-fade-x";
    assert.equal(hits("cut").length, 1);
  });

  it("does not join separate table cells into a wrapped facts line", () => {
    document.body.innerHTML = `
      <table data-box="16,0,358,80"><tbody>
        <tr><td><span data-box="16,0,75,16">Official</span></td><td><span data-box="104,0,16,16">—</span></td></tr>
        <tr><td><span data-box="16,20,75,16">Office · English</span></td><td><span data-box="104,20,28,16">1 exam</span></td></tr>
      </tbody></table>`;

    assert.deepEqual(hits("line-end"), []);
    const lines = read().elements.filter((element) => element.part === "text");

    assert.deepEqual(lines.find((element) => element.text === "Office · English")?.lineTexts, [
      "Office · English",
    ]);
  });

  it("compares row controls across a display-contents form", () => {
    document.body.innerHTML = `<div data-box="16,0,358,44"><form style="display:contents"><button data-box="16,4,120,36">Skip</button></form><button data-box="144,0,120,44">Continue</button></div>`;
    assert.equal(hits("one-height").length, 1);
    const form = document.querySelector("form");
    assert.ok(form);
    form.style.display = "block";
    assert.deepEqual(hits("one-height"), []);
  });

  it("does not clip a viewport-fixed descendant, but clips one contained by the wrapper", () => {
    document.body.innerHTML = `<div data-box="16,0,200,100" style="overflow-y:hidden"><span data-box="16,0,200,20">Short page</span><div style="position:fixed" data-box="16,700,200,44"><span data-box="16,712,100,20">Continue</span></div></div>`;
    assert.deepEqual(hits("cut"), []);
    const clip = document.querySelector("div");
    assert.ok(clip);
    clip.style.transform = "translateZ(0)";
    assert.equal(hits("cut").length, 1);
  });
});
