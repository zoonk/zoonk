// @vitest-environment jsdom
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { compareLayout, markActions, pickedIds, snapshotLayout } from "./states-probe.mts";

function frame(element: HTMLElement) {
  const [left = 0, top = 0, width = 0, height = 0] = (element.dataset.frame ?? "")
    .split(",")
    .map(Number);

  return { height, left, top, width };
}

beforeEach(() => {
  // jsdom supplies the tree, while mutable fixture frames supply its layout measurements.
  for (const [property, dimension] of Object.entries({
    offsetHeight: "height",
    offsetLeft: "left",
    offsetTop: "top",
    offsetWidth: "width",
  } as const)) {
    Object.defineProperty(HTMLElement.prototype, property, {
      configurable: true,
      get(this: HTMLElement) {
        return frame(this)[dimension];
      },
    });
  }

  Object.defineProperty(HTMLElement.prototype, "offsetParent", {
    configurable: true,
    get(this: HTMLElement) {
      return this.parentElement;
    },
  });

  Object.defineProperty(HTMLElement.prototype, "innerText", {
    configurable: true,
    get(this: HTMLElement) {
      return this.textContent;
    },
  });

  Object.defineProperty(Element.prototype, "checkVisibility", {
    configurable: true,
    value: () => true,
  });

  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function measuredBox(
    this: Element,
  ) {
    const { left, top, width, height } =
      this instanceof HTMLElement ? frame(this) : { height: 0, left: 0, top: 0, width: 0 };

    return new DOMRect(left, top, width, height);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
  globalThis.zoonkLayout = undefined;
});

describe("state layout measurements", () => {
  it("reads growth and parent-carried movement from a snapshot", () => {
    document.body.innerHTML = `<section data-frame="10,20,200,100">
      <button data-zoonk-act="target" data-frame="5,6,80,40">Save</button>
    </section><footer style="position:sticky" data-frame="0,700,200,44"><button data-frame="0,0,80,44">Pinned</button></footer>`;

    snapshotLayout();
    assert.equal(globalThis.zoonkLayout?.length, 2);
    const section = document.querySelector<HTMLElement>("section");
    const button = document.querySelector<HTMLElement>("section button");
    assert.ok(section && button);
    section.dataset.frame = "10,30,200,100";
    button.dataset.frame = "5,6,80,60";

    const facts = compareLayout("target");
    assert.equal(facts.moved.length, 2);
    assert.deepEqual(facts.target, { height: 60, left: 15, top: 36, width: 80 });
    const grown = facts.moved.find((change) => change.isTarget);
    assert.ok(grown);
    assert.deepEqual(grown.before, { height: 40, left: 15, top: 26, width: 80 });
    assert.deepEqual(grown.after, facts.target);
    assert.equal(grown.carried, true);
    assert.equal(grown.drawn, true);
    assert.equal(facts.moved.find((change) => change.holds)?.carried, false);
  });

  it("ignores unchanged and removed nodes instead of inventing movement", () => {
    document.body.innerHTML =
      '<button data-zoonk-act="target" data-frame="10,20,80,40">Save</button>';

    snapshotLayout();
    assert.deepEqual(compareLayout("target").moved, []);
    document.body.replaceChildren();
    assert.deepEqual(compareLayout("target"), { moved: [], target: null });
  });
});

describe("state action measurements", () => {
  it("classifies real fields, choices and marked openers, leaving commands and disabled controls out", () => {
    document.body.innerHTML = `<input aria-label="Name" data-frame="0,0,200,44" />
      <input type="search" aria-label="Search" data-frame="0,50,200,44" />
      <label data-frame="0,100,200,44">Choice<input type="radio" checked data-frame="0,100,20,20" /></label>
      <button aria-haspopup="dialog" data-frame="0,150,80,44">Open</button>
      <button aria-expanded="false" data-frame="0,200,80,44">Fold</button>
      <button data-frame="0,250,80,44">Save</button>
      <button disabled data-frame="0,300,80,44">Disabled</button>
      <div data-slot="command-item"><button data-frame="0,350,80,44">Navigate</button></div>`;

    const actions = markActions("body");

    assert.deepEqual(
      actions.map((action) => action.kind),
      ["field", "search", "pick", "overlay", "fold", "control"],
    );

    assert.deepEqual(pickedIds(), [actions[2]?.id]);
    assert.deepEqual(markActions("body"), []);
  });
});
