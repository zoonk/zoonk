// @vitest-environment jsdom
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { readPanel } from "./keys-probe.mts";

beforeEach(() => {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 100, 100));

  Object.defineProperty(Element.prototype, "checkVisibility", {
    configurable: true,
    value: () => true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function panel(slot: string) {
  document.body.innerHTML = `<div data-slot="${slot}" role="dialog" tabindex="-1"><h2>Details</h2></div>`;
  document.querySelector<HTMLElement>("[role=dialog]")?.focus();
  return readPanel(true);
}

describe("panel kind recognition", () => {
  it("does not require a close button or sheet placement for an anchored popover", () => {
    const facts = panel("popover-content");
    assert.equal(facts?.needsClose, false);
    assert.equal(facts?.sheet, null);
    assert.equal(facts?.focusInside, true);
  });

  it("still requires a close control and phone sheet placement for a dialog", () => {
    const facts = panel("dialog-content");
    assert.equal(facts?.needsClose, true);
    assert.equal(facts?.closeDrawn, false);
    assert.equal(facts?.sheet, false);
  });
});
