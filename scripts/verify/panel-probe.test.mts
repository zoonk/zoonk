// @vitest-environment jsdom
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { focusReturned, readPanel } from "./keys-probe.mts";

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

  it("ignores a toast when inspecting panels and checking returned focus", () => {
    document.body.innerHTML = `<button data-zoonk-act="opener">Open</button>
      <div role="dialog" data-slot="toast"><h2 data-slot="toast-title">That didn't save. Try again.</h2></div>`;

    document.querySelector<HTMLElement>("button")?.focus();

    assert.equal(readPanel(false), null);
    assert.equal(focusReturned("opener"), true);
  });

  it("still detects a real open panel when a toast appears first", () => {
    document.body.innerHTML = `<button data-zoonk-act="opener">Open</button>
      <div role="dialog" data-slot="toast"><h2 data-slot="toast-title">Try again</h2></div>
      <div role="dialog" data-slot="dialog-content" tabindex="-1"><h2>Details</h2></div>`;

    document.querySelector<HTMLElement>("[data-slot=dialog-content]")?.focus();

    assert.equal(readPanel(false)?.label, "Details");
    assert.equal(focusReturned("opener"), false);
  });

  it("exempts a command palette from the close-control check only on a computer", () => {
    document.body.innerHTML = `<div role="dialog" data-slot="dialog-content" tabindex="-1">
      <h2>Where you live</h2><input data-slot="command-input" />
    </div>`;

    assert.equal(readPanel(false)?.needsClose, false);
    assert.equal(readPanel(true)?.needsClose, true);
    assert.equal(readPanel(true)?.closeDrawn, false);
  });

  it("still requires a close control for an ordinary computer dialog", () => {
    panel("dialog-content");
    assert.equal(readPanel(false)?.needsClose, true);
  });
});
