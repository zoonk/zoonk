import { afterEach, describe, expect, it } from "vitest";
import { getNumberKeyIndex, isScreenShortcut } from "./screen-shortcut";

/** Dispatches a key press on an element, so `event.target` is that element as in a browser. */
function pressOn(target: EventTarget, init: KeyboardEventInit) {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;
  const element = document.body.querySelector<HTMLElement>("[data-target]");

  if (!element) {
    throw new Error("The markup needs a [data-target] element");
  }

  return element;
}

function isEnterShortcutOn(html: string) {
  return isScreenShortcut(pressOn(mount(html), { key: "Enter" }));
}

describe(isScreenShortcut, () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("takes keys pressed with nothing in focus", () => {
    expect(isScreenShortcut(pressOn(document.body, { key: "Enter" }))).toBe(true);
    expect(isScreenShortcut(pressOn(document.body, { key: "2" }))).toBe(true);
  });

  it("leaves typing to fields and selects", () => {
    const fields = [
      '<input data-target type="text" />',
      "<textarea data-target></textarea>",
      "<select data-target><option>One</option></select>",
    ];

    const results = fields.map((html) => isScreenShortcut(pressOn(mount(html), { key: "1" })));

    expect(results).toStrictEqual([false, false, false]);
  });

  it("takes Enter where a field has no use for it: a select, or a one-line field outside a form", () => {
    expect(isEnterShortcutOn('<input data-target type="text" />')).toBe(true);
    expect(isEnterShortcutOn("<select data-target><option>One</option></select>")).toBe(true);
    expect(isEnterShortcutOn('<form><input data-target type="text" /></form>')).toBe(false);
    expect(isEnterShortcutOn("<textarea data-target></textarea>")).toBe(false);
  });

  it("leaves Enter to a focused button or link, but not to a picked answer", () => {
    const button = mount('<button data-target type="button">Explain first</button>');
    expect(isScreenShortcut(pressOn(button, { key: "Enter" }))).toBe(false);
    expect(isScreenShortcut(pressOn(button, { key: "3" }))).toBe(true);

    const link = mount('<a data-target href="/today">Leave</a>');
    expect(isScreenShortcut(pressOn(link, { key: "Enter" }))).toBe(false);

    const option = mount('<button data-target role="radio" aria-checked="true">B</button>');
    expect(isScreenShortcut(pressOn(option, { key: "Enter" }))).toBe(true);
  });

  it("leaves every key inside a dialog or a menu to it", () => {
    const inDialog = mount('<div role="dialog"><button data-target>Skip</button></div>');
    const inMenu = mount('<div role="menu"><div data-target role="menuitem">Helpful</div></div>');

    expect(isScreenShortcut(pressOn(inDialog, { key: "1" }))).toBe(false);
    expect(isScreenShortcut(pressOn(inDialog, { key: "ArrowRight" }))).toBe(false);
    expect(isScreenShortcut(pressOn(inMenu, { key: "Escape" }))).toBe(false);
  });

  it("ignores a key a control already handled and a held key repeating", () => {
    const slider = mount('<div data-target role="slider" tabindex="0"></div>');
    slider.addEventListener("keydown", (event) => event.preventDefault());

    expect(isScreenShortcut(pressOn(slider, { key: "ArrowLeft" }))).toBe(false);
    expect(isScreenShortcut(pressOn(document.body, { key: "Enter", repeat: true }))).toBe(false);
  });
});

describe(getNumberKeyIndex, () => {
  it("maps 1 to 9 to the first nine options", () => {
    const keys = ["1", "5", "9"].map((key) =>
      getNumberKeyIndex(new KeyboardEvent("keydown", { key })),
    );

    expect(keys).toStrictEqual([0, 4, 8]);
  });

  it("ignores 0, other keys and shortcut chords such as Cmd+1", () => {
    const presses = [
      { key: "0" },
      { key: "a" },
      { key: " " },
      { key: "1", metaKey: true },
      { ctrlKey: true, key: "1" },
      { altKey: true, key: "1" },
    ];

    expect(
      presses.map((init) => getNumberKeyIndex(new KeyboardEvent("keydown", init))),
    ).toStrictEqual([null, null, null, null, null, null]);
  });
});
