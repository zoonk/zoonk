// @vitest-environment jsdom
/* oxlint-disable no-magic-numbers -- The fixtures are measurements in pixels. */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { read, setUpProbeDom } from "./alignment-probe-dom.mts";
import { evaluateCapture } from "./alignment.mts";

setUpProbeDom();

function notMeasured(html: string) {
  document.body.innerHTML = `<div data-slot="page" data-box="16,0,358,800">${html}</div>`;
  return evaluateCapture(read()).filter((finding) => finding.level === "not-measured");
}

describe("the reveal's roadmap on a phone, a meter without its line", () => {
  it("isn't the roadmap piece, which reads a meter by its line's rows", () => {
    const meter = `<div data-slot="plan-roadmap" data-box="16,40,358,40">
      <div data-slot="meter-parts" data-box="16,40,358,8"><span data-box="16,40,100,8"></span></div></div>`;

    assert.deepEqual(notMeasured(meter), []);
  });
});

describe("the reveal's phase list", () => {
  it("is read as a path, its StatusMark as each row's mark", () => {
    document.body.innerHTML = `<div data-slot="page" data-box="16,0,358,800">
      <ol data-slot="journey-path-list" data-box="16,40,358,88">
        <li data-slot="path-row" data-box="16,40,358,44">
          <span data-slot="status-mark" data-box="16,54,16,16">●</span>
          <span data-slot="path-row-words" data-box="44,52,200,20"><span data-box="44,52,200,20">Foundations</span></span>
        </li>
        <li data-slot="path-row" data-box="16,84,358,44">
          <span data-slot="status-mark" data-box="16,98,16,16">○</span>
          <span data-slot="path-row-words" data-box="44,96,200,20"><span data-box="44,96,200,20">Practice</span></span>
        </li>
      </ol></div>`;

    const marks = read().elements.filter(
      (element) => element.piece === "journey-path" && element.part === "mark",
    );

    assert.equal(marks.length, 2);
  });
});

describe("a sidebar row that holds its room before its name streams in", () => {
  it("isn't read as a row missing its label", () => {
    const sidebar = `<div data-slot="sidebar" data-box="0,0,240,800">
      <a data-slot="sidebar-item" data-box="12,40,216,32"><span data-box="20,48,16,16">◆</span><span data-box="44,46,80,20">Today</span></a>
      <a data-slot="sidebar-item" data-box="12,76,216,32"></a></div>`;

    document.body.innerHTML = sidebar;

    assert.deepEqual(
      evaluateCapture(read()).filter((finding) => finding.level === "not-measured"),
      [],
    );
  });
});
