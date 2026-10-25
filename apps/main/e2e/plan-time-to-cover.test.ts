import { type Browser, type Locator, type Request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { openLearnerWithBases } from "./bases-learner";
import { type Page, expect, test } from "./fixtures";
import { keepShownCopiesFresh } from "./fresh-copies";
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

const FAILED = "We couldn't work out the time needed.";

const PHONE = { height: 844, width: 390 };

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
 * Polls what a change saved for as long as planning again may take (see `plan-timeouts.ts`): the
 * change writes once its new plan is computed.
 */
function expectSaved<T>(read: () => Promise<T>) {
  return expect.poll(read, { timeout: REPLAN_TIMEOUT_MS });
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

      return { fittingDate, targetDate: toIsoDay(targetDate) };
    },
  });

  await page.goto("/plan");
  await page.locator('[data-slot="journey"]').getByRole("button", { name: "Adjust plan" }).click();

  const editor = page.getByRole("dialog", { name: "Adjust your plan" });
  // Move your date, whatever it's named: once a search finds the date, it names it.
  const move = editor.getByRole("button", { name: /^Move your date to /u });
  await expect(move).toHaveAccessibleName("Move your date to cover everything");

  return { asked, editor, fittingDate, move, targetDate };
}

/** "Move your date to October 14, 2028": Move your date once it knows the date it moves to. */
function moveTo(editor: Locator) {
  return editor.getByRole("button", { name: /^Move your date to \w+ \d+, \d{4}$/u });
}

/**
 * An exam two months away at 15 minutes a day, on the Plan: her small plan holds far more than that
 * time covers by then, so it falls short, and planning it again takes a moment. Returns the goal's
 * id and the exam's day.
 */
async function openShortOnTime(browser: Browser, viewport?: { height: number; width: number }) {
  const { goal, page } = await openLearnerWithBases(browser, { days: 60, kind: "exam", viewport });
  return { goalId: goal.id, isoDate: goal.targetDate?.toISOString().slice(0, 10) ?? "", page };
}

