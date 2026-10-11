import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
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
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { isJsonObject } from "@zoonk/utils/json";
import { expect, test } from "./fixtures";
import { type StreamEvent, followRun } from "./generation-run";
import { tabTo } from "./keyboard-focus";
import { asPersona } from "./learn-personas";
import {
  DAYS_TO_EXAM,
  LESSON_CAN_DO,
  LESSON_TITLE,
  carryLessons,
  createStudyDay,
  openAs,
  writeStudyLesson,
} from "./study-day";

/** Today reads itself again every 5 seconds while a lesson is being written. */
const WRITING_REFRESH_MS = 5000;

/** The welcome back says how long the lighter day takes: "lighter" beside 12 activities said nothing. */
const WELCOME_BACK = /^Welcome back! Today is lighter, about .+, so it's easy to pick up again\.$/u;
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
    await expect(page).not.toHaveURL(/\/today$/u, { timeout: SLOW_OPEN_MS + 10_000 });

    await page.context().close();
  });

  // Ana back after four days had a lighter day and no greeting: the buddy's suggestion took the
  // one notice. The welcome back is the session's own line, so a notice never hides it.
  test("greets a learner back beside a plan change waiting for an OK, until they start", async ({
    browser,
  }) => {
    const { goal, user } = await createStudyDay({ freshStart: "welcomeBack" });
    await proposeRebalance(goal.id);
    const page = await openAs(browser, user);
    await page.goto("/today");

    const note = page.getByRole("region", { name: "Suggested change" });
    const card = page.getByRole("region", { name: "Today's session" });
    await expect(note).toContainText("More time for Science, where it's needed most.");
    await expect(card.getByText(WELCOME_BACK)).toBeVisible();

    // Answering keeps Today calm: the note says what the answer did and no other notice jumps in.
    await note.getByRole("button", { name: "Not now" }).click();
    await expect(note.getByRole("status")).toHaveText("Your plan stays as it was.");
    await expect(note.getByRole("button")).toHaveCount(0);
    await expect(card.getByText(WELCOME_BACK)).toBeVisible();

    // Once the day is underway, the greeting has done its job.
    await card.getByRole("button", { name: /^Start/u }).click();
    await expect(page).not.toHaveURL(/\/today$/u);
    await page.goto("/today");
    await expect(card.getByRole("button", { name: /^Continue/u })).toBeVisible();
    await expect(page.getByText(WELCOME_BACK)).toHaveCount(0);

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

const CATCH_UP_BUTTON = /^Catch up today/u;

/** The weekday of today where the learner lives, as plans count weekdays (Sunday first). */
function getWeekdayIn(timeZone: string): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(new Date());
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

test.describe("Today after days away", () => {
  // Rafaela set up her goal, never studied and came back days later: no welcome back, an orange
  // "127 lessons to catch up", a 2-hour day and "Catch up today · +381 min".
  test("welcomes back a learner who set up the goal and never studied, without pushing the backlog", async ({
    browser,
  }) => {
    await asPersona(browser, { away: 6, day: 7, persona: "exam" }, async ({ page }) => {
      await page.goto("/today");

      const card = page.getByRole("region", { name: "Today's session" });
      await expect(card.getByText(WELCOME_BACK)).toBeVisible();
      await expect(card.getByRole("button", { name: /^Start/u })).toBeVisible();

      // The day is just the next lessons, with no backlog above the greeting ("377 lessons to
      // catch up" read as a debt to clear).
      await expect(page.getByRole("main").getByText(/to catch up/u)).toHaveCount(0);
      await expect(card.getByText(/Catching up/u)).toHaveCount(0);
      await expect(card.getByRole("button", { name: CATCH_UP_BUTTON })).toHaveCount(0);
      await expectAccessibleScreen(page, "Today after days away");

      // The Journey still says honestly what those days left.
      await page.goto("/journey");
      await expect(page.getByRole("main").getByText(/\d+ lessons? to catch up/u)).toBeVisible();
    });
  });

  // Rafaela back after a month read "You're behind", three percentages and a wall of topics
  // before her greeting, with "Study 4h a day" as the main action.
  test("greets a learner back before falling behind's card, which says it in one sentence and asks for no more hours first", async ({
    browser,
  }) => {
    const { goal, user } = await createStudyDay({ freshStart: "welcomeBack" });
    const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });

    await planChangeFixture({
      kind: "missedDays",
      payload: {
        behind: {
          canFocus: true,
          coveredAfter: 0.39,
          coveredBefore: 0.48,
          currentMinutes: 120,
          dailyMinutes: 240,
          fittingDate: null,
          fullDepth: false,
          maximumShare: 0.54,
          measure: "exam",
        },
        days: 30,
        effect: {
          endDateAfter: null,
          endDateBefore: null,
          lessonsAdded: 0,
          lessonsRemoved: 40,
          topicsLeftOut: [
            {
              area: "Portuguese",
              topics: ["Semantic categories", "Word meanings", "Logic basics", "Syntax", "Style"],
            },
          ],
        },
        source: "system",
      },
      planId: plan.id,
      reason: "Lessons earlier days left come first; the rest of the plan moved forward.",
      status: "applied",
    });

    const page = await openAs(browser, user);
    await page.goto("/today");

    const card = page.getByRole("region", { name: "Today's session" });
    const note = page.getByRole("region", { name: "Plan change" });

    await expect(card.getByText(WELCOME_BACK)).toBeVisible();

    await expect(
      note.getByText("At 2h a day, your plan now covers 39% of the exam, down from 48%."),
    ).toBeVisible();

    await expect(
      note.getByText(
        "Semantic categories, Word meanings and 3 more topics no longer fit by your date.",
      ),
    ).toBeVisible();

    // The greeting and the lighter day come first; the card waits under them.
    const [cardBox, noteBox] = await Promise.all([card.boundingBox(), note.boundingBox()]);
    expect(cardBox?.y ?? Infinity).toBeLessThan(noteBox?.y ?? 0);

    // Each choice says what it buys, and more hours isn't the main action on the day she's back.
    await expect(note.locator("a, button")).toHaveText([
      "Choose where to focus",
      "Keep my time",
      "Study 4h a day · about 54%",
      "Study everything",
    ]);

    await expect(note.getByRole("button", { name: "Study 4h a day · about 54%" })).toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)",
    );

    await page.context().close();
  });

  // Rafaela back after 30 days on her rest day saw only "Enjoy your day off!".
  test("keeps a rest day after days away, says hello and still offers some study", async ({
    browser,
  }) => {
    await asPersona(browser, { away: 4, persona: "exam" }, async ({ page, user }) => {
      const plan = await prisma.plan.findUniqueOrThrow({
        include: { goal: true },
        where: { goalId: user.goalId },
      });

      // Today is a rest day in her plan.
      const weekdayMinutes = Array.from({ length: DAYS_PER_WEEK }, (_, weekday) =>
        weekday === getWeekdayIn(user.timeZone) ? 0 : plan.goal.dailyMinutes,
      );

      await prisma.plan.update({
        data: {
          settings: { ...(isJsonObject(plan.settings) ? plan.settings : {}), weekdayMinutes },
        },
        where: { id: plan.id },
      });

      await page.goto("/today");

      const card = page.getByRole("region", { name: "Today's session" });
      await expect(card.getByRole("heading", { name: "No study planned today" })).toBeVisible();

      await expect(
        card.getByText("Welcome back! Today is a rest day in your plan, so enjoy it."),
      ).toBeVisible();

      // Nothing studied yet today: "more" would count study she hasn't done.
      await expect(card.getByRole("button", { name: /^Study for \d+ minutes$/u })).toBeVisible();
    });
  });

  test("offers catching up today only when it fits in about one more day", async ({ browser }) => {
    const [few, many] = await Promise.all([createStudyDay(), createStudyDay()]);

    await Promise.all([
      carryLessons({ count: 2, goalId: few.goal.id }),
      carryLessons({ count: 6, goalId: many.goal.id }),
    ]);

    // Two lessons of 3 minutes take less than her 10-minute day: one tap adds them.
    const page = await openAs(browser, few.user);
    await page.goto("/today");

    const card = page.getByRole("region", { name: "Today's session" });
    await expect(card.getByText("2 more lessons to catch up come first tomorrow.")).toBeVisible();
    await card.getByRole("button", { name: "Catch up today · +6 min" }).click();
    await expect(card.getByText("See today's 5 activities")).toBeVisible();
    await expect(card.getByRole("button", { name: CATCH_UP_BUTTON })).toHaveCount(0);

    // Six take 18 minutes, nearly two of his days: the next days take them, with no button.
    const other = await openAs(browser, many.user);
    await other.goto("/today");

    const otherCard = other.getByRole("region", { name: "Today's session" });

    await expect(
      otherCard.getByText("Your next days start with the 6 lessons left to catch up."),
    ).toBeVisible();

    await expect(otherCard.getByRole("button", { name: CATCH_UP_BUTTON })).toHaveCount(0);

    await Promise.all([page.context().close(), other.context().close()]);
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

  test("says a review of the weakest topics isn't one that's due", async ({ browser }) => {
    const { session, user } = await createStudyDay();

    const review = await prisma.studySessionBlock.findFirstOrThrow({
      where: { kind: "review", sessionId: session.id },
    });

    // Nothing was due and nothing else filled the day: the builder reviewed the weakest topics.
    await prisma.studySessionBlock.update({
      data: { payload: { ...(isJsonObject(review.payload) ? review.payload : {}), weakest: true } },
      where: { id: review.id },
    });

    const page = await openAs(browser, user);
    await page.goto("/today");

    const card = page.getByRole("region", { name: "Today's session" });
    await expect(card.getByRole("heading", { name: "Quick review" })).toBeVisible();

    await expect(
      card.getByText(/^No reviews due today · \d+ questions? on your weakest topics$/u),
    ).toBeVisible();

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

/**
 * A learner whose day holds one written lesson and time for a skill whose course is still being
 * outlined (a stand-in due today), as Carla's first day did.
 */
async function createDayWithLessonsComing() {
  const [user, course] = await Promise.all([
    createE2EUser(getBaseURL()),
    courseFixture({ outlineStatus: "running" }),
  ]);

  const goal = await goalFixture({
    dailyMinutes: 10,
    primaryCourseId: course.id,
    timezone: "UTC",
    userId: user.id,
  });

  const [plan, played, later, skill, session] = await Promise.all([
    planFixture({ goalId: goal.id }),
    playableLessonFixture({ lesson: { canDo: LESSON_CAN_DO, title: LESSON_TITLE } }),
    playableLessonFixture({ lesson: { title: "Fractions on a number line" } }),
    skillFixture({ name: "Fractions" }),
    studySessionFixture({ goalId: goal.id, plannedMinutes: 3, userId: user.id }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  const [, standIn] = await Promise.all([
    studySessionBlockFixture({
      canDo: LESSON_CAN_DO,
      estimatedMinutes: 3,
      kind: "learn",
      lessonId: played.lesson.id,
      payload: { skillIds: [], title: LESSON_TITLE },
      position: 0,
      sessionId: session.id,
    }),
    // The rest of the day stands in for a skill its course is still outlining.
    planItemFixture({
      kind: "lesson",
      planId: plan.id,
      scheduledFor: toUTCMidnight(new Date()),
      skillId: skill.id,
      titleSnapshot: "Fractions",
    }),
  ]);

  return { course, later, session, skill, standIn, user };
}

/** The narrowest phone the app is laid out for. */
const NARROW_PHONE_WIDTH = 320;

/** A section title's height on two lines (20px type on a 28px line). */
const TWO_TITLE_LINES = 56;

test.describe("Today while some of its lessons are still being outlined", () => {
  // Carla's Today said 7 lessons and her session opened with 15: the rest landed in between,
  // unannounced. The day says more are coming, keeps what it showed and adds them at its end.
  test("says more lessons come as the learner goes, then adds them after what it showed", async ({
    browser,
  }) => {
    const { course, later, session, skill, standIn, user } = await createDayWithLessonsComing();
    const page = await openAs(browser, user);
    await page.setViewportSize({ height: 844, width: NARROW_PHONE_WIDTH });
    await page.clock.install();
    await page.goto("/today");

    const card = page.getByRole("region", { name: "Today's session" });
    const coming = card.getByText("1 lesson so far · more as you go");
    await expect(coming).toBeVisible();
    await expect(card.getByText(LESSON_TITLE).first()).toBeVisible();

    // On a narrow phone the line goes under the title instead of squeezing it to a word a line.
    const [title, line] = await Promise.all([
      card.getByRole("heading", { name: "Today's session" }).boundingBox(),
      coming.boundingBox(),
    ]);

    expect(title?.height).toBeLessThan(TWO_TITLE_LINES);
    expect(line?.y).toBeGreaterThanOrEqual((title?.y ?? 0) + (title?.height ?? 0));
    expect((line?.x ?? 0) + (line?.width ?? 0)).toBeLessThanOrEqual(NARROW_PHONE_WIDTH);

    // The outline lands and its lesson joins the end of the day: Today reads itself again.
    await Promise.all([
      prisma.course.update({ data: { outlineStatus: "completed" }, where: { id: course.id } }),
      prisma.planItem.update({ data: { lessonId: later.lesson.id }, where: { id: standIn.id } }),
      studySessionBlockFixture({
        estimatedMinutes: 3,
        kind: "learn",
        lessonId: later.lesson.id,
        payload: { skillIds: [skill.id], title: "Fractions on a number line" },
        position: 1,
        sessionId: session.id,
      }),
    ]);

    await page.clock.fastForward(WRITING_REFRESH_MS);
    await expect(card.getByText("2 lessons", { exact: true })).toBeVisible();
    await expect(card.getByText(/more as you go/u)).toHaveCount(0);
    await expect(card.getByText(LESSON_TITLE).first()).toBeVisible();
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

  // A session never shows more than Today said without saying so.
  test("says on the session's next stop that more lessons come as the learner goes", async ({
    browser,
  }) => {
    const { user } = await createDayWithLessonsComing();
    const page = await openAs(browser, user);

    await page.goto("/session");

    await expect(page.getByText("0 of 1 done · more as you go")).toBeVisible();
    await expect(page.getByText(LESSON_TITLE).first()).toBeVisible();
    await page.context().close();
  });
});
