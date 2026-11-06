import { afterEach, describe, expect, it } from "vitest";
import { SCREEN_ENTER_ATTRIBUTE, getNumberKeyIndex, isScreenShortcut } from "./screen-shortcut";

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

  it("takes Enter where a field has no use for it: a select, a read-only field, or a one-line field outside a form", () => {
    expect(isEnterShortcutOn('<input data-target type="text" />')).toBe(true);
    expect(isEnterShortcutOn("<select data-target><option>One</option></select>")).toBe(true);
    expect(isEnterShortcutOn('<form><input data-target type="text" /></form>')).toBe(false);
    expect(isEnterShortcutOn("<textarea data-target></textarea>")).toBe(false);
    expect(isEnterShortcutOn('<form><input data-target readonly type="text" /></form>')).toBe(true);
    expect(isEnterShortcutOn("<textarea data-target readonly></textarea>")).toBe(true);
  });

  it("still leaves a held Enter and other keys alone in a read-only field", () => {
    const field = mount('<form><input data-target readonly type="text" /></form>');

    expect(isScreenShortcut(pressOn(field, { key: "Enter", repeat: true }))).toBe(false);
    expect(isScreenShortcut(pressOn(field, { key: "1" }))).toBe(false);
  });

  it("leaves Enter to a focused button or link, but not to a picked answer or a button with its own key", () => {
    const button = mount('<button data-target type="button">Explain first</button>');
    expect(isScreenShortcut(pressOn(button, { key: "Enter" }))).toBe(false);
    expect(isScreenShortcut(pressOn(button, { key: "3" }))).toBe(true);

    const link = mount('<a data-target href="/today">Leave</a>');
    expect(isScreenShortcut(pressOn(link, { key: "Enter" }))).toBe(false);

    const option = mount('<button data-target role="radio" aria-checked="true">B</button>');
    expect(isScreenShortcut(pressOn(option, { key: "Enter" }))).toBe(true);

    const audio = mount(
      `<button data-target ${SCREEN_ENTER_ATTRIBUTE} aria-keyshortcuts="p">Play</button>`,
    );

    expect(isScreenShortcut(pressOn(audio, { key: "Enter" }))).toBe(true);
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

  it("takes keys on a waiting button that kept focus, though it stops every key but Tab", () => {
    const waiting = mount('<button data-target aria-disabled="true" type="button">Start</button>');
    waiting.addEventListener("keydown", (event) => event.preventDefault());

    expect(isScreenShortcut(pressOn(waiting, { key: "Escape" }))).toBe(true);
    expect(isScreenShortcut(pressOn(waiting, { key: "2" }))).toBe(true);
    expect(isScreenShortcut(pressOn(waiting, { key: "Enter" }))).toBe(false);
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

describe("scrollable question regions", () => {
  it("leaves arrows to a focused region while preserving screen shortcuts outside it", () => {
    const region = mount(
      '<div data-target role="region" tabindex="0"><table><tbody><tr><td>Readings</td></tr></tbody></table></div>',
    );

    const cell = region.querySelector("td");

    if (!cell) {
      throw new Error("The table cell is missing.");
    }

    expect(isScreenShortcut(pressOn(region, { key: "ArrowRight" }))).toBe(false);
    expect(isScreenShortcut(pressOn(cell, { key: "ArrowLeft" }))).toBe(false);
    expect(isScreenShortcut(pressOn(document.body, { key: "ArrowRight" }))).toBe(true);
  });

  it("leaves the side arrows to a focused line that has more to scroll sideways, and only those", () => {
    const line = mount('<span data-target tabindex="0" style="overflow-x: auto">x + y</span>');

    Object.defineProperties(line, {
      clientWidth: { value: 260 },
      scrollWidth: { configurable: true, value: 302 },
    });

    expect(isScreenShortcut(pressOn(line, { key: "ArrowRight" }))).toBe(false);
    expect(isScreenShortcut(pressOn(line, { key: "ArrowLeft" }))).toBe(false);
    expect(isScreenShortcut(pressOn(line, { key: "ArrowDown" }))).toBe(true);

    Object.defineProperty(line, "scrollWidth", { value: 260 });

    expect(isScreenShortcut(pressOn(line, { key: "ArrowRight" }))).toBe(true);
  });
});
