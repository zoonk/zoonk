import { type Request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { type Page, expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { REPLAN_TIMEOUT_MS } from "./plan-timeouts";
import { routeTimeToCover } from "./time-to-cover-routes";

/*
 * "Find the time that covers everything": no page or prefetch searches other daily times (LEAD
 * ruling, option 2); the learner asks, in the plan editor's time a day or the Plan's coverage card,
 * and only the button waits. Main's E2E runs without the API, so each test says what the search
 * found (see `routeTimeToCover`); the API's E2E and core's tests prove the search exact.
 */

const FIND = "Find the time that covers everything";

/** The Plan's one suggestion, as the aside's panel at the tests' desktop width. */
function suggestionPanel(page: Page) {
  return page.locator('[data-slot="suggestion-panel"]').filter({ visible: true });
}

function readDailyMinutes(goalId: string) {
  return prisma.goal.findUniqueOrThrow({ where: { id: goalId } }).then((goal) => goal.dailyMinutes);
}

function toIsoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function readTargetDate(goalId: string) {
  return prisma.goal
    .findUniqueOrThrow({ where: { id: goalId } })
    .then((goal) => (goal.targetDate ? toIsoDay(goal.targetDate) : null));
}

/**
 * Holds the page's next Server Action (a save: a change, an Undo) until `release`, as a slow save
 * would. Main's plan changes post to the page.
 */
async function holdNextSave(page: Page) {
  const released = Promise.withResolvers<null>();
  let held = false;

  await page.route("**/*", async (route) => {
    const request = route.request();

    if (!held && request.method() === "POST" && request.headers()["next-action"] !== undefined) {
      held = true;
      await released.promise;
    }

    await route.fallback();
  });

  return { isHeld: () => held, release: () => released.resolve(null) };
}

/**
 * Marcos's move came forward to a month away, so his own time falls short by then. The plan editor
 * is open. Main's E2E runs without the API: Find answers once `found` resolves (at once without
 * it), with a date a year later that his time covers it all by.
 */
async function moveDateEditor(page: Page, goalId: string, found?: Promise<unknown>) {
  const targetDate = new Date(toUTCMidnight(new Date()).getTime() + 30 * MS_PER_DAY);
  const fittingDate = toIsoDay(new Date(targetDate.getTime() + 365 * MS_PER_DAY));
  await prisma.goal.update({ data: { targetDate }, where: { id: goalId } });

  const asked = await routeTimeToCover(page, {
    goalId,
    time: async () => {
      await found;

      return {
        fittingDate,
        maximum: { coveredShare: 0.37, dailyMinutes: 240 },
        measure: "goal",
        targetDate: toIsoDay(targetDate),
      };
    },
  });

  await page.goto("/plan");
  await page.locator('[data-slot="journey"]').getByRole("button", { name: "Adjust plan" }).click();

  const editor = page.getByRole("dialog", { name: "Adjust your plan" });
  const move = editor.getByRole("button", { name: "Move your date to cover everything" });
  await expect(move).toBeVisible();

  return { asked, editor, fittingDate, move, targetDate };
}

/**
 * Ana's exam two months away at 15 minutes a day, set in the plan editor as she would (a time
 * written straight to the database would leave her saved plan in place): her time falls short.
 * Returns the editor, still open, and the exam's day.
 */
async function shortOnTime(page: Page, goalId: string) {
  const examDate = new Date(toUTCMidnight(new Date()).getTime() + 60 * MS_PER_DAY);
  await prisma.goal.update({ data: { targetDate: examDate }, where: { id: goalId } });

  await page.goto("/plan");
  await expect(page.locator('[data-slot="journey"]')).toBeVisible();

  await page.locator('[data-slot="journey"]').getByRole("button", { name: "Adjust plan" }).click();

  const editor = page.getByRole("dialog", { name: "Adjust your plan" });
  await editor.getByRole("radiogroup", { name: "Time a day" }).getByText("15 min").click();

  await expect(
    editor.getByRole("status").filter({ hasText: "Daily time changed to 15 min." }),
  ).toBeVisible({ timeout: REPLAN_TIMEOUT_MS });

  return { editor, isoDate: examDate.toISOString().slice(0, 10) };
}

/**
 * A request that reads the page or a link's page: a Server Action (`action`), or a router fetch or
 * prefetch of a page's server components, by its path, and as `key` the one part of it asked for
 * (a link prefetches its tree, then its page's segment, then its runtime data, over a few seconds).
 * Null for anything else.
 */
function readPage(request: Request): { action: boolean; key: string; path: string } | null {
  const headers = request.headers();
  const url = new URL(request.url());
  const action = headers["next-action"] !== undefined;

  if (!action && headers.rsc !== "1" && !url.searchParams.has("_rsc")) {
    return null;
  }

  const part = [headers["next-router-prefetch"], headers["next-router-segment-prefetch"]];
  return { action, key: [url.pathname, ...part].join(" "), path: url.pathname };
}

/** Next schedules link prefetches for idle time: past two idle callbacks, they'd have started. */
async function idleTwice(page: Page) {
  for (const _ of [1, 2]) {
    // oxlint-disable-next-line no-await-in-loop -- the second idle time comes after the first
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestIdleCallback(() => resolve());
        }),
    );
  }
}

