import { type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { createCheckpointLearner } from "./checkpoint-fixtures";
import { openPaletteWithKeyboard } from "./command-palette";
import { expect, test } from "./fixtures";
import { watchStart } from "./start-watch";
import { openAs } from "./study-day";

/**
 * The line past today's study time: a phase challenge comes back on its own (its plan here studies
 * every day, so tomorrow); the week's doesn't, so it says how to keep it.
 */
type UsedUpLine = "keep" | "tomorrow";

const STUDY_TIME_USED_UP = {
  keep: "You've reached today's study time. Move it to Monday to keep it.",
  tomorrow: "You've reached today's study time. It'll be here tomorrow.",
} as const satisfies Record<UsedUpLine, string>;

const START_FAILED = "That didn't go through. Try again in a moment.";

/** The week's line once it can't move: only that today's study time is used up. */
const STUDY_TIME_USED_UP_ONLY = "You've reached today's study time.";

/** The plan's answer to a move onto a day that already has the week's mock. */
const MOVE_COLLIDES = "That day already has a mock exam, so this one stays where it is.";

const DAYS_PER_WEEK = 7;
const MONDAY = 1;

/** The Monday the week's challenge moves to: the first one after today. */
function nextMonday(): Date {
  const today = toUTCMidnight(new Date());
  const days = (MONDAY - today.getUTCDay() + DAYS_PER_WEEK) % DAYS_PER_WEEK || DAYS_PER_WEEK;
  return new Date(today.getTime() + days * MS_PER_DAY);
}

/** Today's study time under a 30-minute daily limit, all used. */
async function useUpTodaysStudyTime(userId: string) {
  await Promise.all([
    prisma.userLearningProfile.upsert({
      create: { dailyLimitMinutes: 30, userId },
      update: { dailyLimitMinutes: 30 },
      where: { userId },
    }),
    dailyProgressFixtureMany([
      { date: toUTCMidnight(new Date()), timeSpentSeconds: 30 * 60, userId },
    ]),
  ]);
}

/** The intro's footer once today's study time is used up: when it's back, and the way home. */
async function expectStudyTimeUsedUp(page: Page, line: UsedUpLine) {
  await expect(
    page.getByRole("status").filter({ hasText: STUDY_TIME_USED_UP[line] }),
  ).toBeVisible();

  await expect(page.getByRole("link", { name: "Back to Today" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Start/u })).toHaveCount(0);
}

test("a challenge intro opened past today's study time says when it's back, with no Start to tap", async ({
  browser,
}) => {
  const { block, boss, user } = await createCheckpointLearner();
  await useUpTodaysStudyTime(user.id);
  const page = await openAs(browser, user);
  await page.goto(`/challenge/${boss.id}`);
  // Its plan studies every day, so it's back tomorrow.
  await expectStudyTimeUsedUp(page, "tomorrow");

  await expect(
    prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
  ).resolves.toMatchObject({ status: "pending" });

  await page.getByRole("link", { name: "Back to Today" }).click();
  await expect(page).toHaveURL(/\/today$/u);
  await page.context().close();
});

test("the week's mock exam past today's study time says how to keep it, with Move to Monday and the way back to Today", async ({
  browser,
}) => {
  const { boss, user } = await createCheckpointLearner({ kind: "weekly", planned: true });
  await useUpTodaysStudyTime(user.id);
  const page = await openAs(browser, user);
  await page.goto(`/challenge/${boss.id}`);

  // Left unstarted, the week's challenge leaves the plan once the next study day re-plans, so it
  // promises no day: moving it, which changes the plan, not today's study, keeps it.
  // Not tapped here: the move itself is checkpoints.test.ts's "Move to Monday" flow, and core's
  // challenges.test.ts proves the moved one starts in Monday's session.
  await expectStudyTimeUsedUp(page, "keep");
  await expect(page.getByRole("button", { name: "Move to Monday" })).toBeEnabled();

  // Moving is what keeps it, so Move to Monday is the main action Enter presses, not the way back.
  await expect(page.getByRole("button", { name: "Move to Monday" })).toHaveAttribute(
    "aria-keyshortcuts",
    "Enter",
  );

  await expect(page.getByRole("link", { name: "Back to Today" })).not.toHaveAttribute(
    "aria-keyshortcuts",
  );

  await page.context().close();
});

test("the week's mock exam past today's study time stops offering Move to Monday once the plan refuses it", async ({
  browser,
}) => {
  const { boss, plan, user } = await createCheckpointLearner({ kind: "weekly", planned: true });

  // Next Monday already has the week's mock, so the plan refuses to move this one onto it.
  await planItemFixture({
    kind: "mock",
    phase: 0,
    planId: plan.id,
    position: 1,
    scheduledFor: nextMonday(),
    titleSnapshot: "Mock exam 2",
  });

  await useUpTodaysStudyTime(user.id);
  const page = await openAs(browser, user);
  await page.goto(`/challenge/${boss.id}`);
  await expectStudyTimeUsedUp(page, "keep");
  await page.getByRole("button", { name: "Move to Monday" }).click();

  // The refusal is a fact about the plan: the line stops asking for the move and the button goes,
  // leaving the way back to Today as the one action.
  await expect(page.getByText(MOVE_COLLIDES)).toBeVisible();

  await expect(page.getByRole("status").filter({ hasText: STUDY_TIME_USED_UP_ONLY })).toHaveText(
    STUDY_TIME_USED_UP_ONLY,
  );

  await expect(page.getByRole("button", { name: "Move to Monday" })).toHaveCount(0);

  await expect(page.getByRole("link", { name: "Back to Today" })).toHaveAttribute(
    "aria-keyshortcuts",
    "Enter",
  );

  await expect(page).toHaveURL(new RegExp(`/challenge/${boss.id}$`, "u"));
  await page.context().close();
});

test("the week's mock exam stops offering Move to Monday beside Start once the plan refuses it", async ({
  browser,
}) => {
  const { boss, plan, user } = await createCheckpointLearner({ kind: "weekly", planned: true });

  // Next Monday already has the week's mock, so the plan refuses to move this one onto it.
  await planItemFixture({
    kind: "mock",
    phase: 0,
    planId: plan.id,
    position: 1,
    scheduledFor: nextMonday(),
    titleSnapshot: "Mock exam 2",
  });

  const page = await openAs(browser, user);
  await page.goto(`/challenge/${boss.id}`);
  const start = page.getByRole("button", { name: "Start the mock exam" });
  await expect(start).toBeEnabled();
  await page.getByRole("button", { name: "Move to Monday" }).click();

  // The refusal is a fact about the plan, so Move to Monday goes instead of offering a move the
  // plan can only refuse again. Today's study time isn't used up: Start stays the main action.
  await expect(page.getByText(MOVE_COLLIDES)).toBeVisible();
  await expect(page.getByRole("button", { name: "Move to Monday" })).toHaveCount(0);
  await expect(start).toBeEnabled();
  await expect(start).toHaveAttribute("aria-keyshortcuts", "Enter");
  await expect(page).toHaveURL(new RegExp(`/challenge/${boss.id}$`, "u"));

  await page.context().close();
});

test("a challenge refused at today's study time offers Start again once the learner lifts the limit", async ({
  browser,
}) => {
  const { boss, user } = await createCheckpointLearner();
  const page = await openAs(browser, user);
  await page.goto("/today");
  const today = page.getByRole("region", { name: "Today's session" });
  await today.getByRole("button", { name: /^(?:Start session|Continue)/u }).click();
  await expect(page).toHaveURL(new RegExp(`/challenge/${boss.id}\\?session=`, "u"));
  const start = page.getByRole("button", { exact: true, name: "Start" });
  await expect(start).toBeVisible();

  // Meanwhile today's study time ran out: Start says so, as opening the page would. From the tap
  // on, while the page is read again, Start never shows ready again and no failure shows.
  await useUpTodaysStudyTime(user.id);

  const readSeen = await watchStart(page, start, {
    failure: START_FAILED,
    label: /^Start(?!ing)/u,
  });

  await start.click();
  await expectStudyTimeUsedUp(page, "tomorrow");

  await expect(readSeen()).resolves.toMatchObject({
    busy: true,
    failure: 0,
    readyAgain: 0,
    tapped: true,
  });

  await page.getByRole("link", { name: "Back to Today" }).click();
  await expect(page).toHaveURL(/\/today$/u);

  // Every step stays in the app, so the challenge's screen is kept for coming back.
  const palette = await openPaletteWithKeyboard(page, /Search/iu);
  await palette.getByRole("combobox", { name: /Search/iu }).fill("language");
  await palette.getByRole("option", { name: /^Language/u }).click();
  await expect(page).toHaveURL(/\/settings\/appearance$/u);

  await page
    .getByRole("combobox", { name: "Daily time limit" })
    .selectOption({ label: "No limit" });

  await expect
    .poll(() => prisma.userLearningProfile.findUnique({ where: { userId: user.id } }))
    .toMatchObject({ dailyLimitMinutes: null });

  await page.getByRole("link", { name: /^Today/u }).click();
  await expect(page).toHaveURL(/\/today$/u);
  await today.getByRole("button", { name: /^(?:Start session|Continue)/u }).click();
  await expect(page).toHaveURL(new RegExp(`/challenge/${boss.id}\\?session=`, "u"));
  await expect(page.getByRole("button", { exact: true, name: "Start" })).toBeEnabled();

  await expect(
    page.getByRole("status").filter({ hasText: STUDY_TIME_USED_UP.tomorrow }),
  ).toHaveCount(0);

  await page.context().close();
});
