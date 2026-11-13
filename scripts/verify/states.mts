/* oxlint-disable no-await-in-loop, max-lines-per-function -- The walk acts on one page, one step at a time, and its steps share that page and its counters. */
import { type Locator, type Page } from "@playwright/test";
import { type Finding } from "./checks.mts";
import { lead } from "./craft-rules.mts";
import { type PanelFacts, focusCameBack, inspectPanel, panelFindings, pressKeys } from "./keys.mts";
import { type Target } from "./measure.mts";
import {
  type Action,
  type Comparison,
  type Moved,
  compareLayout,
  markActions,
  pickedIds,
  snapshotLayout,
} from "./states-probe.mts";
import { LOAD_TIMEOUT_MS } from "./tap.mts";
import { VIEWPORTS, type ViewportName } from "./viewports.mts";

/**
 * What one step did, in the words of a lead ("typing a character in", "opening"), and whether the
 * walk blocked a write it sent, so the screen shows what a failed save shows.
 */
export type Step = { action: Action; blocked: boolean; comparison: Comparison; doing: string };

/** Layout offsets are whole pixels, so a 1 px change can be sub-pixel layout rounding. */
const MIN_PX = 2;
const LISTED = 3;
/** A field's checks can wait for a pause in typing. */
const FIELD_SETTLE_MS = 700;
const STEP_SETTLE_MS = 300;
const TRANSITION_CAP_MS = 800;
const ACT_TIMEOUT_MS = 2000;
const STILL_MS = 500;
const STILL_TRIES = 8;
const OVERLAY = "[role=dialog]:visible, [role=menu]:visible, [role=listbox]:visible";

/** Only what reads: a write is aborted, so walking a page changes no data and starts no AI. */
const READS = new Set(["GET", "HEAD", "OPTIONS"]);

function moved(change: Moved) {
  return {
    across: change.after.left - change.before.left,
    down: change.after.top - change.before.top,
    taller: change.after.height - change.before.height,
    wider: change.after.width - change.before.width,
  };
}

function describe(change: Moved) {
  const { across, down } = moved(change);

  const ways = [
    Math.abs(across) >= MIN_PX ? `${Math.abs(across)} px ${across > 0 ? "right" : "left"}` : "",
    Math.abs(down) >= MIN_PX ? `${Math.abs(down)} px ${down > 0 ? "down" : "up"}` : "",
  ].filter(Boolean);

  if (ways.length > 0) {
    return `${change.label} moved ${ways.join(" and ")}`;
  }

  const { after, before } = change;
  return `${change.label} went from ${before.width}×${before.height} to ${after.width}×${after.height} px`;
}

function size({ across, down, taller, wider }: ReturnType<typeof moved>) {
  return Math.max(Math.abs(across), Math.abs(down), Math.abs(taller), Math.abs(wider));
}

/**
 * The changes a person would see as the screen jumping: something that moved on its own (not
 * carried by a parent that moved), and a control, panel or picture that changed size. A fold or a
 * tab may push what's under it down, and a search field may change the list under it: that's what
 * they're for. The boxes holding the field or choice grow with what appeared in them, which their
 * moved neighbors already show.
 */
export function jumps({ action, comparison }: Step): Moved[] {
  const { target } = comparison;
  const pushesDown = (action.kind === "fold" || action.kind === "search") && target !== null;

  return comparison.moved.filter((change) => {
    const { across, down, taller, wider } = moved(change);
    const shifted = Math.max(Math.abs(across), Math.abs(down)) >= MIN_PX;
    const resized = Math.max(Math.abs(taller), Math.abs(wider)) >= MIN_PX;

    const below =
      pushesDown &&
      !change.isTarget &&
      across === 0 &&
      change.before.top >= target.top + target.height - 1;

    return !below && ((shifted && !change.carried) || (resized && change.drawn && !change.holds));
  });
}

