// @vitest-environment jsdom
/* oxlint-disable no-magic-numbers -- The fixtures are measurements in pixels. */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { read, setUpProbeDom } from "./alignment-probe-dom.mts";
import { evaluateCapture } from "./alignment.mts";

setUpProbeDom();

const row = (label: string, y: number) =>
  `<div data-box="32,${y},326,30"><span data-slot="list-row-title" data-box="32,${y + 5},100,20">${label}</span></div>`;

/** A list in a box padded 16 inside a phone's column (16 to 374), the box drawn or not. */
function boxedList(drawn: boolean) {
  const border = drawn ? "border: 1px solid rgb(220, 220, 220);" : "";

  return `<div data-slot="page" data-box="16,0,358,400">
    <div style="padding: 16px; ${border}" data-box="16,40,358,92">
      <div data-slot="list-group" data-box="32,56,326,60">${row("Review", 56)}${row("Practice", 86)}</div>
    </div></div>`;
}

function columnMisses(drawn: boolean) {
  document.body.innerHTML = boxedList(drawn);
  return evaluateCapture(read()).filter((finding) => finding.rule === "column");
}

describe("a list inside a card (Buddy's missions)", () => {
  it("is judged against the card it sits in, and a list set in by nothing drawn still fails", () => {
    assert.deepEqual(columnMisses(true), []);
    assert.equal(columnMisses(false).length, 1);
  });
});
