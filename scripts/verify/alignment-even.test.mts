// @vitest-environment jsdom
/* oxlint-disable no-magic-numbers -- The fixtures are measurements in pixels. */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { read, setUpProbeDom } from "./alignment-probe-dom.mts";
import { evaluateCapture } from "./alignment.mts";

setUpProbeDom();

/** Two stat tiles side by side, the second `drop` lower and `grow` taller (#67's shape). */
function tiles(drop: number, grow: number) {
  return `<div data-slot="page" data-box="16,0,358,400">
    <ul data-slot="stat-tiles" data-box="16,40,358,${80 + Math.max(drop + grow, 0)}">
      <li data-box="16,40,175,80"><span data-box="28,52,60,20">Time</span></li>
      <li data-box="199,${40 + drop},175,${80 + grow}"><span data-box="211,${52 + drop},60,20">Questions</span></li>
      <li data-box="16,128,358,80"><span data-box="28,140,60,20">Lessons</span></li>
    </ul></div>`;
}

/** A tab list of links, the second tab `drop` lower than the first. */
function tabs(drop: number) {
  return `<div data-slot="page" data-box="16,0,358,400">
    <ul data-tabs data-box="16,40,358,40">
      <li data-box="16,40,90,32"><a href="/a" aria-current="page" data-box="16,40,90,32">Chapters</a></li>
      <li data-box="114,${40 + drop},80,32"><a href="/b" data-box="114,${40 + drop},80,32">Lessons</a></li>
    </ul></div>`;
}

function evenMisses(html: string) {
  document.body.innerHTML = html;
  return evaluateCapture(read()).filter((finding) => finding.rule === "even");
}

describe("siblings of one kind side by side (addition 3)", () => {
  it("share a top and a height: stat tiles", () => {
    assert.deepEqual(evenMisses(tiles(0, 0)), []);
    assert.match(evenMisses(tiles(13, 0))[0]?.detail ?? "", /starts 13 lower/u);
    assert.match(evenMisses(tiles(0, 8))[0]?.detail ?? "", /is 8 taller/u);
  });

  it("share a top and a height: a tab list", () => {
    assert.deepEqual(evenMisses(tabs(0)), []);
    assert.equal(evenMisses(tabs(4)).length, 1);
  });
});
