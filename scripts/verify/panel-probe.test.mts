// @vitest-environment jsdom
import assert from "node:assert/strict";
import { type Page } from "@playwright/test";
import { afterEach, beforeEach, describe, it, test, vi } from "vitest";
import { focusReturned, readPanel } from "./keys-probe.mts";
import { OVERLAYS } from "./overlays.mts";
import { installPageHelpers } from "./page-helpers.mts";
import { focusCameBack, panelFindings } from "./panels.mts";

const HALF_PANEL = 50;
let dark = false;

beforeEach(() => {
  installPageHelpers();
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 100, 100));
  const box = new DOMRect(0, 0, 100, 100);

  vi.spyOn(Element.prototype, "getClientRects").mockReturnValue(
    Object.assign([box], { item: () => box }),
  );

  Object.defineProperty(Element.prototype, "checkVisibility", {
    configurable: true,
    value: () => true,
  });

  Object.defineProperty(Element.prototype, "getAnimations", {
    configurable: true,
    value: () => [],
  });

  vi.stubGlobal("matchMedia", () => ({ matches: dark }));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  dark = false;
  document.body.replaceChildren();
});

function read(phone = false, opener = "opener") {
  const facts = readPanel({ opener, overlays: OVERLAYS, phone });
  assert.ok(facts);
  return facts;
}

function element(selector: string) {
  const node = document.querySelector<HTMLElement>(selector);
  assert.ok(node);
  return node;
}

const returned = () => focusReturned({ opener: "opener" });

test("returns to a menu trigger inside a sheet after its item's panel closes", () => {
  document.body.innerHTML = `<div data-slot="drawer-popup" role="dialog" tabindex="-1"><h2>Questions</h2><button data-zoonk-act="menu-trigger">…</button></div>
    <div role="menu"><button data-zoonk-act="item">Report a problem</button></div>
    <div data-slot="drawer-popup" role="dialog" tabindex="-1" id="report"><h2>Report a problem</h2></div>`;

  element("#report").focus();
  read(true, "item");
  element("#report").remove();
  element("[role=menu]").remove();
  element("button").focus();
  assert.equal(focusReturned({ opener: "item", returnTo: "menu-trigger" }), true);
  element("[role=dialog]").focus();
  assert.equal(focusReturned({ opener: "item", returnTo: "menu-trigger" }), false);
});

test("returns from a menu with two portaled ancestors", () => {
  document.body.innerHTML = `<div data-slot="side-panel-content" role="dialog"><h2>Navigation</h2></div>
    <div data-slot="dialog-content" role="dialog"><h2>Details</h2><button data-zoonk-act="opener">More</button></div>
    <div role="menu" tabindex="-1">Options</div>`;

  const menu = element("[role=menu]");
  menu.focus();
  assert.equal(read(true).focusInside, true);
  menu.remove();
  element("button").focus();
  assert.equal(returned(), true);
});

test.each(["removed", "hidden"])(
  "keeps the outer popup's own close check until it is %s",
  (closed) => {
    document.body.innerHTML = `<button data-zoonk-act="sheet-opener">See answers</button>
    <div data-slot="drawer-popup" role="dialog" tabindex="-1"><button data-zoonk-act="opener">More</button></div>`;

    const sheet = element("[role=dialog]");
    sheet.focus();
    read(true, "sheet-opener");
    document.body.insertAdjacentHTML("beforeend", '<div role="menu" tabindex="-1">Options</div>');
    const menu = element("[role=menu]");
    menu.focus();
    read(true);
    menu.remove();
    element("[data-zoonk-act=opener]").focus();
    assert.equal(returned(), true);
    element("[data-zoonk-act=sheet-opener]").focus();
    assert.equal(focusReturned({ opener: "sheet-opener" }), false);

    if (closed === "removed") {
      sheet.remove();
    } else {
      vi.spyOn(sheet, "getBoundingClientRect").mockReturnValue(new DOMRect());
    }

    assert.equal(focusReturned({ opener: "sheet-opener" }), true);
  },
);

function panel(slot: string, content = "") {
  const backdrop = OVERLAYS.find(({ panel: piece }) => piece === slot)?.backdrop;

  document.body.innerHTML = `<button data-zoonk-act="opener">Open</button>
    ${backdrop ? `<div data-slot="${backdrop}" style="background:rgba(0,0,0,0.5);opacity:1;backdrop-filter:none"></div>` : ""}
    <div data-slot="${slot}" role="${slot === "alert-dialog-content" ? "alertdialog" : "dialog"}" tabindex="-1"><h2>Details</h2>${content}</div>`;

  document.querySelector<HTMLElement>(`[data-slot="${slot}"]`)?.focus();
}

describe("shared panel readings", () => {
  it.each(["side-panel-content", "drawer-popup"])(
    "reads a portaled menu inside %s and requires its own focus and close",
    (slot) => {
      document.body.innerHTML = `<div data-slot="${slot}" role="dialog" tabindex="-1"><h2>Menu</h2><button data-zoonk-act="opener">Owner User</button></div>
      <div data-slot="dropdown-menu-content" role="menu" tabindex="-1">Account</div>`;

      const menu = element("[role=menu]");
      menu.focus();
      const facts = read(true);
      assert.equal(facts.focusInside, true);
      assert.deepEqual([facts.needsClose, facts.sheet, facts.dim], [false, null, null]);
      assert.deepEqual(panelFindings({ ...facts, focusBack: null }), []);

      element("button").focus();
      assert.equal(read(true).focusInside, false);

      assert.ok(
        panelFindings({ ...read(true), focusBack: null }).some(
          ({ level, message }) => level === "fail" && message.includes("without taking focus"),
        ),
      );

      assert.equal(returned(), false);
      menu.remove();
      assert.equal(returned(), true);
      element("[role=dialog]").focus();
      assert.equal(returned(), false);
    },
  );

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

  it("waits for a closing animation before checking focus return", async () => {
    panel("dialog-content");
    const { promise, resolve } = Promise.withResolvers<null>();

    Object.defineProperty(Element.prototype, "getAnimations", {
      configurable: true,
      value: () => [{ finished: promise }],
    });
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The adapter implements the page's serialized-evaluation boundary.
    const page = {
      evaluate: async (run: (argument: unknown) => unknown, argument?: unknown) => run(argument),
    } as unknown as Page;

    const result = focusCameBack(page, "opener");
    const settled = vi.fn();
    void result.then(settled);
    await Promise.resolve();
    assert.equal(settled.mock.calls.length, 0);
    element("[data-slot=dialog-content]").remove();
    element("button").focus();
    resolve(null);
    assert.equal(await result, true);
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