export function stateLeads(steps: Step[]): Finding[] {
  return steps.flatMap((step) => {
    const seen = jumps(step);

    if (seen.length === 0) {
      return [];
    }

    const listed = seen.slice(0, LISTED).map((change) => describe(change));
    const more = seen.length > LISTED ? ` and ${seen.length - LISTED} more` : "";
    const failed = step.blocked ? " (the walk blocked its save, so this is a failed save)" : "";

    return [
      lead(
        "X3",
        `${step.doing} ${step.action.label}: ${listed.join("; ")}${more}${failed}`,
        Math.max(...seen.map((change) => size(moved(change)))),
      ),
    ];
  });
}

async function settle(page: Page, ms: number) {
  await page.waitForTimeout(ms);

  await page.evaluate(
    async (cap) =>
      Promise.race([
        Promise.all(
          document
            .getAnimations()
            .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
            .map(async (animation) => animation.finished.catch(() => null)),
        ),
        new Promise((resolve) => {
          setTimeout(resolve, cap);
        }),
      ]),
    TRANSITION_CAP_MS,
  );
}

async function holdStill(page: Page) {
  for (let tries = 0; tries < STILL_TRIES; tries += 1) {
    await page.evaluate(snapshotLayout);
    await page.waitForTimeout(STILL_MS);

    const { moved: changed } = await page.evaluate(compareLayout, "");

    if (changed.length === 0) {
      return;
    }
  }
}

async function walk(
  page: Page,
  { blocked, phone, url }: { blocked: () => number; phone: boolean; url: string },
): Promise<{ panels: PanelFacts[]; steps: Step[] }> {
  const steps: Step[] = [];
  const panels: PanelFacts[] = [];

  async function step(action: Action, doing: string, perform: () => Promise<unknown>, ms: number) {
    await page.evaluate(snapshotLayout);
    const writes = blocked();
    await perform();
    await settle(page, ms);

    steps.push({
      action,
      blocked: blocked() > writes,
      comparison: await page.evaluate(compareLayout, action.id),
      doing,
    });

    if (page.url() !== url) {
      await page.goto(url, { timeout: LOAD_TIMEOUT_MS });
      await page.waitForLoadState("networkidle").catch(() => null);
    }
  }

  async function closeOverlay() {
    if ((await page.locator(OVERLAY).count()) > 0) {
      await page.keyboard.press("Escape");
    }
  }

  async function field(action: Action, element: Locator) {
    const value = await element.inputValue().catch(() => "");
    await step(action, "focusing", async () => element.focus(), STEP_SETTLE_MS);
    await step(action, "typing a character in", async () => element.fill("a"), FIELD_SETTLE_MS);

    await step(
      action,
      "leaving",
      async () => element.evaluate((node) => node instanceof HTMLElement && node.blur()),
      FIELD_SETTLE_MS,
    );

    await element.fill(value).catch(() => null);
    await element.evaluate((node) => node instanceof HTMLElement && node.blur()).catch(() => null);
    await settle(page, STEP_SETTLE_MS);
  }

  async function pick(action: Action, element: Locator) {
    // A radio is put back by picking the one that was picked; anything else by tapping again.
    const radio = await element.evaluate(
      (node) =>
        node.matches("[role=radio], [role=option], input[type=radio]") ||
        node.querySelector("input[type=radio]") !== null,
    );

    const picked = await page.evaluate(pickedIds);

    await step(
      action,
      "picking",
      async () => element.click({ timeout: ACT_TIMEOUT_MS }),
      STEP_SETTLE_MS,
    );

    await step(
      action,
      "unpicking",
      async () => {
        if (!radio) {
          await element.click({ timeout: ACT_TIMEOUT_MS });
          return;
        }

        for (const id of picked.filter((other) => other !== action.id)) {
          await page
            .locator(`[data-zoonk-act="${id}"]`)
            .first()
            .click({ timeout: ACT_TIMEOUT_MS })
            .catch(() => null);
        }
      },
      STEP_SETTLE_MS,
    );
  }

  async function open(action: Action, element: Locator) {
    await step(
      action,
      "opening",
      async () => element.click({ timeout: ACT_TIMEOUT_MS }),
      STEP_SETTLE_MS,
    );

    const panel = await inspectPanel(page, phone);

    // One level in: the choices and fields in what just opened, such as a dialog's options.
    if ((await page.locator(OVERLAY).count()) > 0) {
      const inside = await page.evaluate(markActions, OVERLAY.replaceAll(":visible", ""));

      for (const nested of inside.filter(
        (each) => each.kind !== "control" && each.kind !== "fold" && each.kind !== "overlay",
      )) {
        await act(nested);
      }
    }

    await step(
      action,
      "closing",
      async () => {
        if ((await page.locator(OVERLAY).count()) > 0) {
          await closeOverlay();
        } else {
          await element.click({ timeout: ACT_TIMEOUT_MS });
        }
      },
      STEP_SETTLE_MS,
    );

    if (panel) {
      panels.push({ ...panel, focusBack: await focusCameBack(page, action.id) });
    }
  }

  async function control(action: Action, element: Locator) {
    await step(
      action,
      "hovering",
      async () => element.hover({ timeout: ACT_TIMEOUT_MS }),
      STEP_SETTLE_MS,
    );

    const box = await element.boundingBox({ timeout: ACT_TIMEOUT_MS }).catch(() => null);

    if (!box) {
      return;
    }

    // Held, then released with its click swallowed, so a press never follows a link or submits.
    await page.evaluate(() => {
      globalThis.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          event.stopImmediatePropagation();
        },
        { capture: true, once: true },
      );
    });

    await step(
      action,
      "pressing",
      async () => {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
      },
      STEP_SETTLE_MS,
    );

    await page.mouse.up();
    await closeOverlay();
  }

  async function act(action: Action) {
    const element = page.locator(`[data-zoonk-act="${action.id}"]`).first();
    // The pointer leaves the last control first, so its hover ending isn't this step's change.
    await page.mouse.move(0, 0);
    await settle(page, STEP_SETTLE_MS);

    if (!(await element.isVisible().catch(() => false))) {
      return;
    }

    const run = { control, field, fold: open, overlay: open, pick, search: field }[action.kind];
    await run(action, element).catch(() => null);
  }

  for (const action of await page.evaluate(markActions, "body")) {
    await act(action);
  }

  return { panels, steps };
}

