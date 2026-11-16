// @vitest-environment jsdom
/* oxlint-disable no-magic-numbers -- Fixtures are captured geometry in CSS pixels. */
import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { read, setUpProbeDom } from "./alignment-probe-dom.mts";
import { evaluateCapture } from "./alignment.mts";

setUpProbeDom();

function rectList(rect: DOMRect): DOMRectList {
  return {
    0: rect,
    item: () => rect,
    length: 1,
    [Symbol.iterator]: () => [rect][Symbol.iterator](),
  };
}

function resize(selector: string, geometry: string) {
  const element = document.querySelector<HTMLElement>(selector);
  assert.ok(element);
  element.dataset.box = geometry;
}

const faults = (rule: string) => evaluateCapture(read()).filter((finding) => finding.rule === rule);

test.each([13.6, 14.2, 5.7, 5.2])(
  "facts clip a %s px hung separator, while clipped fact words still fail",
  (hang) => {
    document.body.innerHTML = `<p data-slot="task-meta" data-box="16,0,120,40">
    <span style="display:block; overflow-x:clip" data-box="16,0,120,40">
      <span style="position:relative; display:inline-block" data-box="16,20,100,20">
        <span style="position:absolute; right:100%; white-space:pre" data-box="${16 - hang},20,${hang},20">· </span>
        <span id="fact" data-box="16,20,100,20">364 days left</span>
      </span></span></p>`;

    assert.deepEqual(faults("cut"), []);
    resize("#fact", "16,20,140,20");
    assert.equal(faults("cut").length, 1);
  },
);

test("a wrapped zero-height flex suffix is omitted, while an ordinary clipped label fails", () => {
  document.body.innerHTML = `<span style="display:flex; flex-wrap:wrap; overflow-x:hidden; overflow-y:hidden" data-box="16,0,150,16">
    <span data-box="16,0,150,16">November 14</span>
    <span id="suffix" style="height:0; white-space:pre" data-box="16,16,50,0"> · exam</span></span>`;

  vi.spyOn(Range.prototype, "getClientRects").mockImplementation(function rects(this: Range) {
    const parent = this.commonAncestorContainer.parentElement;

    return rectList(
      parent?.id === "suffix" ? new DOMRect(16, 16, 50, 15) : new DOMRect(16, 0, 150, 16),
    );
  });

  assert.deepEqual(faults("cut"), []);
  resize("#suffix", "16,16,50,15");
  assert.equal(faults("cut").length, 1);
});

test("a current topic fill belongs to its grid track, and still fails an unequal bleed", () => {
  document.body.innerHTML = `<main data-slot="page" data-box="280,0,1025,600">
    <div style="display:grid; grid-template-columns:320px 673px; column-gap:32px" data-box="280,0,1025,600">
      <button aria-current="true" style="grid-column-start:1; background-color:rgb(240,240,240)" data-box="270,0,340,44">Use powers of ten</button>
      <section style="grid-column-start:2" data-box="632,0,673,300">Questions</section>
    </div></main>`;

  assert.deepEqual(faults("column"), []);
  resize("button", "260,0,350,44");
  assert.equal(faults("column").length, 1);
});

test("code ids may wrap at hyphens, while a title leaving one word still fails", () => {
  document.body.innerHTML = `<h2 data-box="16,0,120,40">describe-a-function-output</h2>`;

  vi.spyOn(Range.prototype, "getClientRects").mockImplementation(function rects(this: Range) {
    return rectList(new DOMRect(16, this.startOffset >= 20 ? 20 : 0, 8, 20));
  });

  assert.deepEqual(faults("lone-word"), []);
  document.body.innerHTML = `<h2 data-box="16,0,120,40">Describe a function output</h2>`;
  assert.equal(faults("lone-word").length, 1);
});

test("a title's whitespace survives the lone-word decision across three trimmed lines", () => {
  document.body.innerHTML = '<h2 data-box="16,0,120,60">Review self-study</h2>';

  vi.spyOn(Range.prototype, "getClientRects").mockImplementation(function rects(this: Range) {
    const top = [7, 12].filter((start) => this.startOffset >= start).length * 20;
    return rectList(new DOMRect(16, top, 8, 20));
  });

  const capture = read();

  assert.deepEqual(capture.elements.find((element) => element.part === "text")?.lineTexts, [
    "Review",
    "self-",
    "study",
  ]);

  assert.equal(
    evaluateCapture(capture).filter((finding) => finding.rule === "lone-word").length,
    1,
  );
});

test.each([8, 9])(
  "a single token is exempt only when every break is at a hyphen (first break %s)",
  (firstBreak) => {
    document.body.innerHTML = '<h2 data-box="16,0,120,60">describe-function-output</h2>';

    vi.spyOn(Range.prototype, "getClientRects").mockImplementation(function rects(this: Range) {
      const top = [firstBreak, 18].filter((start) => this.startOffset >= start).length * 20;
      return rectList(new DOMRect(16, top, 8, 20));
    });

    assert.equal(faults("lone-word").length, firstBreak === 9 ? 0 : 1);
  },
);
