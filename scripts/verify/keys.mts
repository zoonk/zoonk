/* oxlint-disable no-await-in-loop -- Keys are pressed on one page, one at a time. */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { type Page } from "@playwright/test";
import { type Finding } from "./checks.mts";
import {
  type Pressed,
  focusReturned,
  readHooks,
  readPanel,
  readSidebar,
  recordNextClick,
  takeRecordedClick,
} from "./keys-probe.mts";

/**
 * The measured checkout's own keys (`packages/ui/src/lib/shortcuts.ts`), so the walk presses what
 * its handlers answer. A checkout without the file isn't asserted.
 */
export type Shortcuts = {
  isModShortcut: (name: string) => boolean;
  keys: (name: string) => string[];
  shortcutKeys: (name: string) => string;
};

function field(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
}

function callable(value: unknown): value is (name: string) => unknown {
  return typeof value === "function";
}

export async function readShortcuts(checkout: string): Promise<Shortcuts | null> {
  const file = join(checkout, "packages/ui/src/lib/shortcuts.ts");

  if (!existsSync(file)) {
    return null;
  }

  const loaded: unknown = await import(pathToFileURL(file).href);
  const isMod = field(loaded, "isModShortcut");
  const announced = field(loaded, "shortcutKeys");

  if (!callable(isMod) || !callable(announced)) {
    return null;
  }

  return {
    isModShortcut: (name) => Boolean(isMod(name)),
    keys(name) {
      const keys = field(field(field(loaded, "SHORTCUTS"), name), "keys");
      return Array.isArray(keys) ? keys.filter((key) => typeof key === "string") : [];
    },
    shortcutKeys: (name) => String(announced(name)),
  };
}

type Keycap = {
  announced: string | null;
  expected: string;
  label: string;
  name: string;
  pressed: Pressed;
};

export type KeyFacts = {
  enter: { bound: string[]; pressed: Pressed; unbuilt: string[] };
  escape: { pressed: Pressed; task: boolean; taskClose: boolean };
  groups: { label: string; moved: boolean; tabStops: number }[];
  keycaps: Keycap[];
  sidebar: { answered: boolean; restored: boolean; side: string }[];
  sidebarsWithoutToggle: string[];
};

export type PanelFacts = NonNullable<ReturnType<typeof readPanel>> & { focusBack: boolean };

const PRESS_SETTLE_MS = 150;
const SIDEBAR_SETTLE_MS = 400;

/** IX's walk assertions fail the run where they already hold on every page (A1, A3, A4). */
function behavior(id: string, message: string, fails = false): Finding {
  return { check: `Behavior: ${id}`, level: fails ? "fail" : "warn", message };
}

function isMainAction(pressed: NonNullable<Pressed>) {
  return ["bound", "host"].includes(pressed.enter ?? "") && pressed.drawn && pressed.keycap;
}

function enterFindings({ bound, pressed, unbuilt }: KeyFacts["enter"]): Finding[] {
  const [only] = bound;

  return [
    ...(pressed && !isMainAction(pressed)
      ? [
          behavior(
            "A2 Enter",
            `Enter clicked ${pressed.label}, which isn't a main action showing ⏎`,
          ),
        ]
      : []),
    ...(bound.length === 1 && pressed?.label !== only
      ? [behavior("A2 Enter", `Enter didn't press ${only ?? ""}, the screen's main action`)]
      : []),
    ...(bound.length > 1
      ? [behavior("A2 Enter", `two main actions answer Enter: ${bound.join(", ")}`)]
      : []),
    ...unbuilt.map((label) =>
      behavior("A2 Enter", `${label} is a main action drawn without the piece that binds Enter`),
    ),
  ];
}

function keycapFindings(keycap: Keycap): Finding[] {
  return [
    ...(keycap.pressed?.label === keycap.label
      ? []
      : [
          behavior(
            "A6 keycaps",
            `the ${keycap.name} key didn't press ${keycap.label}, which shows it`,
          ),
        ]),
    ...(keycap.announced === keycap.expected
      ? []
      : [
          behavior(
            "A6 keycaps",
            `${keycap.label} announces "${keycap.announced ?? ""}" where its key is "${keycap.expected}"`,
          ),
        ]),
  ];
}

export function keyFindings(facts: KeyFacts): Finding[] {
  const { escape } = facts;

  return [
    ...facts.sidebar
      .filter((side) => !side.answered || !side.restored)
      .map((side) =>
        behavior(
          "A1 sidebar key",
          `⌘B ${side.answered ? "didn't bring back" : "didn't fold"} the ${side.side} sidebar`,
          true,
        ),
      ),
    ...facts.sidebarsWithoutToggle.map((side) =>
      behavior("A1 sidebar key", `the ${side} sidebar is drawn with no toggle for it`, true),
    ),
    ...enterFindings(facts.enter),
    ...(escape.pressed && !escape.pressed.drawn
      ? [behavior("A3 Esc", `Esc clicked ${escape.pressed.label}, which isn't on screen`, true)]
      : []),
    ...(escape.task && escape.taskClose && !escape.pressed?.taskClose
      ? [behavior("A3 Esc", "Esc didn't press the task's ✕", true)]
      : []),
    ...facts.groups.flatMap((group) => [
      ...(group.moved
        ? []
        : [behavior("A5 arrows", `↓ didn't move to the next option in ${group.label}`)]),
      ...(group.tabStops === 1
        ? []
        : [
            behavior(
              "A5 arrows",
              `${group.label} has ${group.tabStops} Tab stops, where a group has one`,
            ),
          ]),
    ]),
    ...facts.keycaps.flatMap((keycap) => keycapFindings(keycap)),
  ];
}

