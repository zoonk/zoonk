// @vitest-environment jsdom
/* oxlint-disable no-magic-numbers -- The fixtures are measurements in pixels. */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { read, setUpProbeDom } from "./alignment-probe-dom.mts";
import { evaluateCapture } from "./alignment.mts";

setUpProbeDom();

const row = (label: string, y: number) =>
  `<div data-box="0,${y},300,30"><span data-slot="list-row-title" data-box="0,${y + 5},100,20">${label}</span></div>`;

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

/**
 * A page column 0 to 1000 whose content measure is 600, holding a list `width` wide. `slot` is the
 * page's own name where it gives one (Mind maps'), so the column is the shell's main above it.
 */
function measuredPage(width: number, slot = "page") {
  return `<main data-slot="learn-shell-main" data-box="0,0,1000,400">
    <div data-slot="${slot}" style="--page-measure: 600px" data-box="0,0,1000,400">
    <div data-slot="list-group" data-box="0,100,${width},60">${row("A", 100)}${row("B", 130)}</div></div></main>`;
}

describe("a list against its page's column", () => {
  it("ends on the column's measure where the page sets one, and fails a list short of it", () => {
    document.body.innerHTML = measuredPage(600);

    assert.deepEqual(
      evaluateCapture(read()).filter((finding) => finding.rule === "column"),
      [],
    );

    document.body.innerHTML = measuredPage(600, "mind-maps");

    assert.deepEqual(
      evaluateCapture(read()).filter((finding) => finding.rule === "column"),
      [],
    );

    document.body.innerHTML = measuredPage(300);

    assert.deepEqual(
      evaluateCapture(read())
        .filter((finding) => finding.rule === "column")
        .map((finding) => finding.detail),
      ['"A" starts on it and ends 300 short of it'],
    );
  });
});

/** A laptop page column 280 to 1400 split by a grid into the hero (280 to 864) and a side (904 to 1400). */
const SIDE_COLUMN = `<div data-slot="page" data-box="280,0,1120,600">
  <div style="display: grid; grid-template-columns: 584px 496px" data-box="280,0,1120,600">
    <div data-box="280,0,584,600">Quantum physics</div>
    <div data-box="904,0,496,600">
      <div data-slot="list-group" data-box="904,100,496,60">
        <a aria-current="page" style="background-color: rgb(240, 240, 240)" data-box="894,100,516,30"><span data-slot="list-row-title" data-box="904,105,100,20">How small is an atom?</span></a>
        ${row("Light behaves like a wave", 130)}
      </div></div></div></div>`;

describe("a box in a side column (a grid's cell beside the hero or a category list)", () => {
  it("is judged against its cell, not the page's outer column", () => {
    document.body.innerHTML = SIDE_COLUMN;

    assert.deepEqual(
      evaluateCapture(read()).filter((finding) => finding.rule === "column"),
      [],
    );
  });
});

/** A phase row of the path sheet: its mark, its words and date, then its open events under it. */
const SHEET = `<ol data-slot="journey-path-list" data-box="0,0,358,200">
  <li data-slot="path-row" data-box="0,0,358,150">
    <span data-slot="path-row-mark" data-box="0,0,16,44"><svg data-box="3,16,10,10"></svg></span>
    <span data-slot="path-row-words" data-box="28,12,200,20"><span data-box="28,12,200,20">Foundations</span></span>
    <span data-slot="path-row-value" data-box="300,12,58,20">Feb 18</span>
    <ul data-slot="path-nested" data-box="28,44,330,100">
      <div data-slot="path-row" data-box="28,44,330,44">
        <span data-slot="path-row-words" data-box="56,56,200,20"><span data-box="56,56,200,20">Mock exam</span></span>
        <span data-slot="path-row-value" data-box="300,56,58,20">Jan 30</span>
      </div>
    </ul>
  </li></ol>`;

describe("a row that holds a nested list (the path sheet's open phase)", () => {
  it("keeps the nested rows' parts in their own group and is its own line above them", () => {
    document.body.innerHTML = SHEET;
    const { elements } = read();

    const outer = elements.find(
      (element) => element.part === "row" && element.group === "journey-path.0",
    );

    const values = elements.filter(
      (element) => element.part === "value" && element.row === outer?.id,
    );

    assert.deepEqual(
      values.map((value) => value.name),
      ['"Feb 18"'],
    );

    assert.equal(outer?.middle, 22);
  });
});

/** A bottom bar at 700: its note's box from 640 to the bar's line, its words `above` lower. */
function noteBar(above: number) {
  return `<div data-slot="bottom-bar" data-box="0,700,390,100">
    <div data-slot="bottom-bar-note" data-box="0,640,390,60"><div data-box="0,640,390,60">
      <div data-box="16,640,358,60"><span data-box="16,${640 + above},300,20">Start free, no account needed.</span></div>
    </div></div>
    <div data-slot="bottom-bar-row" data-box="0,700,390,100"><button data-box="16,716,358,48">Build my plan</button></div></div>`;
}

describe("a bottom bar's note", () => {
  it("is read from the bar itself, and sits as far from its line as from its buttons", () => {
    document.body.innerHTML = noteBar(16);

    assert.deepEqual(
      evaluateCapture(read()).filter((finding) => finding.rule === "room"),
      [],
    );

    document.body.innerHTML = noteBar(16).replace("16,656,300,20", "16,648,300,20");
    assert.equal(evaluateCapture(read()).find((finding) => finding.rule === "room")?.measured, 8);
  });
});
