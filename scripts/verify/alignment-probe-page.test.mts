// @vitest-environment jsdom
/* oxlint-disable no-magic-numbers -- Fixtures are browser measurements in pixels. */
import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { read, setUpProbeDom } from "./alignment-probe-dom.mts";
import { evaluateCapture } from "./alignment.mts";

setUpProbeDom();

test("records the browser's line breaks, rather than the text node's unbroken sentence", () => {
  document.body.innerHTML = '<h1 data-box="16,0,120,40">Faltam 3 dias</h1>';

  vi.spyOn(Range.prototype, "getClientRects").mockImplementation(function rects(this: Range) {
    const rect = new DOMRect(16, this.startOffset >= 9 ? 20 : 0, 8, 20);

    return {
      0: rect,
      item: () => rect,
      length: 1,
      [Symbol.iterator]() {
        return [rect][Symbol.iterator]();
      },
    };
  });

  const capture = read();

  assert.deepEqual(capture.elements.find((part) => part.part === "text")?.lineTexts, [
    "Faltam 3",
    "dias",
  ]);

  assert.equal(evaluateCapture(capture).filter((part) => part.rule === "lone-word").length, 1);
});

test("records outlined controls as well as filled actions for the row-height rule", () => {
  document.body.innerHTML = `<input data-box="16,100,260,44"><button data-box="284,104,90,36">Save</button>`;
  assert.equal(evaluateCapture(read()).filter((part) => part.rule === "one-height").length, 1);
});

test("records content clipped by a card but allows a declared clamp and a nested scroller", () => {
  document.body.innerHTML = `<div style="overflow-x: hidden" data-box="16,0,120,40">
    <span data-box="16,0,180,20">A wide keyboard</span></div>`;

  assert.equal(evaluateCapture(read()).filter((part) => part.rule === "cut").length, 1);
  const words = document.querySelector("span");
  assert.ok(words);
  words.style.overflowX = "auto";
  assert.equal(evaluateCapture(read()).filter((part) => part.rule === "cut").length, 0);
  words.style.overflowX = "hidden";
  words.style.textOverflow = "ellipsis";
  assert.equal(evaluateCapture(read()).filter((part) => part.rule === "cut").length, 0);
});

test("does not mistake a separator in an inline span for the end of the whole line", () => {
  document.body.innerHTML = `<div data-box="16,0,300,20"><span data-box="16,0,40,20">2 min </span><span data-box="56,0,10,20">· </span><span data-box="66,0,100,20">Level A2</span></div>`;
  assert.equal(evaluateCapture(read()).filter((part) => part.rule === "line-end").length, 0);
});
