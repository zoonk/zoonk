// @vitest-environment jsdom
import assert from "node:assert/strict";
import { type Page } from "@playwright/test";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { readHooks, recordNextClick, takeRecordedClick } from "./keys-probe.mts";
import { type Shortcuts, pressKeys } from "./keys.mts";
import { installPageHelpers } from "./page-helpers.mts";
import { markActions } from "./states-probe.mts";
import { readWords } from "./words.mts";

const FIXTURE_URL = "https://fixture.test/";

const SHORTCUTS: Shortcuts = {
  isModShortcut: () => false,
  keys: (name) => [name === "main" ? "Enter" : "Escape"],
  shortcutKeys: () => "Enter",
};

function keyboardPage(perform?: (key: string) => void) {
  const pressed: string[] = [];

  const adapter = {
    evaluate: async (run: (argument: unknown) => unknown, argument?: unknown) => run(argument),
    keyboard: {
      press: async (key: string) => {
        pressed.push(key);
        perform?.(key);
      },
    },
    locator: () => ({ all: async () => [] }),
    url: () => FIXTURE_URL,
    waitForTimeout: () => Promise.resolve(),
  };

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- This adapter implements the browser operations the keyboard-only walk uses.
  const page = adapter as unknown as Page;

  return { page, pressed };
}

const CONTROL_HEIGHT = 44;
const OFFSCREEN_TOP = 1000;
const PARAGRAPHS = 5;

beforeEach(() => {
  installPageHelpers();

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
      <button class="group/button" data-enter="bound" data-top="${top}">Start</button>
    </footer></main>`;

  return readWords().aboveAction;
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

    const { page, pressed } = keyboardPage((key) => {
      if (key === "Enter") {
        action.click();
        action.remove();
      }
    });

    const findings = await pressKeys(page, FIXTURE_URL, SHORTCUTS);

    assert.deepEqual(findings, []);
    assert.equal(pressed.filter((key) => key === "Enter").length, 1);
  });

  it.each([
    'data-enter="host"',
    'data-enter="bound" disabled',
    'data-enter="bound" aria-disabled="true"',
  ])(
    "does not report a missing press for a host-owned or disabled action: %s",
    async (attributes) => {
      document.body.innerHTML = `<button ${attributes} aria-keyshortcuts="Enter">Continue
      <kbd data-slot="shortcut-kbd" data-shortcut="main">⏎</kbd></button>`;

      const { page } = keyboardPage();

      assert.deepEqual(await pressKeys(page, FIXTURE_URL, SHORTCUTS), []);
      assert.equal(readHooks().keycaps[0]?.canPress, false);
    },
  );

  it("still reports an enabled bound main action that does not answer Enter", async () => {
    document.body.innerHTML = `<button data-enter="bound" aria-keyshortcuts="Enter">Continue
      <kbd data-slot="shortcut-kbd" data-shortcut="main">⏎</kbd></button>`;

    const { page } = keyboardPage();
    const findings = await pressKeys(page, FIXTURE_URL, SHORTCUTS);

    assert.equal(
      findings.some((finding) => finding.message.includes("Enter didn't press")),
      true,
    );

    assert.equal(
      findings.some((finding) => finding.message.includes("main key didn't press")),
      true,
    );

    assert.equal(readHooks().keycaps[0]?.canPress, true);
  });

  it("still checks the announced key when its field owns the main action", async () => {
    document.body.innerHTML = `<button data-enter="host" aria-keyshortcuts="Space">Continue
      <kbd data-slot="shortcut-kbd" data-shortcut="main">⏎</kbd></button>`;

    const { page } = keyboardPage();
    const findings = await pressKeys(page, FIXTURE_URL, SHORTCUTS);

    assert.equal(findings.length, 1);
    assert.match(findings[0]?.message ?? "", /announces "Space" where its key is "Enter"/u);
  });
});

describe("walking a command palette", () => {
  it("keeps the search field but never schedules its command rows or their links", () => {
    document.body.innerHTML = `<div role="dialog">
      <input type="search" data-slot="command-input" placeholder="Search" />
      <div data-slot="command-list" role="listbox">
        <div id="command" role="option" data-slot="command-item">Continue today's session
          <a href="/session">Continue</a><button>Run</button>
        </div>
      </div>
    </div>`;

    assert.deepEqual(
      markActions("body").map((action) => action.kind),
      ["search"],
    );

    assert.equal(document.querySelector<HTMLElement>("#command")?.dataset.zoonkAct, undefined);
  });

  it("still schedules ordinary choices outside command rows", () => {
    document.body.innerHTML = '<div role="listbox"><div role="option">A choice</div></div>';

    assert.deepEqual(
      markActions("body").map((action) => action.kind),
      ["pick"],
    );
  });
});
