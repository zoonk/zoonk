import { type Page, expect } from "./fixtures";

const STEP_PATTERN = /^Step (?<current>\d+) of (?<total>\d+)$/u;

/** The dots that say where the learner is in a result told in steps: "Step 2 of 4". */
export function stepDots(page: Page) {
  return page.getByRole("img", { name: STEP_PATTERN });
}

/** Where the learner is; a result with one step has no dots. Read once the result shows. */
async function readStep(page: Page): Promise<{ current: number; total: number }> {
  if ((await stepDots(page).count()) === 0) {
    return { current: 1, total: 1 };
  }

  const label = (await stepDots(page).getAttribute("aria-label")) ?? "";
  const groups = STEP_PATTERN.exec(label)?.groups;

  return { current: Number(groups?.current ?? 1), total: Number(groups?.total ?? 1) };
}

/**
 * Goes to the next step, by Enter or a click on Continue, and waits for it: the dots move, or a
 * moment (a ceremony) opens over the step it reached.
 */
export async function nextStep(page: Page, { keyboard = false }: { keyboard?: boolean } = {}) {
  const { current, total } = await readStep(page);
  const reached = page.getByRole("img", { name: `Step ${current + 1} of ${total}` });

  if (keyboard) {
    await page.keyboard.press("Enter");
  } else {
    await page.getByRole("button", { exact: true, name: "Continue" }).click();
  }

  await expect(reached.or(page.getByRole("dialog")).first()).toBeVisible();
}

/**
 * Continues until the step titled `name` shows. A result says only what happened, so a test that
 * doesn't control every step (how preparation moved, an insight) reaches the one it checks by name.
 */
export async function continueToStep(
  page: Page,
  name: RegExp | string,
  { keyboard = false }: { keyboard?: boolean } = {},
) {
  const heading = page.getByRole("heading", { level: 1, name });
  const { current, total } = await readStep(page);

  for (let step = current; step < total; step += 1) {
    // oxlint-disable-next-line no-await-in-loop -- Each step is read before moving on.
    if (await heading.isVisible()) {
      return;
    }

    // oxlint-disable-next-line no-await-in-loop -- One step at a time.
    await nextStep(page, { keyboard });
  }

  await expect(heading).toBeVisible();
}

/** Continues to the last step, where the result's own actions are. */
export async function continueToLastStep(
  page: Page,
  { keyboard = false }: { keyboard?: boolean } = {},
) {
  const { current, total } = await readStep(page);

  for (let step = current; step < total; step += 1) {
    // oxlint-disable-next-line no-await-in-loop -- One step at a time.
    await nextStep(page, { keyboard });
  }
}
