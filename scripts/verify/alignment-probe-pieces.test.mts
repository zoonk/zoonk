// @vitest-environment jsdom
/* oxlint-disable no-magic-numbers -- The fixtures are measurements in pixels. */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { read, setUpProbeDom } from "./alignment-probe-dom.mts";
import { evaluateCapture } from "./alignment.mts";

setUpProbeDom();

/** A top bar: its back link at 13px, then its end's actions, each `[words, font size]`. */
function topBar(...actions: [string, number][]) {
  const end = actions
    .map(
      ([words, size], index) =>
        `<button style="font-size: ${size}px" data-box="${200 + index * 80},12,70,40">${words}</button>`,
    )
    .join("");

  return `<div data-slot="page-top-bar" data-box="0,0,390,64">
    <a data-slot="back-link" style="font-size: 13px" data-box="16,12,120,40"><span data-box="36,22,100,18">Courses</span></a>
    <div data-slot="page-top-end" data-box="200,12,174,40">${end}</div></div>`;
}

describe("a top bar's word actions", () => {
  it("share one type, and the back link is its own part", () => {
    document.body.innerHTML = topBar(["Ask", 15], ["Log in", 15]);
    assert.deepEqual(evaluateCapture(read()), []);

    document.body.innerHTML = topBar(["Ask", 15], ["Log in", 14]);
    assert.equal(evaluateCapture(read())[0]?.rule, "type");
  });

  it("measure nothing in a bar whose end holds only a glyph", () => {
    document.body.innerHTML = topBar(["", 15]);
    assert.deepEqual(evaluateCapture(read()), []);
  });
});