/**
 * Tries what a person tries on a page (focus and type in each field, pick each choice, open and
 * close each fold, menu, tab and dialog, hover and press each control) in a page of its own, so the
 * load's measurements never see it, and leads to what jumped (X3).
 */
export async function walkStates(
  target: Target,
  { path, viewport }: { path: string; viewport: ViewportName },
): Promise<Finding[]> {
  const context = await target.browser.newContext({
    ...VIEWPORTS[viewport],
    storageState: target.storageState,
  });

  const page = await context.newPage();
  page.on("dialog", (dialog) => void dialog.dismiss());

  let blocked = 0;

  await page.route("**/*", async (route) => {
    if (READS.has(route.request().method())) {
      await route.continue();
      return;
    }

    blocked += 1;
    await route.abort();
  });

  try {
    const url = new URL(path, target.baseUrl).toString();
    await page.goto(url, { timeout: LOAD_TIMEOUT_MS });
    await page.waitForLoadState("networkidle").catch(() => null);
    await holdStill(page);
    const { shortcuts } = target;
    const keys = viewport === "laptop" && shortcuts ? await pressKeys(page, url, shortcuts) : [];
    const phone = viewport === "phone";
    const { panels, steps } = await walk(page, { blocked: () => blocked, phone, url: page.url() });
    return [...keys, ...panels.flatMap((panel) => panelFindings(panel)), ...stateLeads(steps)];
  } finally {
    await context.close();
  }
}
