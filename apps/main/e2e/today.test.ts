import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import {
  goalFixture,
  planChangeFixture,
  planFixture,
  planItemFixture,
  suggestedGoalFixture,
} from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";
import { type StreamEvent, followRun } from "./generation-run";
import { tabTo } from "./keyboard-focus";
import {
  DAYS_TO_EXAM,
  LESSON_CAN_DO,
  LESSON_TITLE,
  createStudyDay,
  openAs,
  writeStudyLesson,
} from "./study-day";

/** Today reads itself again every 5 seconds while a lesson is being written. */
const WRITING_REFRESH_MS = 5000;

const WELCOME_BACK = "Welcome back! Today is a lighter session, so it's easy to pick up again.";
const DAYS_PER_WEEK = 7;

async function readGoalStatus(goalId: string) {
  const goal = await prisma.goal.findUnique({ where: { id: goalId } });
  return goal?.status;
}

/** A time change from the last session that waits for the learner's OK. */
async function proposeRebalance(goalId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId } });

  return planChangeFixture({
    kind: "edited",
    payload: {
      before: { goal: { dailyMinutes: 10, targetDate: null }, graph: {}, settings: {} },
      operations: [{ areas: ["Science"], kind: "focusAreas" }],
      source: "preparation",
      versionAfter: plan.version,
    },
    planId: plan.id,
    reason: "Moved time to the area that needs it most.",
    status: "proposed",
  });
}

/** The week's challenge on this week's Sunday (today, on a Sunday), so the week row flags it. */
async function addWeeklyChallenge(goalId: string) {
  const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId } });
  const today = toUTCMidnight(new Date());
  const daysToSunday = (DAYS_PER_WEEK - today.getUTCDay()) % DAYS_PER_WEEK;

  return planItemFixture({
    kind: "checkpoint",
    planId: plan.id,
    scheduledFor: new Date(today.getTime() + daysToSunday * MS_PER_DAY),
    titleSnapshot: "Weekly challenge",
  });
}

/** Long enough for Start to say it's on its way (it does after 1.5 s), short enough to finish. */
const SLOW_OPEN_MS = 4000;