/** IX's A4 and the founder's rule 5 for one panel the walk opened and closed with Esc. */
export function panelFindings(panel: PanelFacts): Finding[] {
  return [
    ...(panel.focusInside
      ? []
      : [behavior("A4 panels", `${panel.label} opened without taking focus`, true)]),
    ...(panel.needsClose && !panel.closeDrawn
      ? [behavior("A4 panels", `${panel.label} has no ✕ and no button to leave by`, true)]
      : []),
    ...(panel.centered === false
      ? [
          behavior(
            "A4 panels",
            `${panel.label} isn't centered on a laptop, or shows its handle`,
            true,
          ),
        ]
      : []),
    ...(panel.focusBack
      ? []
      : [
          behavior(
            "A4 panels",
            `${panel.label} didn't close on Esc and give focus back to what opened it`,
            true,
          ),
        ]),
    ...(panel.sheet === false
      ? [
          behavior(
            "Rule 5 sheets",
            `${panel.label} opens away from the bottom on a phone, where what opens over a page is a sheet`,
          ),
        ]
      : []),
  ];
}

export async function inspectPanel(page: Page, phone: boolean) {
  return page.evaluate(readPanel, phone);
}

export async function focusCameBack(page: Page, opener: string) {
  return page.evaluate(focusReturned, opener);
}

async function press(page: Page, key: string): Promise<Pressed> {
  await page.evaluate(recordNextClick);
  await page.keyboard.press(key);
  await page.waitForTimeout(PRESS_SETTLE_MS);
  return page.evaluate(takeRecordedClick).catch(() => null);
}

function keyOf(shortcuts: Shortcuts, name: string) {
  const [key = ""] = shortcuts.keys(name);
  return shortcuts.isModShortcut(name) ? `ControlOrMeta+${key}` : key;
}

async function pressSidebar(page: Page, key: string, side: string) {
  const before = await page.evaluate(readSidebar, side);
  await page.keyboard.press(key);
  await page.waitForTimeout(SIDEBAR_SETTLE_MS);
  const folded = await page.evaluate(readSidebar, side);
  await page.keyboard.press(key);
  await page.waitForTimeout(SIDEBAR_SETTLE_MS);
  const after = await page.evaluate(readSidebar, side);
  const [width, ...state] = before.split(" ");
  const [foldedWidth, ...foldedState] = folded.split(" ");

  return {
    answered: foldedWidth !== width && foldedState.join(" ") !== state.join(" "),
    restored: after === before,
    side,
  };
}

async function pressGroups(page: Page) {
  const groups = page.locator(
    "[data-slot=answer-option-group][role=radiogroup]:visible, [data-slot=radio-group]:visible",
  );

  const facts: KeyFacts["groups"] = [];

  for (const group of await groups.all()) {
    const options = group.locator("[role=radio]:not([disabled], [aria-disabled=true])");

    if ((await options.count()) >= 2) {
      const tabStops = await group.locator("[role=radio][tabindex='0']").count();
      await options.first().focus();
      await page.keyboard.press("ArrowDown");

      facts.push({
        label: (await group.getAttribute("aria-label")) ?? "a pick-one group",
        moved: await options.nth(1).evaluate((option) => option === document.activeElement),
        tabStops,
      });
    }
  }

  return facts;
}

/**
 * Presses the screen's keys on its laptop page (⌘B, Enter, Esc, ↓ in each pick-one group, each
 * keycap's key) with every click swallowed and a changed address loaded again, so nothing acts.
 */
export async function pressKeys(page: Page, url: string, shortcuts: Shortcuts): Promise<Finding[]> {
  async function back() {
    if (page.url() !== url) {
      await page.goto(url);
      await page.waitForLoadState("networkidle").catch(() => null);
    }
  }

  const hooks = await page.evaluate(readHooks);
  const [side] = hooks.toggles;
  const sidebar = side ? [await pressSidebar(page, keyOf(shortcuts, "sidebar"), side)] : [];
  const enter = await press(page, keyOf(shortcuts, "main"));
  await back();
  const escape = await press(page, keyOf(shortcuts, "leave"));
  await back();
  const groups = await pressGroups(page);
  await back();
  const keycaps: Keycap[] = [];

  for (const keycap of hooks.keycaps) {
    const digit = /^\d$/u.test(keycap.keycap);

    const skipped =
      ["sidebar", "search"].includes(keycap.name) || (keycap.name === "pick" && !digit);

    if (!skipped) {
      keycaps.push({
        announced: keycap.announced,
        expected: digit ? keycap.keycap : shortcuts.shortcutKeys(keycap.name),
        label: keycap.control,
        name: keycap.name,
        pressed: await press(page, digit ? keycap.keycap : keyOf(shortcuts, keycap.name)),
      });

      await back();
    }
  }

  return keyFindings({
    enter: { bound: hooks.bound, pressed: enter, unbuilt: hooks.unbuilt },
    escape: { pressed: escape, task: hooks.task, taskClose: hooks.taskClose },
    groups,
    keycaps,
    sidebar,
    sidebarsWithoutToggle: hooks.sidebars.filter((each) => !hooks.toggles.includes(each)),
  });
}