/** "Adjust plan" beside the Plan's title. */
async function openEditor(page: Page) {
  await page.locator('[data-slot="journey"]').getByRole("button", { name: "Adjust plan" }).click();
  return page.getByRole("dialog", { name: "Adjust your plan" });
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
    const { goalId, isoDate, page } = await openShortOnTime(browser);

    // More than any preset: any time a day is hers to choose.
    const asked = await routeTimeToCover(page, {
      goalId,
      time: { recommendedMinutes: 330, targetDate: isoDate },
    });

    const editor = await openEditor(page);
    const minutes = editor.getByRole("radiogroup", { name: "Time a day" });

    // Nothing says what another time covers until she asks.
    await expect(
      minutes.getByRole("radio", { name: /(?:Covers everything|About \d+%)$/u }),
    ).toHaveCount(0);

    await editor.getByRole("button", { name: FIND }).click();

    // The exact time joins the chips as it is, marked, and takes focus without being picked.
    await expect(
      editor.getByText(/^5\shr 30\smin a day covers everything in depth by .+\.$/u),
    ).toBeVisible();

    const chip = minutes.getByRole("radio", { name: /^5 hr 30 min\s*Covers everything$/u });
    await expect(chip).toBeFocused();
    await expect(chip).not.toBeChecked();
    // Her plan's own week, searched once.
    expect(asked).toStrictEqual([{}]);

    // Space picks it: the plan plans again at that time.
    await page.keyboard.press("Space");
    await expectSaved(() => readDailyMinutes(goalId)).toBe(330);

    await expect(
      editor.getByRole("status").filter({ hasText: "Daily time changed to 5 hr 30 min." }),
    ).toBeVisible({ timeout: REPLAN_TIMEOUT_MS });

    // Undo puts her time back to the plan Find answered for, so its answer shows again, not
    // picked, with no second search.
    await editor.getByRole("button", { name: "Undo" }).click();
    await expectSaved(() => readDailyMinutes(goalId)).toBe(15);

    await expect(minutes.getByRole("radio", { name: /^15 min/u })).toBeChecked({
      timeout: REPLAN_TIMEOUT_MS,
    });

    await expect(chip).toBeVisible();
    await expect(chip).not.toBeChecked();
    expect(asked).toStrictEqual([{}]);

    // Any other change to the plan leaves the answer behind: a study day off clears it.
    await editor.getByRole("button", { exact: true, name: "Saturday" }).click();
    await expect(chip).toHaveCount(0, { timeout: REPLAN_TIMEOUT_MS });
    await page.context().close();
  });

  test("while Move your date finds its date, the other settings wait, so it moves the plan it found it for", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "language" }, async ({ page, user }) => {
      const before = await readDailyMinutes(user.goalId);
      const held = Promise.withResolvers<null>();
      // The search takes as long as this test holds it.
      const { asked, editor, fittingDate, move, targetDate } = await moveDateEditor(
        page,
        user.goalId,
        held.promise,
      );

      // Before the date is known, a tap finds it, and the button keeps the keyboard while it does.
      await move.click();
      await expect(move).toHaveAttribute("aria-busy", "true");
      await expect(move).toBeFocused();

      // A time or a day picked while it searches would leave its date for the plan before.
      await editor.getByRole("radiogroup", { name: "Time a day" }).getByText("4 hr").click();
      await expect(editor.getByRole("button", { exact: true, name: "Saturday" })).toBeDisabled();

      held.resolve(null);

      // Found, the date is named on the button before it moves anything.
      const named = moveTo(editor);
      await expect(named).toBeVisible();
      expect(asked).toStrictEqual([{}]);
      expect(await readTargetDate(user.goalId)).toBe(toIsoDay(targetDate));

      // Once named, one tap moves it, with Undo.
      await named.click();
      await expectSaved(() => readTargetDate(user.goalId)).toBe(fittingDate);
      await expect.poll(() => readDailyMinutes(user.goalId)).toBe(before);

      await expect(editor.getByRole("button", { name: "Undo" })).toBeVisible({
        timeout: REPLAN_TIMEOUT_MS,
      });
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
      await expectSaved(() => readTargetDate(user.goalId)).toBe(ownDate);
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
      await expectSaved(() => readTargetDate(user.goalId)).toBe(ownDate);
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
      await expectSaved(() => readTargetDate(user.goalId)).toBe(tighter);
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
      await expectSaved(() => readTargetDate(user.goalId)).toBe(toIsoDay(targetDate));
    });
  });

  test("a tap on Find doesn't read the page or its links again", async ({ browser }) => {
    await asPersona(browser, { persona: "exam" }, async ({ page, user }) => {
      // Her own 45 minutes a day don't hold all of a real ENEM's depth by the exam months away.
      const goal = await prisma.goal.findUniqueOrThrow({ where: { id: user.goalId } });

      await routeTimeToCover(page, {
        goalId: user.goalId,
        time: { targetDate: goal.targetDate?.toISOString().slice(0, 10) ?? null },
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

      // A Plan seconds old asks whether it changed and may read itself again, after Find too.
      await keepShownCopiesFresh(page);
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

      // No time covers her exam by its date: the keyboard goes to the other way to everything.
      await expect(
        editor.getByText(/^No amount of time a day covers everything in depth by .+\.$/u),
      ).toBeVisible();

      await expect(
        editor.getByRole("switch", { name: "Study everything, even after the exam" }),
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

  test("when no time covers the exam by its date, the coverage card leads with studying everything after it", async ({
    browser,
  }) => {
    const { goalId, isoDate, page } = await openShortOnTime(browser);
    await routeTimeToCover(page, { goalId, time: { targetDate: isoDate } });

    const panel = suggestionPanel(page);
    await panel.getByRole("button", { name: FIND }).click();

    // The button Find was pressed on becomes the one way to everything, and keeps the keyboard.
    const everything = panel.getByRole("button", { name: "Study everything, even after the exam" });

    await expect(everything).toBeFocused();
    await page.keyboard.press("Enter");
    const sheet = page.getByRole("dialog", { name: "Study everything" });
    await expect(sheet).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();

    // It leads the card, so its other options don't offer it again.
    await panel.getByRole("button", { name: "Other options" }).click();
    await expect(page.getByRole("menuitem", { name: "Not now" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /^Study everything/u })).toHaveCount(0);
    await page.context().close();
  });

  test("when no time covers everything in depth, Find offers the time that studies every topic and studying everything", async ({
    browser,
  }) => {
    const { goalId, isoDate, page } = await openShortOnTime(browser);
    await routeTimeToCover(page, { goalId, time: { coreMinutes: 390, targetDate: isoDate } });
    const editor = await openEditor(page);

    const none = editor.getByText(/^No amount of time a day covers everything in depth by .+\.$/u);

    await editor.getByRole("button", { name: FIND }).click();
    await expect(none).toBeVisible();

    await expect(
      editor.getByText("6 hr 30 min a day studies every topic, some in less depth."),
    ).toBeVisible();

    // The time that brings every topic in joins the chips, marked, focused, not picked.
    const chip = editor
      .getByRole("radiogroup", { name: "Time a day" })
      .getByRole("radio", { name: /^6 hr 30 min\s*Every topic$/u });

    await expect(chip).toBeFocused();
    await expect(chip).not.toBeChecked();

    // Studying everything, even after the exam, follows the answer as the other way.
    const everything = editor.getByRole("switch", {
      name: "Study everything, even after the exam",
    });

    const [noneBox, everythingBox] = await Promise.all([
      none.boundingBox(),
      everything.boundingBox(),
    ]);

    expect(everythingBox?.y ?? 0).toBeGreaterThan(noneBox?.y ?? Infinity);

    // Space picks the time: the plan plans again at it.
    await page.keyboard.press("Space");
    await expect.poll(() => readDailyMinutes(goalId)).toBe(390);
    await page.context().close();
  });

  test("on a phone, Find's answer shows above the editor's latest change", async ({ browser }) => {
    const { goalId, page } = await openShortOnTime(browser, PHONE);
    const editor = await openEditor(page);

    // A closer date leaves lessons and topics out: its note, pinned at the sheet's foot, takes
    // much of a phone's height.
    const closer = toIsoDay(new Date(toUTCMidnight(new Date()).getTime() + 30 * MS_PER_DAY));
    await editor.getByLabel("Exam date").fill(closer);
    await editor.getByRole("button", { name: "Save" }).click();

    await expect(editor.getByRole("status").filter({ hasText: /^Date moved to /u })).toBeVisible({
      timeout: REPLAN_TIMEOUT_MS,
    });

    await routeTimeToCover(page, { goalId, time: { targetDate: closer } });
    await editor.getByRole("button", { name: FIND }).click();

    // No time covers it: the keyboard goes to studying everything, and the answer shows with it.
    await expect(
      editor.getByRole("switch", { name: "Study everything, even after the exam" }),
    ).toBeFocused();

    await expect(
      editor.getByText(/^No amount of time a day covers everything in depth by .+\.$/u),
    ).toBeInViewport();

    await page.context().close();
  });

  test("on a phone, studying everything from the coverage card leaves one sheet open at a time", async ({
    browser,
  }) => {
    const { goalId, isoDate, page } = await openShortOnTime(browser, PHONE);
    await routeTimeToCover(page, { goalId, time: { targetDate: isoDate } });

    await page
      .locator('[data-slot="suggestion"]')
      .filter({ visible: true })
      .getByRole("button", { name: "View" })
      .click();

    // The card's sheet is named by its title: what her own time covers.
    const card = page.getByRole("dialog", { name: /^15\smin a day /u });
    await card.getByRole("button", { name: FIND }).click();
    await card.getByRole("button", { name: "Study everything, even after the exam" }).click();

    // The card's sheet gives way to the one that studies everything.
    const sheet = page.getByRole("dialog", { name: "Study everything" });
    await expect(sheet).toBeVisible();
    await expect(card).toBeHidden();

    await sheet.getByRole("button", { name: "Study everything" }).click();
    await sheet.getByRole("button", { name: "Done" }).click({ timeout: REPLAN_TIMEOUT_MS });

    // Done leaves the Plan, with no sheet left under it.
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.context().close();
  });

  test("a search that fails says so once", async ({ browser }) => {
    const { goalId, page } = await openShortOnTime(browser);
    await page.route(`**/v1/goals/${goalId}/plan/time-to-cover`, (route) => route.abort());

    const panel = suggestionPanel(page);
    await panel.getByRole("button", { name: FIND }).click();
    await expect(panel.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(panel.getByText(FAILED).first()).toBeVisible();

    // What she sees is what a screen reader hears, once.
    const heard = await panel.ariaSnapshot();
    expect(heard.split(FAILED)).toHaveLength(2);
    await page.context().close();
  });

  test("the coverage card finds the time and previews what it changes; Apply and Undo keep the keyboard's place, and the result stays while the learner is on it", async ({
    browser,
  }) => {
    const { goalId, isoDate, page } = await openShortOnTime(browser);

    const asked = await routeTimeToCover(page, {
      goalId,
      time: { recommendedMinutes: 300, targetDate: isoDate },
    });

    await page.clock.install();
    await page.reload();

    // Before she asks, the card says exactly what her own time covers.
    const panel = suggestionPanel(page);
    const suggestion = page.locator('[data-slot="suggestion"]').filter({ visible: true });
    const find = panel.getByRole("button", { name: FIND });
    await expect(panel.getByRole("heading")).toHaveText(/^15\smin a day /u);
    await find.click();

    // One tap finds the time and shows what it changes, never applied without its diff.
    const found = "5 hr a day covers everything in depth";
    await expect(panel.getByRole("heading")).toHaveText(found);

    await expect(panel.locator('[data-slot="diff-lines"]')).toBeVisible({
      timeout: REPLAN_TIMEOUT_MS,
    });

    // Not now keeps the answer, with Preview to see the change again.
    await panel.getByRole("button", { exact: true, name: "Not now" }).click();
    await expect(panel.getByRole("heading")).toHaveText(found);
    await panel.getByRole("button", { exact: true, name: "Preview" }).click();
    const apply = panel.getByRole("button", { exact: true, name: "Apply" });
    await expect(apply).toBeVisible({ timeout: REPLAN_TIMEOUT_MS });
    await apply.focus();
    await page.keyboard.press("Enter");

    // Applying plans again: the card says so once the new plan is in, and the suggestion takes
    // the keyboard, not the page.
    await expect(panel.getByRole("heading")).toHaveText("Plan updated", {
      timeout: REPLAN_TIMEOUT_MS,
    });

    await expect(suggestion).toBeFocused();
    await expect.poll(() => readDailyMinutes(goalId)).toBe(300);

    // Past the moment a result usually stays, it's still there while Undo has the keyboard.
    const undo = panel.getByRole("button", { name: "Undo" });
    await undo.focus();
    await page.clock.fastForward(20_000);
    await expect(undo).toBeFocused();

    // Undo puts the plan back and the suggestion with it: the time Find found for this plan comes
    // back too (no second search), and the keyboard lands on it.
    await page.keyboard.press("Enter");
    await expect(panel.getByRole("heading")).toHaveText(found, { timeout: REPLAN_TIMEOUT_MS });
    await expect(panel.getByRole("button", { name: "Preview" })).toBeVisible();
    await expect(find).toHaveCount(0);
    await expect(suggestion).toBeFocused();
    await expect.poll(() => readDailyMinutes(goalId)).toBe(15);
    expect(asked).toHaveLength(1);
    await page.context().close();
  });
});