test.describe("Today", () => {
  test("names the first week's placement questions for what they are, not a review", async ({
    browser,
  }) => {
    const { goal, user } = await createStudyDay();

    // The warm-up of the first week's sessions: only placement's questions, no capsule to review.
    const review = await prisma.studySessionBlock.findFirstOrThrow({
      where: { kind: "review", session: { goalId: goal.id } },
    });

    const payload = review.payload as { capsules: { itemIds: string[] }[] };

    await prisma.studySessionBlock.update({
      data: {
        payload: {
          capsules: [],
          placementItemIds: payload.capsules[0]?.itemIds ?? [],
          skillIds: [],
        },
      },
      where: { id: review.id },
    });

    const page = await openAs(browser, user);
    await page.goto("/today");

    const card = page.getByRole("region", { name: "Today's session" });
    await expect(card.getByRole("heading", { name: "What you already know" })).toBeVisible();
    await expect(card.getByText("Quick review")).toHaveCount(0);
  });

  test("shows the countdown, the next block with one Start, one notice and the week", async ({
    browser,
  }) => {
    const { goal, user } = await createStudyDay({ freshStart: "welcomeBack" });
    await suggestedGoalFixture({ title: "Spanish", userId: user.id });
    const page = await openAs(browser, user);
    await page.goto("/today");

    // The tab names itself; the days left and the plan's pace are its supporting line.
    await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
    await expect(page.getByRole("main").getByText(`${DAYS_TO_EXAM} days left`)).toBeVisible();

    // How prepared the learner is lives in the Journey; Today says where the plan stands.
    await expect(page.getByText(/preparation/u)).toHaveCount(0);

    // The card leads with the next block and one Start; the blocks after it are in sight under
    // it, each with its minutes. No minutes line of its own.
    const card = page.getByRole("region", { name: "Today's session" });
    await expect(card.getByText(/^\d+ of \d+ min$/u)).toHaveCount(0);
    await expect(card.getByRole("heading", { name: "Quick review" })).toBeVisible();
    await expect(card.getByRole("button", { name: /^Start/u })).toBeVisible();

    await expect(card.getByRole("list").getByRole("listitem")).toHaveText([
      /^Discounts/u,
      /^Mixed/u,
    ]);

    // With the whole day in sight, there's nothing more to open.
    await expect(card.getByRole("button", { name: /^See today's/u })).toHaveCount(0);

    // One notice at a time: the welcome back explains the lighter day; the course from before
    // goals waits for a day with nothing else to say.
    await expect(page.getByText(WELCOME_BACK)).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Suggested goal" })).toHaveCount(0);

    // The missions live on the buddy's tab and in the summary, not on Today.
    await expect(page.getByText(/Missions/u)).toHaveCount(0);

    // A new goal's week never opens with missed days, nor with rest days nobody chose: the days
    // before it existed are before the plan, and the days still ahead are planned.
    const week = page.getByRole("region", { name: "This week" });
    const todayIndex = (toUTCMidnight(new Date()).getUTCDay() + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK;
    await expect(week.getByRole("listitem").nth(todayIndex)).toContainText("today");
    await expect(week.getByText(/not studied/u)).toHaveCount(0);
    await expect(week.getByText(/rest day/u)).toHaveCount(0);
    await expect(week.getByText(/before your plan/u)).toHaveCount(todayIndex);

    await expect(week.getByText(/planned/u)).toHaveCount(DAYS_PER_WEEK - 1 - todayIndex);
    await expectAccessibleScreen(page, "Today");

    // The challenge's day carries a flag that opens its intro, before its day too, and it says
    // what the day is once: the challenge, not "planned" as well.
    const item = await addWeeklyChallenge(goal.id);
    await page.reload();

    // Under the days, by name: the challenge, its day and its size, opening its intro.
    const challenge = week.getByRole("link", {
      name: /^Weekly challenge\s*Sunday · 10 questions/u,
    });

    await expect(challenge).toHaveAttribute("href", `/challenge/${item.id}`);

    const sundayAhead = todayIndex < DAYS_PER_WEEK - 1;

    await expect(week.getByText(/planned/u)).toHaveCount(
      DAYS_PER_WEEK - 1 - todayIndex - Number(sundayAhead),
    );

    await page.context().close();
  });

  test("offers the next lesson's chapter test from the start, and leaving it comes back to Today", async ({
    browser,
  }) => {
    const { goal, lesson, session, user } = await createStudyDay({ reviewDone: true });
    const chapter = await libraryChapterFixture({ title: `Discounts ${randomUUID().slice(0, 6)}` });

    // The day's lesson is planned in a chapter, as every plan's lessons are.
    await Promise.all([
      prisma.planItem.updateMany({
        data: { chapterId: chapter.id },
        where: { lessonId: lesson.id, plan: { goalId: goal.id } },
      }),
      prisma.studySessionBlock
        .findFirstOrThrow({ where: { lessonId: lesson.id, sessionId: session.id } })
        .then((block) =>
          prisma.studySessionBlock.update({
            data: { payload: { ...(block.payload as object), chapterId: chapter.id } },
            where: { id: block.id },
          }),
        ),
    ]);

    const page = await openAs(browser, user);

    await page.route("**/v1/goals/*/chapters/*/test-out/generations", (route) =>
      route.fulfill({ json: { generationId: null, status: "ready" }, status: 200 }),
    );

    await page.goto("/today");

    const card = page.getByRole("region", { name: "Today's session" });
    await expect(card.getByRole("heading", { name: LESSON_TITLE })).toBeVisible();
    await expect(card.getByText("Already know this?")).toBeVisible();
    await card.getByRole("button", { name: "Take the test" }).click();

    await expect(page).toHaveURL(new RegExp(`/test-out/${chapter.id}\\?session=1$`, "u"));
    await expect(page.getByRole("link", { name: "Close" })).toHaveAttribute("href", /\/today$/u);

    // Back on Today, the test is offered again instead of still opening.
    await page.goBack();
    await expect(card.getByRole("button", { name: "Take the test" })).toBeEnabled();
    await expect(card.getByText("Opening the test…")).toHaveCount(0);
    await page.context().close();
  });

  test("says a slow Start is on its way instead of just greying it out", async ({ browser }) => {
    const { user } = await createStudyDay();
    const page = await openAs(browser, user);
    await page.goto("/today");

    const card = page.getByRole("region", { name: "Today's session" });
    const start = card.getByRole("button", { name: /^Start/u });
    await expect(start).toBeVisible();

    // The server takes a few seconds to open the next step.
    await page.route("**/today", async (route) => {
      if (route.request().method() === "POST") {
        await new Promise((resolve) => {
          setTimeout(resolve, SLOW_OPEN_MS);
        });
      }

      await route.continue();
    });

    await start.click();
    await expect(card.getByRole("status")).toHaveText("Opening your next step…");
    await expect(page).not.toHaveURL(/\/today$/u);

    await page.context().close();
  });

  test("puts a plan change waiting for an OK before the welcome back", async ({ browser }) => {
    const { goal, user } = await createStudyDay({ freshStart: "welcomeBack" });
    await proposeRebalance(goal.id);
    const page = await openAs(browser, user);
    await page.goto("/today");

    const note = page.getByRole("region", { name: "Suggested change" });
    await expect(note).toContainText("More time for Science, where it's needed most.");
    await expect(page.getByText(WELCOME_BACK)).toBeHidden();

    // Answering keeps Today calm: the note says what the answer did and no other notice jumps in.
    await note.getByRole("button", { name: "Not now" }).click();
    await expect(note.getByRole("status")).toHaveText("Your plan stays as it was.");
    await expect(note.getByRole("button")).toHaveCount(0);
    await expect(page.getByText(WELCOME_BACK)).toBeHidden();

    await page.context().close();
  });

  test("offers a course from before goals when nothing else needs saying", async ({ browser }) => {
    const { user } = await createStudyDay();
    await suggestedGoalFixture({ title: "Spanish", userId: user.id });
    const page = await openAs(browser, user);
    await page.goto("/today");

    const suggestion = page.getByRole("complementary", { name: "Suggested goal" });
    await expect(suggestion.getByText("Continue Spanish?")).toBeVisible();
    await expect(suggestion.getByText("Build a plan in 1 minute.")).toBeVisible();

    await suggestion.getByRole("button", { name: "Not now" }).click();
    await expect(suggestion).toBeHidden();
    await expect(page.getByRole("region", { name: "Today's session" })).toBeVisible();
    await page.context().close();
  });

  test("puts the guardian invite away for good after Not now", async ({ browser }) => {
    const { goal, user } = await createStudyDay();
    const signedUpAt = new Date(Date.now() - 60 * 60 * 1000);

    // A teen who planned the goal as a guest, then made an account an hour ago.
    await Promise.all([
      prisma.user.update({ data: { createdAt: signedUpAt }, where: { id: user.id } }),
      prisma.goal.update({
        data: { createdAt: new Date(signedUpAt.getTime() - MS_PER_DAY) },
        where: { id: goal.id },
      }),
      prisma.userLearningProfile.update({
        data: { birthMonth: 1, birthYear: new Date().getUTCFullYear() - 15 },
        where: { userId: user.id },
      }),
    ]);

    const page = await openAs(browser, user);
    await page.goto("/today");

    const invite = page.getByRole("complementary", { name: "Invite a parent or guardian" });
    await invite.getByRole("button", { name: "Not now" }).click();
    await expect(invite).toBeHidden();

    await expect
      .poll(async () => {
        const profile = await prisma.userLearningProfile.findUnique({ where: { userId: user.id } });
        return profile?.guardianInviteDismissedAt ?? null;
      })
      .not.toBeNull();

    await page.reload();
    await expect(page.getByRole("region", { name: "Today's session" })).toBeVisible();
    await expect(invite).toBeHidden();
    await page.context().close();
  });

  test("keeps a long day short: the next block, with the whole day one tap away", async ({
    browser,
  }) => {
    const { session, user } = await createStudyDay();

    // A re-planned day full of short lessons: the review and the lesson are done.
    await Promise.all([
      prisma.studySessionBlock.updateMany({
        data: { status: "completed" },
        where: { position: { in: [0, 1] }, sessionId: session.id },
      }),
      ...[1, 2, 3, 4, 5].map((number) =>
        studySessionBlockFixture({
          canDo: `You'll practice part ${number}`,
          estimatedMinutes: 3,
          kind: "learn",
          payload: { skillIds: [], title: `Short lesson ${number}` },
          position: 2 + number,
          sessionId: session.id,
        }),
      ),
    ]);

    const page = await openAs(browser, user);
    await page.goto("/today");

    // What's done is the bar's progress; what's next is the one block on the card, and the next
    // few after it are in sight under it. A day of reviews, practice and lessons isn't "8 lessons".
    const card = page.getByRole("region", { name: "Today's session" });
    await expect(card.getByText("8 activities", { exact: true })).toBeVisible();
    await expect(card.getByRole("heading", { name: "Mixed practice" })).toBeVisible();
    await expect(card.getByText("Quick review")).toBeHidden();
    await expect(card.getByRole("button", { name: /^Continue/u })).toBeVisible();

    await expect(card.getByRole("list").getByRole("listitem")).toHaveText([
      /^Short lesson 1/u,
      /^Short lesson 2/u,
      /^Short lesson 3/u,
    ]);

    // From the keyboard too: the last row opens the whole day in place, done blocks checked.
    await tabTo(page, card.getByRole("button", { name: /^See today's \d+ activities/u }));
    await page.keyboard.press("Enter");

    const day = card.getByRole("list").getByRole("listitem");
    await expect(day).toHaveCount(8);
    await expect(day.first()).toHaveText(/^Quick review, done/u);
    await expect(day.nth(2)).toHaveAttribute("aria-current", "step");
    await expect(day.last()).toContainText("Short lesson 5");

    await page.keyboard.press("Enter");
    await expect(card.getByText("Short lesson 5")).toBeHidden();
    await expect(page).toHaveURL(/\/today$/u);
    await page.context().close();
  });

  test("ends the day with the buddy cheering, what changed and 10 more minutes", async ({
    browser,
  }) => {
    const { session, user } = await createStudyDay({ buddy: true });

    // The review and the practice are done; the lesson was left for later, so time is left.
    await Promise.all([
      prisma.studySessionBlock.updateMany({
        data: { status: "completed" },
        where: { kind: { in: ["review", "practice"] }, sessionId: session.id },
      }),
      prisma.studySessionBlock.updateMany({
        data: { status: "skipped" },
        where: { kind: "learn", sessionId: session.id },
      }),
    ]);

    const page = await openAs(browser, user);
    await page.goto("/today");

    const card = page.getByRole("region", { name: "Today's session" });
    await expect(card.getByRole("heading", { name: "Today's session is complete" })).toBeVisible();
    await expect(card.locator("[data-slot=buddy]")).toHaveAttribute("data-buddy", "zu");
    await expect(card.getByRole("button", { name: /^Study \d+ more minutes$/u })).toBeVisible();
    await expectAccessibleScreen(page, "Today once the day is done");

    // Enter opens what changed, the day's one next step.
    await expect(card.getByRole("link", { name: /^See what changed/u })).toHaveAttribute(
      "href",
      "/session",
    );

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/session$/u);
    await page.context().close();
  });
});

test.describe("Today without a session to start", () => {
  test("says the lessons are on their way, then shows them without a refresh", async ({
    browser,
  }) => {
    const user = await createE2EUser(getBaseURL());
    const goal = await goalFixture({ dailyMinutes: 10, timezone: "UTC", userId: user.id });

    const [plan, played, session] = await Promise.all([
      planFixture({ goalId: goal.id }),
      playableLessonFixture({ lesson: { canDo: LESSON_CAN_DO, title: LESSON_TITLE } }),
      studySessionFixture({ goalId: goal.id, plannedMinutes: 0, userId: user.id }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ]);

    // The day's lessons stand in for a skill the Library is still outlining.
    await planItemFixture({ kind: "lesson", planId: plan.id, titleSnapshot: "Fractions" });

    const page = await openAs(browser, user);
    await page.clock.install();
    await page.goto("/today");

    const card = page.getByRole("region", { name: "Today's session" });

    await expect(
      card.getByRole("heading", { name: "Getting today's lessons ready…" }),
    ).toBeVisible();

    await expect(card.getByText("Today's session is complete")).toHaveCount(0);
    await expect(card.getByRole("link", { name: /See what changed/u })).toHaveCount(0);

    // The lessons land (as a re-plan rebuilds the day): Today reads itself again and shows them.
    await studySessionBlockFixture({
      canDo: LESSON_CAN_DO,
      estimatedMinutes: 3,
      kind: "learn",
      lessonId: played.lesson.id,
      payload: { skillIds: [], title: LESSON_TITLE },
      position: 0,
      sessionId: session.id,
    });

    await page.clock.fastForward(WRITING_REFRESH_MS);
    await expect(card.getByText(LESSON_TITLE)).toBeVisible();
    await expect(card.getByRole("button", { name: /^Start/u })).toBeVisible();
    await page.context().close();
  });

  test("says when a day has no study planned", async ({ browser }) => {
    const user = await createE2EUser(getBaseURL());
    const goal = await goalFixture({ timezone: "UTC", userId: user.id });

    const [plan] = await Promise.all([
      planFixture({
        goalId: goal.id,
        settings: { weekdayMinutes: Array.from({ length: DAYS_PER_WEEK }, () => 0) },
      }),
      studySessionFixture({ goalId: goal.id, plannedMinutes: 0, userId: user.id }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ]);

    await planItemFixture({ kind: "lesson", planId: plan.id });

    const page = await openAs(browser, user);
    await page.goto("/today");

    const card = page.getByRole("region", { name: "Today's session" });
    await expect(card.getByRole("heading", { name: "No study planned today" })).toBeVisible();
    await expect(card.getByText("Enjoy your day off!")).toBeVisible();
    await expect(card.getByText(/Getting today's lessons ready/u)).toHaveCount(0);
    await page.context().close();
  });

  test("says when the plan has nothing new for the day, and offers what's still useful", async ({
    browser,
  }) => {
    const user = await createE2EUser(getBaseURL());
    const goal = await goalFixture({ dailyMinutes: 30, timezone: "UTC", userId: user.id });

    const [plan] = await Promise.all([
      planFixture({ goalId: goal.id }),
      studySessionFixture({ goalId: goal.id, plannedMinutes: 0, userId: user.id }),
      learningProfileFixture({
        activeGoalId: goal.id,
        buddyKind: "zu",
        buddyName: null,
        userId: user.id,
      }),
    ]);

    // Placement or a test-out showed the learner knows every lesson of the plan.
    await planItemFixture({ kind: "lesson", planId: plan.id, status: "testedOut" });
    const challenge = await addWeeklyChallenge(goal.id);

    const page = await openAs(browser, user);
    await page.goto("/today");

    const card = page.getByRole("region", { name: "Today's session" });
    await expect(card.getByRole("heading", { name: "Nothing new for today" })).toBeVisible();
    await expect(card.getByText(/Getting today's lessons ready/u)).toHaveCount(0);
    await expect(card.getByText("Today's session is complete")).toHaveCount(0);

    if (challenge.scheduledFor && challenge.scheduledFor >= toUTCMidnight(new Date())) {
      await expect(card.getByRole("link", { name: /^See .+ challenge$/u })).toHaveAttribute(
        "href",
        `/challenge/${challenge.id}`,
      );
    }

    await expect(card.getByRole("link", { name: "Practice with Zu" })).toHaveAttribute(
      "href",
      "/buddy",
    );

    await page.context().close();
  });

  test("brings a paused goal back with one tap", async ({ browser }) => {
    const user = await createE2EUser(getBaseURL());

    const goal = await goalFixture({
      status: "paused",
      timezone: "UTC",
      title: "Bake sourdough bread",
      userId: user.id,
    });

    const [plan] = await Promise.all([
      planFixture({ goalId: goal.id }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ]);

    await planItemFixture({ kind: "lesson", planId: plan.id });

    const page = await openAs(browser, user);
    await page.goto("/today");

    await expect(
      page.getByRole("heading", { level: 1, name: "Bake sourdough bread is on pause" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Resume" }).click();

    await expect(page.getByRole("region", { name: "Today's session" })).toBeVisible();

    await expect.poll(() => readGoalStatus(goal.id)).toBe("active");

    await page.context().close();
  });

  test("says the free plan follows one goal when another one is active", async ({ browser }) => {
    const user = await createE2EUser(getBaseURL());

    const [paused] = await Promise.all([
      goalFixture({ status: "paused", title: "Bake sourdough bread", userId: user.id }),
      goalFixture({ title: "Learn to cook", userId: user.id }),
    ]);

    await learningProfileFixture({ activeGoalId: paused.id, userId: user.id });

    const page = await openAs(browser, user);
    await page.goto("/today");
    await page.getByRole("button", { name: "Resume" }).click();

    await expect(
      page.getByText(
        "The free plan follows one goal at a time. Pause your other goal to resume this one, or get Plus for more.",
      ),
    ).toHaveRole("alert");

    await page.context().close();
  });
});

test.describe("Today while a lesson is being written", () => {
  test("says so and shows the lesson on its own once it's written", async ({ browser }) => {
    const { lesson, user } = await createStudyDay({ writtenLesson: false });

    // Being written right now, by a run the page doesn't follow.
    await prisma.lesson.update({
      data: { contentRunId: `wrun_${randomUUID()}`, contentStatus: "running" },
      where: { id: lesson.id },
    });

    const page = await openAs(browser, user);
    await page.clock.install();
    await page.goto("/today");

    // The lesson comes after the review: the whole day says it's being written.
    const card = page.getByRole("region", { name: "Today's session" });
    const lessonRow = card.getByRole("listitem").filter({ hasText: LESSON_TITLE });
    await expect(lessonRow.getByText("Being written for you…")).toBeVisible();

    await writeStudyLesson(lesson.id);
    await page.clock.fastForward(WRITING_REFRESH_MS);

    // No refresh: the row drops the note at Today's next read.
    await expect(lessonRow).toBeVisible();
    await expect(lessonRow.getByText("Being written for you…")).toBeHidden();
    await page.context().close();
  });
});

test.describe("Today without a day to show", () => {
  test("sends a learner without a goal to set one", async ({ userWithoutProgress }) => {
    await userWithoutProgress.goto("/today");
    await expect(userWithoutProgress).toHaveURL(/\/start$/u);
  });

  test("welcomes a returning learner back to their last course", async ({ browser }) => {
    const user = await createE2EUser(getBaseURL());
    const suggestion = await suggestedGoalFixture({ title: "Physics", userId: user.id });
    const page = await openAs(browser, user);
    await page.goto("/today");

    await expect(page.getByRole("heading", { level: 1, name: "Welcome back" })).toBeVisible();

    const card = page.getByRole("complementary", { name: "Suggested goal" });
    await expect(card.getByText("Continue Physics?")).toBeVisible();
    await card.getByRole("button", { name: "Build my plan" }).click();

    await expect(page).toHaveURL(/\/start\?goal=Physics$/u);
    await expect(page.getByRole("textbox", { name: "Your goal" })).toHaveValue("Physics");

    await expect
      .poll(async () => {
        const row = await prisma.suggestedGoal.findUnique({ where: { id: suggestion.id } });
        return row?.status;
      })
      .toBe("accepted");

    await page.context().close();
  });

  test("follows the plan being built and opens the day on its own", async ({ browser }) => {
    const user = await createE2EUser(getBaseURL());
    const runId = `e2e-today-${randomUUID()}`;

    const goal = await goalFixture({
      generationRunId: runId,
      timezone: "UTC",
      title: "Quantum physics",
      userId: user.id,
    });

    const [plan, played] = await Promise.all([
      planFixture({ goalId: goal.id }),
      playableLessonFixture(),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ]);

    const events: StreamEvent[] = [
      { entityId: goal.id, status: "started", step: "understandGoal" },
      { entityId: goal.id, status: "started", step: "buildSkillGraph" },
    ];

    const page = await openAs(browser, user);
    await followRun({ events, page, runId });
    await page.goto("/today");

    await expect(
      page.getByRole("heading", { name: "Building your plan for Quantum physics" }),
    ).toBeVisible();

    await expect(
      page.getByRole("progressbar", { name: "Getting your first day ready" }),
    ).toBeVisible();

    const phases = page.getByRole("list", { name: "Getting your first day ready" });
    await expect(phases.getByRole("listitem").nth(0)).toHaveText("Reading your goal, done");

    await expect(phases.getByRole("listitem").nth(1)).toContainText(
      "Mapping the skills it takes, in progress",
    );

    // The run saves the plan: the stream says so and the day opens without a refresh.
    await planItemFixture({
      kind: "lesson",
      lessonId: played.lesson.id,
      planId: plan.id,
      titleSnapshot: "Waves and particles",
    });

    events.push(
      { entityId: goal.id, status: "completed", step: "buildSkillGraph" },
      { entityId: goal.id, status: "started", step: "saveSkills" },
      { entityId: goal.id, status: "completed", step: "createPlan" },
    );

    await expect(page.getByRole("region", { name: "Today's session" })).toBeVisible();
    await page.context().close();
  });

  test("says when building the plan failed and starts it again on a tap", async ({ browser }) => {
    const user = await createE2EUser(getBaseURL());
    const runId = `e2e-today-${randomUUID()}`;

    const goal = await goalFixture({
      generationRunId: runId,
      timezone: "UTC",
      title: "Quantum physics",
      userId: user.id,
    });

    await Promise.all([
      planFixture({ goalId: goal.id }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ]);

    const page = await openAs(browser, user);

    await followRun({
      events: [
        { entityId: goal.id, status: "started", step: "understandGoal" },
        { entityId: goal.id, reason: "aiGenerationFailed", status: "error", step: "workflowError" },
      ],
      page,
      runId,
    });

    await page.goto("/today");

    const failed = page.getByRole("alert").filter({ hasText: "This didn't finish" });
    await expect(failed).toBeVisible();
    await failed.getByRole("button", { name: "Try again" }).click();

    // The tap starts the run again: the wait follows it, or says the start failed with a way out.
    await expect(failed).toBeHidden();

    await expect(
      page
        .getByRole("progressbar", { name: "Getting your first day ready" })
        .or(page.getByRole("alert").filter({ hasText: "This didn't start" })),
    ).toBeVisible();

    await page.context().close();
  });
});
