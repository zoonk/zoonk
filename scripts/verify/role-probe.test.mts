// @vitest-environment jsdom
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { readRoleFacts, roleFindings } from "./role-checks.mts";

const CONTROL_HEIGHT = 44;

beforeEach(() => {
  // jsdom supplies the tree and selectors, but does not lay out its contents.
  const box = new DOMRect(0, 0, 100, CONTROL_HEIGHT);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(box);

  Object.defineProperty(Element.prototype, "checkVisibility", {
    configurable: true,
    value: () => true,
  });

  Object.defineProperty(Range.prototype, "getClientRects", {
    configurable: true,
    value: () => [box],
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function task(bar: string) {
  document.body.innerHTML = `<section data-slot="task-frame">
    <main data-slot="task-frame-body"><h1>A question</h1></main>
    ${bar}
  </section>`;

  return roleFindings(readRoleFacts()).filter((finding) => finding.check.startsWith("R2"));
}

const ACTION = '<button data-enter="bound">Continue</button>';

describe("a task frame's main action", () => {
  it("finds the canonical bottom bar beside the task body", () => {
    assert.deepEqual(task(`<footer data-slot="bottom-bar">${ACTION}</footer>`), []);
  });

  it("reports a footer action outside the shared bottom bar", () => {
    assert.equal(task(`<footer>${ACTION}</footer>`).length, 1);
  });

  it("requires the shared slot instead of a renamed wrapper slot", () => {
    assert.equal(task(`<footer data-slot="task-action-bar">${ACTION}</footer>`).length, 1);
  });
});
