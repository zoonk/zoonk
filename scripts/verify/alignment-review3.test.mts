// @vitest-environment jsdom
/* oxlint-disable no-magic-numbers -- Fixtures reproduce the review's browser measurements. */
import assert from "node:assert/strict";
import { describe, it, vi } from "vitest";
import { read, setHit, setUpProbeDom } from "./alignment-probe-dom.mts";
import { evaluateCapture } from "./alignment.mts";

setUpProbeDom();

function hits(rule: string) {
  return evaluateCapture(read()).filter((finding) => finding.rule === rule);
}

describe("third alignment review", () => {
  it("keeps smaller text before a large title on the same line, in reading order (n01, n10)", () => {
    document.body.innerHTML =
      '<h1 data-box="16,0,358,40"><span data-box="16,23,24,14">New</span> Learn words</h1>';

    vi.spyOn(Range.prototype, "getClientRects").mockImplementation(function rects(this: Range) {
      const small = this.commonAncestorContainer.parentElement?.matches("span");
      const rect = small ? new DOMRect(16, 23, 8, 14) : new DOMRect(24, 0, 8, 40);

      return {
        0: rect,
        item: () => rect,
        length: 1,
        [Symbol.iterator]: () => [rect][Symbol.iterator](),
      };
    });

    assert.deepEqual(read().elements.find((part) => part.part === "text")?.lineTexts, [
      "New Learn words",
    ]);

    assert.deepEqual(hits("lone-word"), []);
  });

  it.each([
    ['<span data-box="16,0,220,20">Go <img data-box="36,0,200,20"></span>', "n08"],
    [
      '<p style="margin:0;border:1px solid black" data-box="16,0,120,60"><span data-box="20,4,30,20">Tag</span></p>',
      "n09",
    ],
  ])("measures clipped pictures and painted boxes: %s (%s)", (content) => {
    document.body.innerHTML = `<div style="overflow-x:hidden;overflow-y:hidden" data-box="16,0,120,30">${content}</div>`;

    vi.spyOn(Range.prototype, "getClientRects").mockImplementation(() => {
      const rect = new DOMRect(20, 4, 30, 20);

      return {
        0: rect,
        item: () => rect,
        length: 1,
        [Symbol.iterator]: () => [rect][Symbol.iterator](),
      };
    });

    assert.equal(hits("cut").length, 1);
  });

  it("does not fold an escaping fixed subtree back into its parent's ink (n06)", () => {
    document.body.innerHTML = `<div style="overflow-y:hidden" data-box="16,0,200,100"><p data-box="16,0,200,20">Short page<span style="position:fixed" data-box="16,700,100,44"><button data-box="16,700,100,44">Continue</button></span></p></div>`;
    assert.deepEqual(hits("cut"), []);
    const clip = document.querySelector("div");
    assert.ok(clip);
    clip.style.transform = "translateZ(0)";
    assert.equal(hits("cut").length, 1);
  });

  it("ignores an absolute descendant with a viewport containing block, but not a local one (n07, n11)", () => {
    document.body.innerHTML = `<div style="overflow-y:hidden" data-box="16,0,200,100"><span style="position:absolute" data-box="16,700,100,44"><button data-box="16,700,100,44">Continue</button></span></div>`;
    assert.deepEqual(hits("cut"), []);
    const clip = document.querySelector("div");
    assert.ok(clip);
    clip.style.position = "relative";
    assert.equal(hits("cut").length, 1);
  });

  it("requires a kit scroller slot even when a plain scroller has a mask (n03)", () => {
    document.body.innerHTML =
      '<div style="overflow-x:auto;mask-image:linear-gradient(to right, transparent, black 16px)" data-box="16,0,200,100"><div data-box="16,0,600,100">Calendar</div></div>';

    const viewport = document.querySelector("div");
    assert.ok(viewport);
    Object.defineProperties(viewport, { clientWidth: { value: 200 }, scrollWidth: { value: 600 } });
    assert.equal(hits("cut").length, 1);
    viewport.dataset.slot = "contribution-calendar-viewport";
    viewport.style.maskImage = "none";
    assert.deepEqual(hits("cut"), []);
  });

  it("counts a drawer sheet as its own surface over a page with a filled action (FS-D14)", () => {
    document.body.innerHTML = `<button style="--button-variant:default" data-box="16,20,120,44">Next</button><div data-slot="drawer-popup" aria-label="Ask" data-box="0,400,390,444"><button style="--button-variant:default" data-box="16,700,358,44">Create a free account</button></div>`;
    setHit(document.querySelector("[data-slot=drawer-popup] button"));
    assert.notEqual(read().activeSurface, "page");
    assert.deepEqual(hits("one-filled"), []);
    const second = document.createElement("button");
    second.style.setProperty("--button-variant", "default");
    second.dataset.box = "16,750,358,44";
    second.textContent = "Another action";
    document.querySelector("[data-slot=drawer-popup]")?.append(second);
    assert.equal(hits("one-filled").length, 1);
  });
});
