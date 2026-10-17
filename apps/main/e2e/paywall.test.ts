import { randomUUID } from "node:crypto";
import { getFreePlanLimits } from "@zoonk/core/entitlements/plan-limits";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { createCheckpointLearner } from "./checkpoint-fixtures";
import { expect, test } from "./fixtures";
import { continueToLastStep } from "./result-steps";
import { carryLessons, createStudyDay, openAs, pastFreeWeek } from "./study-day";

const CATCH_UP_BUTTON = /^Catch up today/u;
const EXTRA_TIME_BUTTON = /^Study \d+ more minutes/u;

const FREE_WEEK_OVER_BODY =
  "Reviews and fixing your mistakes stay free. Plus opens new lessons, the rest of your plan and mock exams.";

/**
 * The free plan's paywalls: a learner who started today's new
 * lessons sees when they come back and Plus as a choice, a free exam plan past its first week says
 * so on Today instead of lessons quietly disappearing and holds its new lessons, catch-up, bonus
 * time and challenges for Plus, and a second goal explains the one-goal limit.
 */
test.describe("Paywall", () => {
  test("the daily lesson allowance says when lessons come back and offers Plus", async ({
    browser,
  }) => {
    const [user, { lesson }] = await Promise.all([
      createE2EUser(getBaseURL()),
      playableLessonFixture(),
    ]);

    await Promise.all([
      learningProfileFixture({ userId: user.id }),
      usageRecordsFixture({ count: getFreePlanLimits().lessonsPerDay ?? 0, userId: user.id }),
    ]);

    const page = await openAs(browser, user);
    await page.goto(`/learn/${lesson.id}`);

    await expect(
      page.getByRole("heading", { name: "That's all the new lessons for today" }),
    ).toBeVisible();

    await expect(
      page.getByText(
        "You can still review what you learned and practice your mistakes. New lessons open again tomorrow, or get Plus to keep going now.",
      ),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: "See Plus" })).toHaveAttribute(
      "href",
      "/subscription",
    );

    await page.context().close();
  });

  // rafa3 (Câmara, free, day 12): Today said Plus opens new lessons, yet "Catch up today" added
  // 205 of them, and "10 more minutes" kept adding practice and the plan's next lessons.
  test("a free exam plan past its first week offers Plus on Today, with no catch-up or bonus time", async ({
    browser,
  }) => {
    const { goal, session, user } = await createStudyDay();

    // Two missed lessons: within the free week, "Catch up today · +6 min" adds them to the day.
    await Promise.all([pastFreeWeek(goal.id), carryLessons({ count: 2, goalId: goal.id })]);

    const page = await openAs(browser, user);
    await page.goto("/today");

    const note = page.getByRole("region", { name: "Exam prep on the free plan" });

    await expect(
      note.getByRole("heading", { name: "Your free week of exam prep is over" }),
    ).toBeVisible();

    await expect(note.getByRole("link", { name: "See Plus" })).toHaveAttribute(
      "href",
      "/subscription",
    );

    const card = page.getByRole("region", { name: "Today's session" });

    await expect(card).toBeVisible();
    await expect(card.getByText(/to catch up/u)).toHaveCount(0);

    // Nor does the header count lessons to catch up: only Plus opens them.
    await expect(page.getByText(/\d+ lessons? to catch up/u)).toHaveCount(0);
    await expect(card.getByRole("button", { name: CATCH_UP_BUTTON })).toHaveCount(0);

    // The day's session done: neither its end nor Today offers more time.
    await prisma.studySessionBlock.updateMany({
      data: { status: "completed" },
      where: { sessionId: session.id },
    });

    await page.goto("/session");
    await expect(page.getByRole("heading", { level: 1, name: /^Done in /u })).toBeVisible();
    await continueToLastStep(page);
    await expect(page.getByRole("link", { name: "Finish" })).toBeVisible();
    await expect(page.getByRole("button", { name: EXTRA_TIME_BUTTON })).toHaveCount(0);

    // Nor does it name tomorrow's new lesson, which the free plan no longer opens.
    await expect(page.getByText("Tomorrow", { exact: true })).toHaveCount(0);

    await page.goto("/today");
    await expect(card.getByText("Today's session is complete")).toBeVisible();
    await expect(card.getByRole("button", { name: EXTRA_TIME_BUTTON })).toHaveCount(0);
    await expect(card.getByRole("button", { name: CATCH_UP_BUTTON })).toHaveCount(0);

    await page.context().close();
  });

  // Rafaela's free day past the trial: "Quick review" for a 52-minute review, and "Mixed
  // practice" for a block that only fixed her mistakes.
  test("a free exam plan's day of reviews and mistakes names each block for what it is", async ({
    browser,
  }) => {
    const { goal, session, user } = await createStudyDay();
    await pastFreeWeek(goal.id);

    const skill = await skillFixture();
    const item = await itemFixture({ content: choiceItemContent(), skillId: skill.id });
    const mistake = await mistakeFixture({ itemId: item.id, skillId: skill.id, userId: user.id });

    // The day the free plan builds past its first week: reviews fill its time, and its only
    // practice fixes a mistake.
    await Promise.all([
      prisma.studySessionBlock.deleteMany({ where: { kind: "learn", sessionId: session.id } }),
      prisma.studySessionBlock.updateMany({
        data: { estimatedMinutes: 30 },
        where: { kind: "review", sessionId: session.id },
      }),
      prisma.studySessionBlock.updateMany({
        data: {
          payload: {
            drills: [{ itemIds: [item.id], kind: "retry", mistakeId: mistake.id }],
            skillIds: [skill.id],
          },
        },
        where: { kind: "practice", sessionId: session.id },
      }),
    ]);

    const page = await openAs(browser, user);
    await page.goto("/today");

    const card = page.getByRole("region", { name: "Today's session" });

    await expect(card.getByRole("listitem")).toHaveText([
      /^Reviews.*30\smin$/u,
      /^Practice mistakes.*2\smin$/u,
    ]);

    await expect(card.getByRole("listitem").nth(0)).toHaveAttribute("aria-current", "step");
    await expect(card.getByText(/^(?:Quick review|Mixed practice)$/u)).toHaveCount(0);
    await page.context().close();
  });

  test("a free exam plan past its first week holds its phase challenge for Plus", async ({
    browser,
  }) => {
    const { boss, plan, user } = await createCheckpointLearner();

    await prisma.goal.update({ data: { kind: "exam" }, where: { id: plan.goalId } });
    await pastFreeWeek(plan.goalId);

    const page = await openAs(browser, user);
    await page.goto(`/challenge/${boss.id}`);

    await expect(page.getByText("Your free week of exam prep is over")).toBeVisible();
    await expect(page.getByText(FREE_WEEK_OVER_BODY)).toBeVisible();

    await expect(page.getByRole("link", { name: "See Plus" })).toHaveAttribute(
      "href",
      "/subscription",
    );

    await expect(page.getByRole("button", { name: "Start" })).toHaveCount(0);
    await page.context().close();
  });

  // rafa3 (Câmara, free, day 12): Today said Plus opens new lessons, yet the plan's next lesson
  // opened for her (and an unwritten one was written).
  test("a free exam plan past its first week opens its new lessons with Plus only", async ({
    browser,
  }) => {
    const { goal, lesson, user } = await createStudyDay({ reviewDone: true });
    await pastFreeWeek(goal.id);

    const page = await openAs(browser, user);
    await page.goto(`/learn/${lesson.id}`);

    await expect(
      page.getByRole("heading", { name: "Your free week of exam prep is over" }),
    ).toBeVisible();

    await expect(page.getByText(FREE_WEEK_OVER_BODY)).toBeVisible();

    await expect(page.getByRole("link", { name: "See Plus" })).toHaveAttribute(
      "href",
      "/subscription",
    );

    // Refused before the allowance: the lesson wasn't counted or started.
    await expect(prisma.usageRecord.count({ where: { userId: user.id } })).resolves.toBe(0);
    await expect(prisma.learningEvent.count({ where: { userId: user.id } })).resolves.toBe(0);

    await page.context().close();
  });

  // Pedro learned about the limit only after typing a goal and an AI read, as red text that went
  // away with no way on: now it's said before he types, and again where a goal is refused.
  test("a second goal on the free plan says the one-goal limit up front, with Plus and quick questions open", async ({
    browser,
  }) => {
    const user = await createE2EUser(getBaseURL());
    const goal = `learn quantum physics ${randomUUID().slice(0, 8)}`;

    await Promise.all([
      goalFixture({ status: "active", userId: user.id }),
      goalUnderstandingFixture({
        goal,
        result: {
          followUps: [],
          goals: [
            { kind: "learn", subject: "quantum physics", title: "Understand quantum physics" },
          ],
          route: "goals",
        },
        userId: user.id,
      }),
    ]);

    const page = await openAs(browser, user);
    await page.goto("/start");

    const notice = page.getByRole("main").locator('[data-slot="plus-notice"]');
    await expect(notice.getByText("More goals at once with Plus")).toBeVisible();

    await expect(
      notice.getByText(
        "The free plan follows one goal at a time. To start another, pause your current goal from the menu on your Plan. Quick questions work anytime.",
      ),
    ).toBeVisible();

    await expect(notice.getByRole("link", { name: "See Plus" })).toHaveAttribute(
      "href",
      "/subscription",
    );

    // The box stays open for quick questions, so a goal can still be typed and read.
    await page.getByRole("textbox", { name: "I want to" }).fill(goal);
    await page.getByRole("button", { name: "Build my plan" }).click();
    await page.getByRole("button", { name: "Looks right" }).click();

    // A goal that can't start says so as the same notice, with Plus, never as a passing error.
    const refused = page.getByRole("alert").locator('[data-slot="plus-notice"]');

    await expect(
      refused.getByText(
        "The free plan follows one goal at a time. To start this one, pause your current goal from the menu on your Plan, or get Plus.",
      ),
    ).toBeVisible();

    await expect(refused.getByRole("link", { name: "See Plus" })).toBeVisible();
    await expect(prisma.goal.count({ where: { userId: user.id } })).resolves.toBe(1);
    await page.context().close();
  });
});
