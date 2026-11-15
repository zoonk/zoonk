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

/** A strip of day cells that scrolls sideways inside the column, its cells drawn past the strip. */
function scrolledStrip(overflow: string) {
  const cells = Array.from(
    { length: 6 },
    (_, index) =>
      `<span style="background-color: rgb(30, 130, 80)" data-box="${16 + index * 100},60,90,90"></span>`,
  ).join("");

  return `<div data-slot="page" data-box="16,0,358,400">
    <div style="overflow-x: ${overflow}" data-box="16,60,358,90">${cells}</div></div>`;
}

function stripMisses(overflow: string) {
  document.body.innerHTML = scrolledStrip(overflow);
  return evaluateCapture(read()).filter((finding) => finding.rule === "column");
}

describe("boxes inside a strip that scrolls sideways (the activity calendar)", () => {
  it("are read only as far as the strip shows them, and a strip that doesn't clip still fails", () => {
    assert.deepEqual(stripMisses("auto"), []);
    assert.ok(stripMisses("visible").length > 0);
  });
});

/** A page's main action, and `inAside` filled actions in its aside, a side panel. */
function filledButton(label: string, x: number) {
  return `<button style="--button-variant: default" data-box="${x},300,120,44">${label}</button>`;
}

function pageWithAside(inAside: number) {
  const aside = Array.from({ length: inAside }, (_, index) =>
    filledButton(`Save ${index}`, 400 + index * 130),
  ).join("");

  return `<div data-slot="page" data-box="16,0,358,400">${filledButton("Continue", 16)}</div>
    <aside data-slot="page-aside" data-box="390,0,300,400">${aside}</aside>`;
}

function oneFilled(inAside: number) {
  document.body.innerHTML = pageWithAside(inAside);
  return evaluateCapture(read()).filter((finding) => finding.rule === "one-filled");
}

describe("a side panel's filled actions", () => {
  it("are counted apart from the page's: one each passes, two in the panel fail", () => {
    assert.deepEqual(oneFilled(1), []);
    assert.match(oneFilled(2)[0]?.detail ?? "", /"Save 0", "Save 1" on .*\(side panel\)/u);
  });
});
