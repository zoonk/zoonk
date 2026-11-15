// @vitest-environment jsdom
/* oxlint-disable no-magic-numbers -- The fixtures are measurements in pixels. */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { read, setUpProbeDom } from "./alignment-probe-dom.mts";
import { evaluateCapture } from "./alignment.mts";

/**
 * What the sweep's alignment read got wrong about real pages (CAUSES.md's C-L causes), each page
 * reduced to the markup the probe reads.
 */
setUpProbeDom();

function rule(name: string) {
  return evaluateCapture(read()).filter((finding) => finding.rule === name);
}

/** The sign-in buttons: a brand mark beside words set in the system face (`ui-sans-serif`). */
function signInButton(family: string) {
  document.body.innerHTML = `<div data-slot="page" data-box="16,0,358,400">
    <button data-slot="button" style="font-family: ${family}" data-box="16,286,358,44">
      <span data-icon="inline-start" data-box="107,300,16,16"></span>
      <span data-box="131,299,149,18">Continue with Google</span></button></div>`;

  return read().elements.find((element) => element.part === "label");
}

describe("words in a system face (C-L01: the sign-in buttons)", () => {
  it("are read by the system face's capitals, which draws them, instead of left unmeasured", () => {
    const label = signInButton("ui-sans-serif, system-ui, sans-serif");

    assert.equal(typeof label?.capTop, "number");
    assert.equal(typeof label?.capBottom, "number");
  });

  it("stay unmeasured in a web face whose own ranges don't say it draws them", () => {
    assert.equal(signInButton("Geist, sans-serif")?.capTop, "not measured");
  });
});

/**
 * The catalog's category strip on a phone: it scrolls sideways into the gutter, fading where it
 * continues, scrolled by `left` so a subject's glyph sits at the window's edge under the fade.
 */
function categoryStrip(left: number) {
  document.body.innerHTML = `<div data-slot="page" style="padding: 0 16px" data-box="0,0,390,800">
    <div data-slot="horizontal-scroll" data-box="0,323,390,38">
      <div id="scroller" style="overflow-x: auto" data-box="0,323,390,38">
        <div data-slot="horizontal-scroll-content" data-box="${16 - left},323,900,30">
          <span style="background-color: rgb(30, 130, 80)" data-box="0,334,8,8"></span>
        </div></div></div></div>`;

  const scroller = document.querySelector("#scroller");

  if (scroller) {
    Object.defineProperties(scroller, {
      clientWidth: { value: 390 },
      scrollLeft: { value: left },
      scrollWidth: { value: 932 },
    });
  }

  return rule("column");
}

describe("a box in a strip that scrolls sideways (C-L02: the catalog's categories)", () => {
  it("isn't judged past the column on a side the strip fades because it continues there", () => {
    assert.deepEqual(categoryStrip(300), []);
  });

  it("is judged where the strip can't scroll, so nothing fades there", () => {
    assert.equal(categoryStrip(0).length, 1);
  });
});

/** The onboarding's bar at the scroll's end: Skip, a control with a glyph, beside Continue. */
function skipInBar(inBar: boolean) {
  const skip = `<button data-slot="button" data-box="16,784,95,44">
    <span data-icon="inline-start" data-box="28,798,16,16"></span><span data-box="52,795,40,20">Skip</span></button>`;

  document.body.innerHTML = `<div data-slot="page" data-box="0,0,390,844">
    ${inBar ? "" : skip}
    <div data-slot="bottom-bar" style="position: sticky" data-box="0,767,390,77">
      <div data-slot="bottom-bar-row" data-box="0,768,390,76">${inBar ? skip : ""}
        <button style="--button-variant: default" data-box="119,784,255,44">Continue</button>
      </div></div></div>`;

  return rule("pinned");
}

describe("what a pinned bar holds (C-L04)", () => {
  it("rides with the bar instead of resting under it", () => {
    assert.deepEqual(skipInBar(true), []);
  });

  it("still fails a control of the page's the bar covers", () => {
    assert.equal(skipInBar(false).length, 1);
  });
});

