/* oxlint-disable no-await-in-loop -- Keys are pressed on one page, one at a time. */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { type Page } from "@playwright/test";
import { type Finding } from "./checks.mts";
import {
  type Pressed,
  readHooks,
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
  wasChecked: boolean;
  id: string;
  announced: string | null;
  expected: string;
  label: string;
  name: string;
  pressed: Pressed | undefined;
};

export type KeyFacts = {
  enter: { bound: { id: string; label: string }[]; pressed: Pressed };
  escape: { pressed: Pressed; task: boolean; taskClose: boolean };
  groups: { label: string; moved: boolean; tabStops: number }[];
  keycaps: Keycap[];
  sidebar: { answered: boolean; restored: boolean; side: string }[];
  sidebarsWithoutToggle: string[];
};

const PRESS_SETTLE_MS = 150;
const SIDEBAR_SETTLE_MS = 400;

/** Sidebar, Escape and panel failures stop the run; other key mismatches remain leads. */
function behavior(id: string, message: string, fails = false): Finding {
  return { check: `Behavior: ${id}`, level: fails ? "fail" : "warn", message };
}

function isMainAction(pressed: NonNullable<Pressed>) {
  return ["bound", "host"].includes(pressed.enter ?? "") && pressed.drawn && pressed.keycap;
}

function enterFindings({ bound, pressed }: KeyFacts["enter"]): Finding[] {
  const [only] = bound;

  return [
    ...(pressed && !isMainAction(pressed)
      ? [behavior("Enter", `Enter clicked ${pressed.label}, which isn't a main action showing ⏎`)]
      : []),
    ...(bound.length === 1 && pressed?.id !== only?.id
      ? [behavior("Enter", `Enter didn't press ${only?.label ?? ""}, the screen's main action`)]
      : []),
    ...(bound.length > 1
      ? [
          behavior(
            "Enter",
            `two main actions answer Enter: ${bound.map((control) => control.label).join(", ")}`,
          ),
        ]
      : []),
  ];
}

function keycapFindings(keycap: Keycap): Finding[] {
  return [
    ...(keycap.pressed === undefined ||
    keycap.pressed?.id === keycap.id ||
    (keycap.wasChecked && !keycap.pressed)
      ? []
      : [
          behavior(
            "keycaps",
            `the ${keycap.name} key didn't press ${keycap.label}, which shows it`,
          ),
        ]),
    ...(keycap.announced === keycap.expected
      ? []
      : [
          behavior(
            "keycaps",
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
          "sidebar key",
          `⌘B ${side.answered ? "didn't bring back" : "didn't fold"} the ${side.side} sidebar`,
          true,
        ),
      ),
    ...facts.sidebarsWithoutToggle.map((side) =>
      behavior("sidebar key", `the ${side} sidebar is drawn with no toggle for it`, true),
    ),
    ...enterFindings(facts.enter),
    ...(escape.pressed && !escape.pressed.drawn
      ? [behavior("Escape", `Esc clicked ${escape.pressed.label}, which isn't on screen`, true)]
      : []),
    ...(escape.task && escape.taskClose && !escape.pressed?.taskClose
      ? [behavior("Escape", "Esc didn't press the task's ✕", true)]
      : []),
    ...facts.groups.flatMap((group) => [
      ...(group.moved
        ? []
        : [behavior("radio arrows", `↓ didn't move to the next option in ${group.label}`)]),
      ...(group.tabStops === 1
        ? []
        : [
            behavior(
              "radio arrows",
              `${group.label} has ${group.tabStops} Tab stops, where a group has one`,
            ),
          ]),
    ]),
    ...facts.keycaps.flatMap((keycap) => keycapFindings(keycap)),
  ];
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
      await options.first().focus();
      await page.keyboard.press("ArrowDown");
      const tabStops = await group.locator("[role=radio][tabindex='0']").count();

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
      await page.evaluate(readHooks);
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

  if (groups.length > 0) {
    await page.goto(url);
    await page.waitForLoadState("networkidle").catch(() => null);
    await page.evaluate(readHooks);
  } else {
    await back();
  }

  async function pressHint(keycap: (typeof hooks.keycaps)[number]) {
    if (!keycap.canPress) {
      return;
    }

    if (keycap.name === "main") {
      return enter;
    }

    const digit = /^\d$/u.test(keycap.keycap);
    return press(page, digit ? keycap.keycap : keyOf(shortcuts, keycap.name));
  }

  const keycaps: Keycap[] = [];

  for (const keycap of hooks.keycaps) {
    const digit = /^\d$/u.test(keycap.keycap);

    const skipped =
      ["sidebar", "search"].includes(keycap.name) || (keycap.name === "pick" && !digit);

    if (!skipped) {
      const wasChecked = await page.evaluate(
        (id) =>
          document
            .querySelector(`[data-zoonk-key="${id}"]`)
            ?.matches(":checked, [aria-checked=true]") ?? false,
        keycap.id,
      );

      keycaps.push({
        announced: keycap.announced,
        expected: digit ? keycap.keycap : shortcuts.shortcutKeys(keycap.name),
        id: keycap.id,
        label: keycap.control,
        name: keycap.name,
        pressed: await pressHint(keycap),
        wasChecked,
      });

      await back();
    }
  }

  return keyFindings({
    enter: { bound: hooks.bound, pressed: enter },
    escape: { pressed: escape, task: hooks.task, taskClose: hooks.taskClose },
    groups,
    keycaps,
    sidebar,
    sidebarsWithoutToggle: hooks.sidebars.filter((each) => !hooks.toggles.includes(each)),
  });
}
