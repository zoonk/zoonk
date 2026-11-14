import { type Locator, type Page } from "@playwright/test";
import { type Finding } from "./checks.mts";
import { pressKeys } from "./keys.mts";
import { type Target } from "./measure.mts";
import { OVERLAY_SELECTOR } from "./overlays.mts";
/* oxlint-disable no-await-in-loop, max-lines-per-function -- The walk acts on one page, one step at a time, and its steps share that page and its counters. */
import { installPageHelpers } from "./page-helpers.mts";
import { focusCameBack, inspectPanel, panelFindings } from "./panels.mts";
import { stateLeads } from "./states-checks.mts";
import {
  type Action,
  type Comparison,
  compareLayout,
  markActions,
  pickedIds,
  snapshotLayout,
} from "./states-probe.mts";
import { holdStill, settle } from "./states-wait.mts";
import { LOAD_TIMEOUT_MS } from "./tap.mts";
import { VIEWPORTS, type ViewportName } from "./viewports.mts";

/**
 * What one step did, in the words of a lead ("typing a character in", "opening"), and whether the
 * walk blocked a write it sent, so the screen shows what a failed save shows.
 */
export type Step = { action: Action; blocked: boolean; comparison: Comparison; doing: string };

export type WalkCoverage = { actionsTried: number; actionsSkipped: number; panelsOpened: number };
export type WalkReport = WalkCoverage & { findings: Finding[] };

/** A field's checks can wait for a pause in typing. */
const FIELD_SETTLE_MS = 700;
const STEP_SETTLE_MS = 300;
const ACT_TIMEOUT_MS = 2000;

const OVERLAY =
  `${OVERLAY_SELECTOR}, [role=dialog], [role=alertdialog], [role=menu], [role=listbox]`
    .split(", ")
    .map((selector) => `${selector}:visible`)
    .join(", ");

/** Only what reads: a write is aborted, so walking a page changes no data and starts no AI. */
const READS = new Set(["GET", "HEAD", "OPTIONS"]);

async function walk(
  page: Page,
  {
    blocked,
    phone,
    url,
    capture,
  }: {
    blocked: () => number;
    phone: boolean;
    url: string;
    capture?: (page: Page, state: string) => Promise<void>;
  },
): Promise<WalkReport> {
  const steps: Step[] = [];
  const findings: Finding[] = [];
  const coverage: WalkCoverage = { actionsSkipped: 0, actionsTried: 0, panelsOpened: 0 };

  async function step(action: Action, doing: string, perform: () => Promise<unknown>, ms: number) {
    await page.evaluate(snapshotLayout);
    const writes = blocked();
    const performed = await perform();
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
      await page.evaluate(markActions, "body");
    }

    return performed;
  }

  async function closeOverlay() {
    if ((await page.locator(OVERLAY).count()) > 0) {
      await page.keyboard.press("Escape");
      return true;
    }

    return false;
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
    coverage.panelsOpened += panel ? 1 : 0;
    await capture?.(page, `opening ${action.id}`);

    // One level in: the choices and fields in what just opened, such as a dialog's options.
    if ((await page.locator(OVERLAY).count()) > 0) {
      const inside = await page.evaluate(markActions, OVERLAY.replaceAll(":visible", ""));

      const choices = inside.filter((each) => each.kind !== "control" && each.kind !== "fold");

      coverage.actionsSkipped += inside.length - choices.length;

      for (const nested of choices) {
        await act(nested);
      }
    }

    const closedByWalk = await step(
      action,
      "closing",
      async () => {
        const closed = await closeOverlay();

        if (!closed && !panel && action.kind === "fold") {
          await element.click({ timeout: ACT_TIMEOUT_MS });
        }

        return closed;
      },
      STEP_SETTLE_MS,
    );

    if (panel) {
      findings.push(
        ...panelFindings({
          ...panel,
          focusBack: closedByWalk ? await focusCameBack(page, action.id, action.returnTo) : null,
        }),
      );
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
      coverage.actionsSkipped += 1;
      return;
    }

    coverage.actionsTried += 1;
    const run = { control, field, fold: open, overlay: open, pick, search: field }[action.kind];

    await run(action, element).catch((error: unknown) => {
      findings.push({
        check: "Walk: action incomplete",
        level: "warn",
        message: `${action.label}: ${error instanceof Error ? error.message : String(error)}`,
      });
    });
  }

  for (const action of await page.evaluate(markActions, "body")) {
    await act(action);
  }

  return { ...coverage, findings: [...findings, ...stateLeads(steps)] };
}

/**
 * Tries what a person tries on a page (focus and type in each field, pick each choice, open and
 * close each fold, menu, tab and dialog, hover and press each control) in a page of its own, so the
 * load's measurements never see it, and leads to what jumped (X3).
 */
export async function walkStates(
  target: Target,
  {
    path,
    viewport,
    capture,
  }: {
    path: string;
    viewport: ViewportName;
    capture?: (page: Page, state: string) => Promise<void>;
  },
): Promise<WalkReport> {
  const context = await target.browser.newContext({
    ...VIEWPORTS[viewport],
    storageState: target.storageState,
  });

  await context.addInitScript(installPageHelpers);
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
    await capture?.(page, "page");
    const { shortcuts } = target;
    const keys = viewport === "laptop" && shortcuts ? await pressKeys(page, url, shortcuts) : [];
    const phone = viewport === "phone";

    const walked = await walk(page, { blocked: () => blocked, capture, phone, url: page.url() });

    return { ...walked, findings: [...keys, ...walked.findings] };
  } finally {
    await context.close();
  }
}
