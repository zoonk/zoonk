// @vitest-environment jsdom
import assert from "node:assert/strict";
import { type Page } from "@playwright/test";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { readHooks, recordNextClick, takeRecordedClick } from "./keys-probe.mts";
import { pressKeys } from "./keys.mts";
import { readWords } from "./words.mts";

const CONTROL_HEIGHT = 44;
const OFFSCREEN_TOP = 1000;
const PARAGRAPHS = 5;

beforeEach(() => {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function box(
    this: HTMLElement,
  ) {
    return new DOMRect(0, Number(this.dataset.top ?? 100), 100, CONTROL_HEIGHT);
  });

  const box = new DOMRect(0, 0, 100, CONTROL_HEIGHT);

  vi.spyOn(Element.prototype, "getClientRects").mockReturnValue(
    Object.assign([box], { item: (index: number) => (index === 0 ? box : null) }),
  );

  Object.defineProperty(Element.prototype, "checkVisibility", {
    configurable: true,
    value: () => true,
  });

  Object.defineProperty(HTMLElement.prototype, "innerText", {
    configurable: true,
    get(this: HTMLElement) {
      return this.textContent;
    },
  });
});

afterEach(() => {
  takeRecordedClick();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function textAboveAction({ position, top }: { position: string; top: number }) {
  document.body.innerHTML = `<main><h1>Today</h1>${"<p>A lesson</p>".repeat(PARAGRAPHS)}
    <footer data-slot="bottom-bar" data-top="${top}" style="position:${position};bottom:0">
      <button class="group/button bg-primary" data-top="${top}">Start</button>
    </footer></main>`;

  return readWords(null).aboveAction;
}

describe("text before an available main action", () => {
  it("does not count the day list before a pinned bar already on screen", () => {
    assert.equal(textAboveAction({ position: "sticky", top: innerHeight - CONTROL_HEIGHT }), 0);
  });

  it("still counts text before an off-screen sticky bar and an unpinned bar", () => {
    assert.equal(textAboveAction({ position: "sticky", top: OFFSCREEN_TOP }), PARAGRAPHS);

    assert.equal(
      textAboveAction({ position: "static", top: innerHeight - CONTROL_HEIGHT }),
      PARAGRAPHS,
    );
  });
});

function choice(control: string) {
  document.body.innerHTML = `<div role="radiogroup" aria-label="Work"><label>
    ${control}<kbd data-slot="shortcut-kbd" data-shortcut="pick">1</kbd>
  </label></div>`;

  return readHooks().keycaps[0];
}

describe("choice keycaps inside a label", () => {
  it("resolves a native label control and observes it turning checked without a click", () => {
    const keycap = choice('<input type="radio" aria-keyshortcuts="1" />');
    recordNextClick();
    const input = document.querySelector<HTMLInputElement>("input");
    assert.ok(input);
    input.checked = true;
    assert.equal(keycap?.announced, "1");
    assert.equal(takeRecordedClick()?.id, keycap?.id);
  });

  it("resolves a role control and observes its checked transition", () => {
    const keycap = choice('<span role="radio" aria-checked="false" aria-keyshortcuts="1"></span>');
    recordNextClick();
    document.querySelector('[role="radio"]')?.setAttribute("aria-checked", "true");
    assert.equal(keycap?.announced, "1");
    assert.equal(takeRecordedClick()?.id, keycap?.id);
  });

  it("does not invent a press from a control that was already checked", () => {
    choice('<input type="checkbox" checked aria-keyshortcuts="1" />');
    recordNextClick();
    assert.equal(takeRecordedClick(), null);
  });
});

describe("checking a main keycap after Enter", () => {
  it("reuses the press that removed the action instead of pressing Enter twice", async () => {
    document.body.innerHTML = `<button data-enter="bound" aria-keyshortcuts="Enter">Keep studying
      <kbd data-slot="shortcut-kbd" data-shortcut="main">⏎</kbd></button>`;

    const action = document.querySelector<HTMLButtonElement>("button");
    assert.ok(action);
    const pressed: string[] = [];
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- This page adapter implements the browser operations this keyboard-only walk uses.
    const page = {
      evaluate: async (run: (argument: unknown) => unknown, argument?: unknown) => run(argument),
      keyboard: {
        press: async (key: string) => {
          pressed.push(key);

          if (key === "Enter") {
            action.click();
            action.remove();
          }
        },
      },
      locator: () => ({ all: async () => [] }),
      url: () => "https://fixture.test/",
      waitForTimeout: () => Promise.resolve(),
    } as unknown as Page;

    const findings = await pressKeys(page, "https://fixture.test/", {
      isModShortcut: () => false,
      keys: (name) => [name === "main" ? "Enter" : "Escape"],
      shortcutKeys: () => "Enter",
    });

    assert.deepEqual(findings, []);
    assert.equal(pressed.filter((key) => key === "Enter").length, 1);
  });
});