/** A list row: its title `y` down, its radio at the end. */
function choiceRow(label: string, y: number) {
  return `<label data-slot="choice-row" data-box="16,${y},358,45">
    <span data-slot="list-row-title" data-box="16,${y + 12},120,20">${label}</span>
    <button data-slot="radio-group-item" data-box="350,${y + 12},20,20"></button></label>`;
}

describe("a list whose rows are a radio group's and one more (C-L06: the country step)", () => {
  it("reads every choice as a row of the list, so each one's radio is on its own label's line", () => {
    document.body.innerHTML = `<div data-slot="page" data-box="16,0,358,800">
      <div data-slot="list-group" style="font-family: ui-sans-serif" data-box="16,100,358,180">
        <div style="display: contents">
          <div data-slot="radio-group" data-box="16,100,358,135">
            ${choiceRow("United States", 100)}${choiceRow("Australia", 145)}${choiceRow("Canada", 190)}
          </div></div>
        <button data-slot="list-row" data-box="16,235,358,45">
          <span data-slot="list-row-title" data-box="16,247,120,20">Another country</span></button>
      </div></div>`;

    const rows = read().elements.filter(
      (element) => element.part === "row" && element.piece === "list-group",
    );

    assert.equal(rows.length, 4);
    assert.deepEqual(rule("line"), []);
  });
});

/** A top bar's "…": a ghost control pulled to the column's end, its menu open so its box fills. */
function ghostMenu(variant: string, glyphRight: number) {
  document.body.innerHTML = `<div data-slot="page" data-box="16,0,358,800">
    <button aria-label="Plan options" aria-expanded="true"
      style="--button-variant: ${variant}; background-color: rgb(235, 235, 235)" data-box="339,20,44,44">
      <span data-box="${glyphRight - 20},32,20,20">⋯</span></button></div>`;

  return rule("column");
}

describe("a control with no outline at the column's end (C-L07: Plan options, More)", () => {
  it("is read by its glyph's ink: its hover box hangs past the column so the glyph sits on it", () => {
    assert.deepEqual(ghostMenu("ghost", 374), []);
  });

  it("still fails where its glyph passes the column, and an outlined control's box always counts", () => {
    assert.equal(ghostMenu("ghost", 380).length, 1);
    assert.equal(ghostMenu("outline", 374).length, 1);
  });
});

describe("a task's side pane (C-L09: the challenge and call pages)", () => {
  it("is a column of its own, so its rows' hairlines end on its edges, not the task's", () => {
    const rows = [100, 175, 250]
      .map(
        (y) =>
          `<div style="border-bottom: 1px solid rgb(220, 220, 220)" data-box="1145,${y},271,75">
            <span data-box="1173,${y + 10},200,20">Ask about the chairs</span></div>`,
      )
      .join("");

    document.body.innerHTML = `<main data-slot="task-body" style="padding: 0 16px" data-box="240,0,640,900">
      <div data-slot="task-aside-content" style="position: fixed; padding: 0 24px" data-box="1121,60,319,840">
        ${rows}</div></main>`;

    assert.deepEqual(rule("column"), []);
  });
});

/**
 * The landing's example plan: a card drawn on all four sides with no padding of its own, its day
 * laid out in a section padded `inset` and ruled on top.
 */
function exampleCard(inset: number) {
  document.body.innerHTML = `<div data-slot="page" data-box="16,0,358,1200">
    <div style="border: 1px solid rgb(220, 220, 220)" data-box="16,600,358,400">
      <div style="padding: 16px ${inset}px; border-top: 1px solid rgb(220, 220, 220)" data-box="17,700,356,300">
        <div data-slot="list-group" data-box="37,720,316,90">
          <div data-box="37,720,316,45"><span data-slot="list-row-title" data-box="37,732,120,20">Linear equations</span></div>
          <div data-box="37,765,316,45"><span data-slot="list-row-title" data-box="37,777,120,20">Practice</span></div>
        </div></div></div></div>`;

  return rule("column");
}

describe("a card that pads its content in sections (C-L10: the example plans, a sheet's details)", () => {
  it("is a column at its section's padding, so a list that spans the section passes", () => {
    assert.deepEqual(exampleCard(20), []);
  });

  it("still fails a list set in from the section it sits in", () => {
    assert.equal(exampleCard(0).length, 1);
  });
});
