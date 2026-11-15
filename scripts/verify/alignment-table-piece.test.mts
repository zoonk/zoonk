// @vitest-environment jsdom
/* oxlint-disable no-magic-numbers -- The fixtures are measurements in pixels. */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { read, setUpProbeDom } from "./alignment-probe-dom.mts";
import { evaluateCapture } from "./alignment.mts";

setUpProbeDom();

/**
 * A guess's worked numbers (#15), each row a number then its label. `starts` are the labels' left
 * edges: one column in lane E's table, wherever each number ended before it.
 */
function workings(starts: [number, number, number]) {
  const rows = [
    ["0.0001", "Hair width (m)"],
    ["0.0000000001", "Atom width (m)"],
    ["1000000", "Atoms across"],
  ]
    .map(
      ([value, label], index) =>
        `<li data-box="16,${100 + index * 24},358,20">
          <span data-slot="guess-working-value" data-box="28,${100 + index * 24},80,20">${value}</span>
          <span data-slot="guess-working-label" data-box="${starts[index]},${100 + index * 24},120,20">${label}</span>
        </li>`,
    )
    .join("");

  return `<div data-slot="page" data-box="16,0,358,400">
    <ul data-slot="guess-workings" data-box="16,100,358,72">${rows}</ul></div>`;
}

function labelMisses(starts: [number, number, number]) {
  document.body.innerHTML = workings(starts);
  return evaluateCapture(read()).filter((finding) => finding.rule === "label-start");
}

describe("a guess's worked numbers, a small table (#15)", () => {
  it("start their labels on one edge", () => {
    assert.deepEqual(labelMisses([120, 120, 120]), []);
    assert.equal(labelMisses([108, 149, 107]).length, 1);
  });
});
