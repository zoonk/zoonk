// @vitest-environment jsdom
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { focusReturned, readPanel } from "./keys-probe.mts";
import { OVERLAYS } from "./overlays.mts";
import { panelFindings } from "./panels.mts";

const HALF_PANEL = 50;
let dark = false;

beforeEach(() => {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 100, 100));
  const box = new DOMRect(0, 0, 100, 100);

  vi.spyOn(Element.prototype, "getClientRects").mockReturnValue(
    Object.assign([box], { item: () => box }),
  );

  Object.defineProperty(Element.prototype, "checkVisibility", {
    configurable: true,
    value: () => true,
  });

  vi.stubGlobal("matchMedia", () => ({ matches: dark }));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  dark = false;
  document.body.replaceChildren();
});

function read(phone = false) {
  const facts = readPanel({ overlays: OVERLAYS, phone });
  assert.ok(facts);
  return facts;
}

function element(selector: string) {
  const node = document.querySelector<HTMLElement>(selector);
  assert.ok(node);
  return node;
}

const returned = () => focusReturned({ opener: "opener", overlays: OVERLAYS });

function panel(slot: string, content = "") {
  const backdrop = OVERLAYS.find(({ panel: piece }) => piece === slot)?.backdrop;

  document.body.innerHTML = `<button data-zoonk-act="opener">Open</button>
    ${backdrop ? `<div data-slot="${backdrop}" style="background:rgba(0,0,0,0.5);opacity:1;backdrop-filter:none"></div>` : ""}
    <div data-slot="${slot}" role="${slot === "alert-dialog-content" ? "alertdialog" : "dialog"}" tabindex="-1"><h2>Details</h2>${content}</div>`;

  document.querySelector<HTMLElement>(`[data-slot="${slot}"]`)?.focus();
}

describe("shared panel readings", () => {
  it("reports unfamiliar dialog roles without imposing shared-piece behavior", () => {
    for (const slot of ["popover-content", "toast", "hand-drawn-panel"]) {
      panel(slot);
      const facts = read(true);
      assert.equal(facts?.shared, false);
      assert.equal(facts?.needsClose, false);
      assert.equal(facts?.sheet, null);

      assert.deepEqual(
        panelFindings({ ...facts, focusBack: false }).map(({ check }) => check),
        ["Behavior: panel piece"],
      );
    }
  });

  it("requires a close control for palettes at every width", () => {
    panel("dialog-content", '<input data-slot="command-input" />');
    assert.equal(read()?.needsClose, true);
    assert.equal(read(true)?.closeDrawn, false);

    document
      .querySelector("[data-slot=dialog-content]")
      ?.insertAdjacentHTML("beforeend", '<button data-slot="dialog-close">Cancel Esc</button>');

    assert.equal(read()?.closeDrawn, true);
  });

  it("recognizes every shared piece and the side panel's close hook", () => {
    for (const { panel: slot } of OVERLAYS) {
      panel(slot, '<button data-slot="side-panel-close">Close</button>');
      assert.equal(read()?.shared, true);
      assert.equal(read()?.closeDrawn, true);
      assert.equal(read()?.focusInside, true);
    }
  });

  it("prefers a real panel beside a toast and observes focus leaving it", () => {
    panel("dialog-content");

    document.body.insertAdjacentHTML(
      "beforeend",
      '<div data-slot="toast" role="dialog">Try again</div>',
    );

    assert.equal(read()?.label, "Details");
    document.querySelector<HTMLElement>("button")?.focus();
    assert.equal(read()?.focusInside, false);
    assert.equal(returned(), false);
    document.querySelector("[data-slot=dialog-content]")?.remove();
    assert.equal(returned(), true);
    document.body.insertAdjacentHTML("beforeend", "<button id=other>Other</button>");
    document.querySelector<HTMLElement>("#other")?.focus();
    assert.equal(returned(), false);
  });

  it("requires a drawer centered on a laptop without a visible handle", () => {
    panel("drawer-popup");
    assert.equal(read()?.centered, false);
    const box = new DOMRect(innerWidth / 2 - HALF_PANEL, innerHeight / 2 - HALF_PANEL, 100, 100);
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(box);
    assert.equal(read()?.centered, true);

    document
      .querySelector("[data-slot=drawer-popup]")
      ?.insertAdjacentHTML("beforeend", '<div data-slot="drawer-handle"></div>');

    assert.equal(read()?.centered, false);
    assert.equal(read(true)?.centered, null);
  });

  it("measures the phone sheet's bottom edge", () => {
    panel("drawer-popup");
    assert.equal(read(true)?.sheet, false);

    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, innerHeight - 100, 100, 100),
    );

    assert.equal(read(true)?.sheet, true);
  });

  it("reads black alpha times opacity, dark dim and backdrop blur", () => {
    panel("side-panel-content");
    assert.deepEqual(read()?.dim, { actual: 0.5, blur: "none", expected: 0.5 });
    const backdrop = element("[data-slot=side-panel-overlay]");
    backdrop.style.backgroundColor = "rgb(0 0 0 / 0.8)";
    backdrop.style.backdropFilter = "blur(4px)";

    assert.equal(
      panelFindings({ ...read(), focusBack: true }).filter(({ check }) =>
        check.endsWith("overlay dim"),
      ).length,
      1,
    );

    backdrop.style.backgroundColor = "black";
    backdrop.style.opacity = "0.7";
    dark = true;
    assert.deepEqual(read()?.dim, { actual: 0.7, blur: "blur(4px)", expected: 0.7 });
    backdrop.dataset.startingStyle = "";
    assert.equal(read()?.dim, null);
  });

  it("measures the sheet content's conditional edge and footer padding", () => {
    panel(
      "drawer-popup",
      '<div data-slot="drawer-content" style="border-bottom:1px solid rgb(1,2,3)"></div><footer data-slot="drawer-footer" style="padding-top:16px"></footer>',
    );

    const content = element("[data-slot=drawer-content]");

    Object.defineProperties(content, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 100 },
    });

    assert.deepEqual(read()?.edge, { drawn: true, expected: false, padding: 16 });
    Object.defineProperty(content, "scrollHeight", { value: 200 });
    assert.equal(read()?.edge?.expected, true);
    content.scrollTop = 100;
    assert.equal(read()?.edge?.expected, false);
    content.style.borderBottomColor = "transparent";
    assert.equal(read()?.edge?.drawn, false);
  });
});