test.describe("Find the time that covers everything", () => {
  test("the editor marks the exact time found without picking it, and a pick applies it", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      const { editor, isoDate } = await shortOnTime(page, user.goalId);

      const asked = await routeTimeToCover(page, {
        goalId: user.goalId,
        time: { recommendedMinutes: 95, targetDate: isoDate },
      });

      const minutes = editor.getByRole("radiogroup", { name: "Time a day" });

      // Nothing says what another time covers until she asks.
      await expect(
        minutes.getByRole("radio", { name: /(?:Covers everything|About \d+%)$/u }),
      ).toHaveCount(0);

      await editor.getByRole("button", { name: FIND }).click();

      // The exact time joins the chips as it is, marked, and takes focus without being picked.
      await expect(
        editor.getByText(/^1\shr 35\smin a day covers everything in depth by .+\.$/u),
      ).toBeVisible();

      const chip = minutes.getByRole("radio", { name: /^1 hr 35 min\s*Covers everything$/u });
      await expect(chip).toBeFocused();
      await expect(chip).not.toBeChecked();
      // Her plan's own week, searched once.
      expect(asked).toStrictEqual([{}]);

      // Space picks it: the plan plans again at that time.
      await page.keyboard.press("Space");
      await expect.poll(() => readDailyMinutes(user.goalId)).toBe(95);

      await expect(
        editor.getByRole("status").filter({ hasText: "Daily time changed to 1 hr 35 min." }),
      ).toBeVisible({ timeout: REPLAN_TIMEOUT_MS });

      // Undo puts her time back to the plan Find answered for, so its answer shows again, not
      // picked, with no second search.
      await editor.getByRole("button", { name: "Undo" }).click();
      await expect.poll(() => readDailyMinutes(user.goalId)).toBe(15);

      await expect(minutes.getByRole("radio", { name: /^15 min/u })).toBeChecked({
        timeout: REPLAN_TIMEOUT_MS,
      });

      await expect(chip).toBeVisible();
      await expect(chip).not.toBeChecked();
      expect(asked).toStrictEqual([{}]);

      // Any other change to the plan leaves the answer behind: a study day off clears it.
      await editor.getByRole("button", { exact: true, name: "Saturday" }).click();
      await expect(chip).toHaveCount(0, { timeout: REPLAN_TIMEOUT_MS });
    });
  });

  test("while Move your date finds its date, the other settings wait, so it moves the plan it found it for", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "language" }, async ({ page, user }) => {
      const before = await readDailyMinutes(user.goalId);
      const held = Promise.withResolvers<null>();
      // The search takes as long as this test holds it.
      const { editor, fittingDate, move } = await moveDateEditor(page, user.goalId, held.promise);
      await move.click();
      await expect(move).toHaveAttribute("aria-busy", "true");

      // A time or a day picked while it searches would leave its date for the plan before.
      await editor.getByRole("radiogroup", { name: "Time a day" }).getByText("4 hr").click();
      await expect(editor.getByRole("button", { exact: true, name: "Saturday" })).toBeDisabled();

      held.resolve(null);

      await expect.poll(() => readTargetDate(user.goalId)).toBe(fittingDate);
      await expect.poll(() => readDailyMinutes(user.goalId)).toBe(before);
    });
  });

  test("a date she saves while Move your date searches stays: the move leaves the plan to it", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "language" }, async ({ page, user }) => {
      const found = Promise.withResolvers<null>();
      const { editor, move, targetDate } = await moveDateEditor(page, user.goalId, found.promise);
      const ownDate = toIsoDay(new Date(targetDate.getTime() + 90 * MS_PER_DAY));

      await move.click();
      await expect(move).toHaveAttribute("aria-busy", "true");

      // Her own date, saved while it searches, is her newer word: the date found, which answers
      // while her save is still on its way, moves nothing.
      const save = await holdNextSave(page);
      await editor.getByLabel("Deadline").fill(ownDate);
      await editor.getByRole("button", { name: "Save" }).click();
      await expect.poll(save.isHeld).toBe(true);
      found.resolve(null);

      await expect(move).not.toHaveAttribute("aria-busy", "true");
      save.release();
      await expect.poll(() => readTargetDate(user.goalId)).toBe(ownDate);
      await expect(editor.getByLabel("Deadline")).toHaveValue(ownDate);
    });
  });

  test("a date still saving keeps Move your date from moving the plan before it", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "language" }, async ({ page, user }) => {
      const { asked, editor, move, targetDate } = await moveDateEditor(page, user.goalId);
      const ownDate = toIsoDay(new Date(targetDate.getTime() + 90 * MS_PER_DAY));

      const save = await holdNextSave(page);
      await editor.getByLabel("Deadline").fill(ownDate);
      await editor.getByRole("button", { name: "Save" }).click();
      await expect.poll(save.isHeld).toBe(true);

      // A tap on Move before her date is saved finds nothing: a date it found now would be for the
      // plan before.
      await move.click();
      await expect(move).not.toHaveAttribute("aria-busy", "true");
      expect(asked).toStrictEqual([]);

      save.release();
      await expect.poll(() => readTargetDate(user.goalId)).toBe(ownDate);
      expect(asked).toStrictEqual([]);
    });
  });

  test("an Undo while Move your date searches wins: the move leaves the plan to it", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "language" }, async ({ page, user }) => {
      const found = Promise.withResolvers<null>();
      const { editor, move, targetDate } = await moveDateEditor(page, user.goalId, found.promise);
      const tighter = toIsoDay(new Date(targetDate.getTime() - 10 * MS_PER_DAY));

      await editor.getByLabel("Deadline").fill(tighter);
      await editor.getByRole("button", { name: "Save" }).click();
      await expect.poll(() => readTargetDate(user.goalId)).toBe(tighter);
      const undo = editor.getByRole("button", { name: "Undo" });
      await expect(undo).toBeVisible({ timeout: REPLAN_TIMEOUT_MS });

      await move.click();
      await expect(move).toHaveAttribute("aria-busy", "true");

      // She undoes the tighter date while Move searches: her Undo, still on its way when the date is
      // found, comes after, and the date found moves nothing.
      const save = await holdNextSave(page);
      await undo.click();
      await expect.poll(save.isHeld).toBe(true);
      found.resolve(null);

      await expect(move).not.toHaveAttribute("aria-busy", "true");
      save.release();
      await expect.poll(() => readTargetDate(user.goalId)).toBe(toIsoDay(targetDate));
    });
  });

  test("a tap on Find doesn't read the page or its links again", async ({ browser }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      // Her own 45 minutes a day don't hold all of a real ENEM's depth by the exam months away.
      const goal = await prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } });

      await routeTimeToCover(page, {
        goalId: user.goalId,
        time: {
          maximum: { coveredShare: 0.54, dailyMinutes: 240 },
          targetDate: goal.targetDate?.toISOString().slice(0, 10) ?? null,
        },
      });

      // Every read of the page or its links, and whether it went out once she tapped Find.
      const reads: { action: boolean; afterFind: boolean; key: string; path: string }[] = [];
      let afterFind = false;

      page.on("request", (request) => {
        const read = readPage(request);

        if (read) {
          reads.push({ ...read, afterFind });
        }
      });

      await page.goto("/plan");
      await expect(page.locator('[data-slot="journey"]')).toBeVisible();
      const planPath = new URL(page.url()).pathname;

      await page
        .locator('[data-slot="journey"]')
        .getByRole("button", { name: "Adjust plan" })
        .click();

      const editor = page.getByRole("dialog", { name: "Adjust your plan" });
      const find = editor.getByRole("button", { name: FIND });
      await expect(find).toBeVisible();
      await idleTwice(page);

      afterFind = true;
      await find.click();

      await expect(
        editor.getByText(
          /^Even at 4\shr a day, you'd study about 54% of everything in depth by your date\.$/u,
        ),
      ).toBeVisible();

      await expect(
        editor
          .getByRole("radiogroup", { name: "Time a day" })
          .getByRole("radio", { name: /^4 hr\s*About 54%$/u }),
      ).toBeFocused();

      // A Server Action would purge the client cache and refresh the page, and every visible link
      // would prefetch again when the browser is next idle: a dozen server renders per tap. Find
      // posts to the API instead, so once the browser has been idle twice, nothing read the page
      // or asked again for a part of a link it had read. A link's later parts may still land.
      await idleTwice(page);
      const before = new Set(reads.filter((read) => !read.afterFind).map((read) => read.key));

      const readAgain = reads.filter(
        (read) => read.afterFind && (read.action || read.path === planPath || before.has(read.key)),
      );

      expect(readAgain).toStrictEqual([]);
    });
  });

  test("the coverage card finds the time, previews what it changes and applies it", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      const { editor, isoDate } = await shortOnTime(page, user.goalId);

      await routeTimeToCover(page, {
        goalId: user.goalId,
        time: { maximum: { coveredShare: 0.54, dailyMinutes: 240 }, targetDate: isoDate },
      });

      await editor.getByRole("button", { name: "Close" }).click();
      await expect(editor).toBeHidden();

      // Before she asks, the card says exactly what her own time covers.
      const panel = suggestionPanel(page);
      await expect(panel.getByRole("heading")).toHaveText(/^15\smin a day /u);
      await panel.getByRole("button", { name: FIND }).click();

      // One tap finds the time and shows what it changes, never applied without its diff.
      await expect(panel.getByRole("heading")).toHaveText("4 hr a day covers about 54% in depth");

      await expect(panel.locator('[data-slot="diff-lines"]')).toBeVisible({
        timeout: REPLAN_TIMEOUT_MS,
      });

      // Not now keeps the answer, with Preview to see the change again.
      await panel.getByRole("button", { exact: true, name: "Not now" }).click();
      await expect(panel.getByRole("heading")).toHaveText("4 hr a day covers about 54% in depth");
      await panel.getByRole("button", { exact: true, name: "Preview" }).click();
      await panel.getByRole("button", { exact: true, name: "Apply" }).click();

      await expect(panel.getByRole("heading")).toHaveText("Plan updated");
      await expect.poll(() => readDailyMinutes(user.goalId)).toBe(240);
    });
  });
});
