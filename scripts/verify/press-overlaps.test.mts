/* oxlint-disable no-magic-numbers -- The fixtures are layout in pixels. */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { findOverlaps, overlapFindings } from "./press-checks.mts";
import { type TextLine } from "./press-probe.mts";

function line(
  element: number,
  box: { left: number; top: number },
  overrides: Partial<TextLine> = {},
): TextLine {
  return {
    bottom: box.top + 20,
    element,
    layer: null,
    left: box.left,
    name: `p "Text ${element}"`,
    overlay: false,
    right: box.left + 160,
    top: box.top,
    within: [],
    ...overrides,
  };
}

describe("text over text", () => {
  it("finds two panels' texts drawn over each other (the lesson list over the buddy's panel)", () => {
    const found = findOverlaps([
      line(1, { left: 1000, top: 200 }, { layer: 8, name: 'li "Mitosis"' }),
      line(2, { left: 1040, top: 210 }, { layer: 9, name: 'p "Ask me anything"' }),
    ]);

    assert.deepEqual(found, [
      { a: 'li "Mitosis"', b: 'p "Ask me anything"', elements: [1, 2], height: 10, width: 120 },
    ]);
  });

  it("leaves lines that touch by a pixel or two, as tight leading does", () => {
    assert.deepEqual(
      findOverlaps([line(1, { left: 0, top: 0 }), line(2, { left: 0, top: 18 })]),
      [],
    );
  });

  it("leaves a menu over the page and the page scrolling under a pinned bar", () => {
    const page = line(1, { left: 0, top: 0 });

    assert.deepEqual(
      findOverlaps([page, line(2, { left: 0, top: 5 }, { layer: 4, overlay: true })]),
      [],
    );

    assert.deepEqual(findOverlaps([page, line(3, { left: 0, top: 5 }, { layer: 5 })]), []);
  });

  it("leaves text inside the element whose own text it crosses", () => {
    assert.deepEqual(
      findOverlaps([line(1, { left: 0, top: 0 }), line(2, { left: 0, top: 5 }, { within: [1] })]),
      [],
    );
  });

  it("names both texts, the state and the overlap", () => {
    const [found] = overlapFindings(
      [
        {
          a: 'p "Today\'s lessons"',
          b: 'p "Ask your buddy"',
          elements: [1, 2],
          height: 40,
          width: 120,
        },
      ],
      'after opening button "Buddy"',
    );

    assert.equal(found?.level, "fail");
    assert.equal(found?.value, 40);

    assert.equal(
      found?.message,
      'after opening button "Buddy": p "Today\'s lessons" and p "Ask your buddy" are drawn over each other (120×40 px)',
    );
  });
});
