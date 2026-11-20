// @vitest-environment jsdom
import assert from "node:assert/strict";
import { type Page } from "@playwright/test";
import { afterEach, beforeEach, test, vi } from "vitest";
import { readHooks, readSidebar } from "./keys-probe.mts";
import { pressKeys } from "./keys.mts";

const CONTROL_HEIGHT = 44;

beforeEach(() => {
  vi.spyOn(Element.prototype, "getClientRects").mockImplementation(function geometry(
    this: Element,
  ) {
    const boxes = this.hasAttribute("hidden") ? [] : [new DOMRect(0, 0, 100, CONTROL_HEIGHT)];
    return Object.assign(boxes, { item: (index: number) => boxes[index] ?? new DOMRect() });
  });

  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function geometry(
    this: Element,
  ) {
    const folded =
      this.matches("[data-slot=sidebar]") &&
      Object.hasOwn(document.documentElement.dataset, "sidebarCollapsed");

    return new DOMRect(0, 0, folded ? 0 : 100, CONTROL_HEIGHT);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
  delete document.documentElement.dataset.sidebarCollapsed;
});

test("reads both sidebars, their toggle, the enabled main action and the task close", () => {
  document.body.innerHTML = `<aside data-slot="sidebar"></aside><aside data-slot="task-aside"></aside>
    <button data-slot="sidebar-toggle" data-side="end">Fold</button>
    <section data-task-header><button data-slot="task-close">Close</button></section>
    <button data-enter="bound">Continue</button><button data-enter="bound" disabled>Unavailable</button>`;

  const hooks = readHooks();
  assert.deepEqual(hooks.sidebars, ["start", "end"]);
  assert.deepEqual(hooks.toggles, ["end"]);

  assert.deepEqual(
    hooks.bound.map(({ label }) => label),
    ["Continue"],
  );

  assert.equal(hooks.taskClose, true);
  assert.equal(hooks.task, true);
  assert.equal(readSidebar("end"), "100");
  document.documentElement.dataset.sidebarCollapsed = "true";
  assert.equal(readSidebar("start"), "0 data-sidebar-collapsed=true");
});

function locator(nodes: Element[]) {
  return {
    all: async () => nodes.map((node) => locator([node])),
    count: async () => nodes.length,
    evaluate: async (run: (node: Element) => unknown) => {
      const [node] = nodes;
      assert.ok(node);
      return run(node);
    },
    first: () => locator(nodes.slice(0, 1)),
    focus: async () => {
      if (nodes[0] instanceof HTMLElement) {
        nodes[0].focus();
      }
    },
    getAttribute: async (name: string) => nodes[0]?.getAttribute(name) ?? null,
    locator: (selector: string) =>
      locator(nodes.flatMap((node) => [...node.querySelectorAll(selector)])),
    nth: (index: number) => locator(nodes.slice(index, index + 1)),
  };
}

test("really folds and restores the sidebar and presses the pick-one group's down arrow", async () => {
  const markup = `<aside data-slot="sidebar"></aside><button data-slot="sidebar-toggle">Fold</button>
    <div data-slot="radio-group" role="radiogroup" aria-label="Choices">
      <div role="radio" tabindex="0">First</div><div role="radio" tabindex="-1">Second</div>
    </div>`;

  document.body.innerHTML = markup;
  const pressed: string[] = [];
  const scenario = { mode: "normal", presses: 0 };
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- This adapter supplies only the browser operations exercised by the keyboard walk.
  const page = {
    evaluate: async (run: (argument: unknown) => unknown, argument?: unknown) => run(argument),
    goto: async () => {
      document.body.innerHTML = markup;
    },
    keyboard: {
      press: async (key: string) => {
        pressed.push(key);

        if (key === "ControlOrMeta+b") {
          scenario.presses += 1;

          if (
            scenario.mode === "normal" ||
            (scenario.mode === "unrestored" && scenario.presses === 1)
          ) {
            document.documentElement.toggleAttribute("data-sidebar-collapsed");
          }
        }

        if (key === "ArrowDown") {
          const options = document.querySelectorAll<HTMLElement>("[role=radio]");
          const [first, second] = options;
          assert.ok(first && second);
          first.tabIndex = -1;
          second.tabIndex = 0;
          second.focus();
        }
      },
    },
    locator: (selector: string) =>
      locator([...document.querySelectorAll(selector.replaceAll(":visible", ""))]),
    url: () => "https://fixture.test/",
    waitForLoadState: () => Promise.resolve(),
    waitForTimeout: () => Promise.resolve(),
  } as unknown as Page;

  const shortcuts = {
    isModShortcut: (name: string) => name === "sidebar",
    keys: (name: string) => {
      if (name === "sidebar") {
        return ["b"];
      }

      return [name === "main" ? "Enter" : "Escape"];
    },
    shortcutKeys: () => "",
  };

  const findings = await pressKeys(page, "https://fixture.test/", shortcuts);
  assert.deepEqual(findings, []);
  assert.equal(pressed.filter((key) => key === "ControlOrMeta+b").length, 2);
  assert.ok(pressed.includes("ArrowDown"));
  assert.equal(Object.hasOwn(document.documentElement.dataset, "sidebarCollapsed"), false);
  scenario.mode = "stuck";

  const stuck = await pressKeys(page, "https://fixture.test/", shortcuts);
  assert.ok(stuck.some(({ message }) => message.includes("didn't fold")));

  scenario.mode = "unrestored";
  scenario.presses = 0;

  const unrestored = await pressKeys(page, "https://fixture.test/", shortcuts);
  assert.ok(unrestored.some(({ message }) => message.includes("didn't bring back")));
});
