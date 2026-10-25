import { type Browser, type Page } from "@playwright/test";
import { ONBOARDING_QUESTIONS } from "@zoonk/core/view-models/onboarding/contract";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { goalWithBasesFixture } from "@zoonk/testing/fixtures/plan-bases";
import { expect } from "./fixtures";
import { openAs } from "./study-day";

/** Every onboarding screen before the plan, so the goal has its Plan. */
const ALL_ANSWERED = [...ONBOARDING_QUESTIONS, "buddy", "placement"];

/**
 * Starting the day Today shows (a POST) lays out the plan the goal's run handed over. The tap moves
 * to the session before its POST answers; the day's session commits with the plan, so it's there
 * once the plan is.
 */
async function startTodaysDay({ goalId, page }: { goalId: string; page: Page }) {
  await page.goto("/today");

  await page
    .getByRole("region", { name: "Today's session" })
    .getByRole("button", { name: /^Start/u })
    .click();

  await expect.poll(() => prisma.studySession.count({ where: { goalId } })).toBe(1);
}

/**
 * A learner whose small plan builds on bases (see `goalWithBasesFixture`), with it as their active
 * goal, who started their day, on the Plan. At its 15 minutes a day the plan doesn't reach every
 * topic by its date, and planning it again takes a moment, unlike a seeded persona's.
 */
export async function openLearnerWithBases(
  browser: Browser,
  {
    days,
    kind,
    subjectPerTopic,
    viewport,
  }: {
    days: number;
    kind: "exam" | "learn";
    subjectPerTopic?: boolean;
    viewport?: { height: number; width: number };
  },
) {
  const user = await createE2EUser(getBaseURL());

  const fixture = await goalWithBasesFixture({
    days,
    details: { answered: ALL_ANSWERED },
    kind,
    subjectPerTopic,
    userId: user.id,
  });

  await learningProfileFixture({ activeGoalId: fixture.goal.id, userId: user.id });

  const page = await openAs(browser, user);

  if (viewport) {
    await page.setViewportSize(viewport);
  }

  await startTodaysDay({ goalId: fixture.goal.id, page });
  await page.goto("/plan");
  await expect(page.getByRole("heading", { level: 1, name: "Plan" })).toBeVisible();

  return { ...fixture, page };
}
