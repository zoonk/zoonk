import { randomUUID } from "node:crypto";
import { type Browser } from "@playwright/test";
import { ONBOARDING_QUESTIONS } from "@zoonk/core/view-models/onboarding/contract";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import {
  goalFixture,
  planChangeFixture,
  planFixture,
  planItemFixture,
  suggestedGoalFixture,
} from "@zoonk/testing/fixtures/goals";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
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
  saveMissions,
  writeStudyLesson,
} from "./study-day";

/** Today reads itself again every 5 seconds while a lesson is being written. */
const WRITING_REFRESH_MS = 5000;

/** The welcome back says how long the lighter day takes: "lighter" beside 12 activities said nothing. */
const WELCOME_BACK = /^Welcome back! Today is lighter, about .+, so it's easy to pick up again\.$/u;
const DAYS_PER_WEEK = 7;

test("keeps a phase challenge waiting for today's lessons while a later lesson can open first", async ({
  browser,
}) => {
  const { lesson, session, user } = await createStudyDay();

  const challenge = await studySessionBlockFixture({
    estimatedMinutes: 5,
    kind: "checkpoint",
    payload: {
      checkpoint: {
        kind: "boss",
        mock: false,
        passMark: 4,
        phase: 1,
        rematch: false,
        timeLimitMinutes: null,
      },
      itemIds: [],
      title: "Percentages",
    },
    position: 3,
    sessionId: session.id,
  });

  const page = await openAs(browser, user);
  await page.goto("/today");
  const card = page.getByRole("region", { name: "Today's session" });
  const row = card.getByRole("listitem").filter({ hasText: "Phase challenge" });
  await expect(row).toContainText("Percentages · after today's lessons");
  await expect(row.getByRole("button")).toHaveCount(0);
  await expect(card.getByRole("button", { exact: true, name: "Phase challenge" })).toHaveCount(0);
  await page.screenshot({ fullPage: true, path: test.info().outputPath("today-wait-desktop.png") });

  // Picking a later learn block remains allowed even while the earlier review is unfinished.
  await card
    .getByRole("button", { exact: true, name: `${LESSON_TITLE}, counts toward a mission` })
    .click();

  await expect(page).toHaveURL(new RegExp(`/learn/${lesson.id}\\?session=`, "u"));
  await expect(page.getByText('What does the electron "cloud" show?')).toBeVisible();

  await expect
    .poll(async () => {
      const block = await prisma.studySessionBlock.findFirstOrThrow({
        where: { kind: "learn", sessionId: session.id },
      });

      return block.status;
    })
    .toBe("active");

  await expect(
    prisma.studySessionBlock.findUniqueOrThrow({ where: { id: challenge.id } }),
  ).resolves.toMatchObject({ startedAt: null, status: "pending" });

  await expect(
    prisma.studySessionBlock.findFirstOrThrow({ where: { kind: "review", sessionId: session.id } }),
  ).resolves.toMatchObject({ startedAt: null, status: "pending" });

  await page.goto("/today");
  await expect(row).toContainText("after today's lessons");
  await expect(row.getByRole("button")).toHaveCount(0);
  await page.setViewportSize({ height: 844, width: 390 });
  await expect(row).toBeVisible();
  await page.screenshot({ fullPage: true, path: test.info().outputPath("today-wait-phone.png") });
  await page.context().close();
});

/** A goal past its onboarding questions: only its plan is left to build. */
const PAST_THE_QUESTIONS = { answered: [...ONBOARDING_QUESTIONS, "buddy", "placement"] };

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
    const placement = card.getByRole("listitem").filter({ hasText: "What you already know" });
    await expect(placement).toHaveAttribute("aria-current", "step");
    await expect(card.getByText("Quick review")).toHaveCount(0);

    const missions = page.getByRole("region", { name: "Today's missions" });
    const reviewMission = missions.getByRole("button", { name: /^Review\b/u });
    await expect(reviewMission).toBeEnabled();

    await reviewMission.click();

    await expect(
      page.getByRole("heading", { level: 1, name: "What you already know" }),
    ).toBeVisible();

    async function answerPlacement(question: string) {
      await expect(
        page.getByRole("heading", { name: new RegExp(`^${question}`, "u") }),
      ).toBeVisible();

      await page.getByRole("button", { name: "I don't know yet" }).click();
      await expect(page.getByRole("region", { name: "Answer feedback" })).toBeVisible();
      await page.keyboard.press("Enter");
    }

    await answerPlacement("Capsule one");
    await answerPlacement("Capsule two");
    await expect(page.getByRole("heading", { exact: true, name: "Review done" })).toBeVisible();

    // The block's moment says which mission it completed and what's left.
    const moment = page.locator("[data-slot=mission-moment]");
    await expect(moment).toContainText("Mission done: Review");
    await expect(moment).toContainText("1 of 2 · Left: Do a new lesson");

    await page.goto("/today");
    await expect(missions).toContainText("Review, done");
    await page.goto("/buddy");

    const buddyMissions = page.getByRole("region", { name: "Today's missions" });

    // Done there too, and no longer something to open.
    await expect(buddyMissions.getByRole("listitem").filter({ hasText: /^Review/u })).toHaveText(
      "Review, done",
    );

    await expect(buddyMissions.getByRole("button", { name: /^Review\b/u })).toHaveCount(0);

    await page.context().close();
  });

  // Ana's next day: "Quick review · 13 min" isn't quick.
  test("opens a mission where it's done: the day's new lesson, even before its review", async ({
    browser,
  }) => {
    const { lesson, user } = await createStudyDay();
    const page = await openAs(browser, user);
    await page.goto("/today");

    const missions = page.getByRole("region", { name: "Today's missions" });

    await missions
      .getByRole("button", { name: /^Do a new lesson\b.*go to today's new lesson\b/u })
      .click();

    await expect(page).toHaveURL(new RegExp(`/learn/${lesson.id}\\?session=`, "u"));
    await page.context().close();
  });

  test("a mission whose block finished on another device doesn't open it again: Today shows it done", async ({
    browser,
  }) => {
    const { session, user } = await createStudyDay();
    const page = await openAs(browser, user);
    await page.goto("/today");

    const missions = page.getByRole("region", { name: "Today's missions" });
    const review = missions.getByRole("button", { name: /^Review\b/u });
    await expect(review).toBeVisible();

    await prisma.studySessionBlock.updateMany({
      data: { completedAt: new Date(), status: "completed" },
      where: { kind: "review", sessionId: session.id },
    });

    await review.click();

    await expect(missions.getByRole("listitem").filter({ hasText: /^Review/u })).toHaveText(
      "Review, done",
    );

    await expect(page).toHaveURL(/\/today$/u);
    await page.context().close();
  });

  test("opens each mission where it's done, and a challenge waiting for today's lessons opens nothing yet", async ({
    browser,
  }) => {
    const { goal, session, user } = await createStudyDay({ buddy: true });
    const chapterId = randomUUID();
    const patternId = randomUUID();
    const planItemId = randomUUID();

    await Promise.all([
      studySessionBlockFixture({
        estimatedMinutes: 5,
        kind: "checkpoint",
        payload: {
          checkpoint: {
            kind: "boss",
            mock: false,
            passMark: 4,
            phase: 1,
            rematch: false,
            timeLimitMinutes: null,
          },
          itemIds: [],
          planItemId,
          title: "Percentages",
        },
        position: 3,
        sessionId: session.id,
      }),
      saveMissions(session.id, [
        { anchor: {}, kind: "askBuddy", opens: { kind: "buddy" }, total: 1 },
        {
          anchor: { chapterId },
          detail: { chapterTitle: "Arriving" },
          kind: "call",
          opens: { chapterId, kind: "call" },
          total: 1,
        },
        {
          anchor: { patternId },
          detail: { patternTitle: "Past simple with did" },
          kind: "pattern",
          opens: { kind: "pattern", patternId },
          total: 1,
        },
        { anchor: {}, kind: "pronunciation", opens: { kind: "pronunciation" }, total: 1 },
        {
          anchor: { blockKind: "checkpoint", planItemId },
          detail: { minutes: 5, title: "Percentages" },
          kind: "challenge",
          total: 1,
        },
      ]),
    ]);

    const page = await openAs(browser, user);
    await page.goto("/today");

    // Each one opens the place it's done in: the buddy, the unit's calls, the pattern, the
    // words to say again. A call or a question only opens its screen; the learner starts it.
    const missions = page.getByRole("region", { name: "Today's missions" });

    await expect(
      missions.getByRole("link", { name: /^Ask Zu something\b.*go to Zu\b/u }),
    ).toHaveAttribute("href", "/buddy");

    await expect(
      missions.getByRole("link", { name: /^Have a call\b.*choose a call\b/u }),
    ).toHaveAttribute("href", `/content/units/${chapterId}`);

    await expect(
      missions.getByRole("link", { name: /^Practice a pattern\b.*go to the pattern\b/u }),
    ).toHaveAttribute("href", `/pattern/${patternId}`);

    await expect(
      missions.getByRole("link", { name: /^Pronunciation\b.*go to pronunciation practice\b/u }),
    ).toHaveAttribute("href", `/pronunciation?goal=${goal.id}`);

    // The Trickster waits for the day's lessons, as his row in the day does: nothing to open yet.
    const challenge = missions.getByRole("listitem").filter({ hasText: /^Take on the Trickster/u });

    await expect(challenge).toHaveText(
      /^Take on the Trickster, after today's lessons\s*After today's lessons\s·\s5\smin$/u,
    );

    await expect(challenge.getByRole("button")).toHaveCount(0);
    await expect(challenge.getByRole("link")).toHaveCount(0);
    await missions.screenshot({ path: test.info().outputPath("today-missions-desktop.png") });

    await missions.getByRole("link", { name: /^Ask Zu something\b/u }).click();
    await expect(page).toHaveURL(/\/buddy$/u);
    await page.context().close();
  });

  test("calls a review quick only while it takes a few minutes", async ({ browser }) => {
    const { session, user } = await createStudyDay();

    await prisma.studySessionBlock.updateMany({
      data: { estimatedMinutes: 13 },
      where: { kind: "review", sessionId: session.id },
    });

    const page = await openAs(browser, user);
    await page.goto("/today");

    const card = page.getByRole("region", { name: "Today's session" });
    await expect(card.getByRole("listitem").first()).toHaveText(/^Reviews.*13\smin$/u);
    await expect(card.getByText("Quick review")).toHaveCount(0);
    await page.context().close();
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

    // The session leads with the next block and one Start; every block is in sight with its minutes.
    const card = page.getByRole("region", { name: "Today's session" });
    await expect(card.getByRole("heading", { name: "Preparation" })).toHaveCount(0);
    await expect(card.getByText(/^\d+ of \d+\smin$/u)).toHaveCount(0);
    await expect(card.getByRole("button", { name: /^Start/u })).toHaveCount(1);

    await expect(card.getByRole("list").getByRole("listitem")).toHaveText([
      /^Quick review/u,
      /^Discounts/u,
      /^Mixed/u,
    ]);

    await expect(card.getByRole("listitem").nth(0)).toHaveAttribute("aria-current", "step");

    // With the whole day in sight, there's nothing more to open.
    await expect(card.getByRole("button", { name: /^See today's/u })).toHaveCount(0);

    // One notice at a time: the welcome back explains the lighter day; the course from before
    // goals waits for a day with nothing else to say.
    await expect(page.getByText(WELCOME_BACK)).toBeVisible();
    await expect(page.getByRole("region", { name: "Suggested goal" })).toHaveCount(0);

    // Today keeps the missions together in one card, the same as on the buddy's tab.
    const missions = page.getByRole("region", { name: "Today's missions" });

    await expect(missions.getByRole("listitem")).toHaveText([/^Review/u, /^Do a new lesson/u]);

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

    // Under the days, by name: the challenge and its day, opening its intro. Its plan item keeps no
    // planned questions, so it names no size, as its intro doesn't.
    const challenge = week.getByRole("link", { name: /^Weekly challenge\s*Sunday/u });

    await expect(challenge).toHaveAttribute("href", `/challenge/${item.id}`);
    await expect(challenge).not.toContainText("questions");

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
    const next = card.getByRole("listitem").filter({ hasText: LESSON_TITLE });
    await expect(next).toHaveAttribute("aria-current", "step");
    await expect(card.getByText("Already know this?")).toBeVisible();
    await card.getByRole("button", { name: "Take the test" }).click();

    await expect(page).toHaveURL(new RegExp(`/test-out/${chapter.id}\\?session=1$`, "u"));
    await expect(page.getByRole("link", { name: "Leave" })).toHaveAttribute("href", /\/today$/u);

    // Back on Today, the test is offered again instead of still opening.
    await page.goBack();
    await expect(card.getByRole("button", { name: "Take the test" })).toBeEnabled();
    await expect(card.getByText("Opening the test…")).toHaveCount(0);
    await page.context().close();
  });

  test("a chapter failed today is offered again only after studying one of its lessons", async ({
    browser,
  }) => {
    const { goal, lesson, session, user } = await createStudyDay({ reviewDone: true });
    const chapter = await libraryChapterFixture();

    const block = await prisma.studySessionBlock.findFirstOrThrow({
      where: { lessonId: lesson.id, sessionId: session.id },
    });

    await Promise.all([
      prisma.planItem.updateMany({
        data: { chapterId: chapter.id },
        where: { lessonId: lesson.id, plan: { goalId: goal.id } },
      }),
      prisma.studySessionBlock.update({
        data: { payload: { ...(block.payload as object), chapterId: chapter.id } },
        where: { id: block.id },
      }),
      learningEventFixture({
        contentIds: { chapterId: chapter.id },
        correctAnswers: 1,
        goalId: goal.id,
        incorrectAnswers: 7,
        kind: "questions",
        lessonKind: "testOut",
        userId: user.id,
      }),
    ]);

    const page = await openAs(browser, user);
    await page.goto("/today");
    const card = page.getByRole("region", { name: "Today's session" });

    await expect(card.getByRole("listitem").filter({ hasText: LESSON_TITLE })).toHaveAttribute(
      "aria-current",
      "step",
    );

    await expect(card.getByText("Already know this?")).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Take the test" })).toHaveCount(0);

    await learningEventFixture({ contentIds: { lessonId: lesson.id }, userId: user.id });
    await page.reload();
    await expect(card.getByRole("button", { name: "Take the test" })).toBeVisible();
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

    // The step opens on the session screen at once, drawn from the tap: its title and the day's
    // segments are there, and Start stays busy while the server opens it.
    const main = page.getByRole("main");
    const step = main.getByRole("heading", { level: 2, name: "Quick review" });
    const day = main.getByRole("progressbar", { name: /^\d+ of \d+ done$/u });
    const busy = main.getByRole("button", { exact: true, name: "Start" });
    await expect(step).toBeVisible();
    await expect(day).toBeVisible();
    await expect(busy).toHaveAttribute("aria-busy", "true");
    const placedThere = () => Promise.all([step.boundingBox(), day.boundingBox()]);
    const shown = await placedThere();

    await expect(main.getByRole("status")).toHaveText("Opening your next step…");

    // It says so in the step's own line, under the button: the title and the day stay put.
    expect(await placedThere()).toEqual(shown);
    await expect(step).toBeVisible();

    // Once the server opens it, the step plays: its questions replace the busy Start.
    await expect(page.getByRole("link", { name: "Close. Your answers are saved." })).toBeVisible({
      timeout: SLOW_OPEN_MS + 10_000,
    });

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

    // Once the day is underway, the greeting has done its job. The review's questions show only
    // once its start is saved.
    await card.getByRole("button", { name: /^Start/u }).click();
    await expect(page).not.toHaveURL(/\/today$/u);
    await expect(page.getByRole("link", { name: "Close. Your answers are saved." })).toBeVisible();
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

    const suggestion = page.getByRole("region", { name: "Suggested goal" });
    await expect(suggestion.getByRole("heading", { name: "Continue Spanish?" })).toBeVisible();
    await expect(suggestion.getByText("Build a plan in 1 minute.")).toBeVisible();

    await suggestion.getByRole("button", { name: "Not now" }).click();
    await expect(suggestion).toBeHidden();
    await expect(page.getByRole("region", { name: "Today's session" })).toBeVisible();
    await page.context().close();
  });

  // Bia had Today open in two tabs and said "Not now" to "Continue Spanish?" in one: the other kept
  // offering it, and answering it there failed, since it was answered already.
  test("drops a suggested goal answered in another tab", async ({ browser }) => {
    const { user } = await createStudyDay();
    await suggestedGoalFixture({ title: "Spanish", userId: user.id });
    const page = await openAs(browser, user);
    const other = await page.context().newPage();
    await page.goto("/today");
    await other.goto("/today");

    const suggestion = page.getByRole("region", { name: "Suggested goal" });
    const elsewhere = other.getByRole("region", { name: "Suggested goal" });
    await expect(elsewhere.getByRole("heading", { name: "Continue Spanish?" })).toBeVisible();
    expect(await other.evaluate(() => document.visibilityState)).toBe("visible");

    await suggestion.getByRole("button", { name: "Not now" }).click();
    await expect(suggestion).toBeHidden();
    await expect(elsewhere).toBeHidden();
    await page.context().close();
  });

  // Rui had Today open in two tabs and started his review from its mission in one: the other still
  // said "Start session", as if nothing had started.
  test("says Continue in another tab once a mission started the day's block", async ({
    browser,
  }) => {
    const { user } = await createStudyDay();
    const page = await openAs(browser, user);
    const other = await page.context().newPage();
    await page.goto("/today");
    await other.goto("/today");

    await expect(other.getByRole("button", { name: "Start session" })).toBeVisible();
    expect(await other.evaluate(() => document.visibilityState)).toBe("visible");

    await page
      .getByRole("region", { name: "Today's missions" })
      .getByRole("button", { name: "Review, go to today's review" })
      .click();

    await expect(page).toHaveURL(/\/session/u);
    await expect(other.getByRole("button", { name: "Continue session" })).toBeVisible();
    await page.context().close();
  });

  // Bia said "Not now" to Today's ask for the exam's notice in one tab: the other kept asking, and
  // an upload there was refused, since nothing was asked anymore.
  test("takes a document ask away in another tab once it's answered", async ({ browser }) => {
    const { goal, user } = await createStudyDay();

    await prisma.goal.update({
      data: { researchUploadReason: "unverified" },
      where: { id: goal.id },
    });

    const page = await openAs(browser, user);
    const other = await page.context().newPage();
    await page.goto("/today");
    await other.goto("/today");

    const ask = page.getByRole("region", { name: "Your plan needs a document" });
    const elsewhere = other.getByRole("region", { name: "Your plan needs a document" });
    await expect(elsewhere).toContainText("We couldn't confirm the exam's details");
    expect(await other.evaluate(() => document.visibilityState)).toBe("visible");

    await ask.getByRole("button", { name: "Not now" }).click();
    await expect(ask).toBeHidden();
    await expect(elsewhere).toBeHidden();
    await page.context().close();
  });

  test("shows the whole day on a wide screen and folds long queues on a phone", async ({
    browser,
  }) => {
    const { lesson, session, user } = await createStudyDay();

    // A re-planned day full of short lessons: the first three blocks are done.
    await Promise.all([
      prisma.studySessionBlock.updateMany({
        data: { status: "completed" },
        where: { position: { in: [0, 1, 2] }, sessionId: session.id },
      }),
      ...Array.from({ length: 9 }, (_, index) => index + 1).map((number) =>
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

    // The wide queue keeps every block, including what's done; the segments report the same day.
    const card = page.getByRole("region", { name: "Today's session" });
    const day = card.getByRole("list").getByRole("listitem");
    await expect(card.getByRole("img", { name: "3 of 12 done" })).toBeVisible();
    await expect(day).toHaveCount(12);
    await expect(day.nth(0)).toHaveText(/^Quick review\s*, done/u);
    await expect(day.nth(3)).toHaveAttribute("aria-current", "step");
    await expect(day.nth(3)).toContainText("Short lesson 1");
    await expect(day.nth(11)).toContainText("Short lesson 9");
    await expect(card.getByRole("button", { name: /^Continue/u })).toBeVisible();
    await expect(card.getByRole("button", { name: /^\+\d+ more/u })).toHaveCount(0);

    await page.setViewportSize({ height: 844, width: 390 });
    await expect(day).toHaveCount(7);
    await expect(day.nth(0)).toHaveAttribute("aria-current", "step");
    await expect(day.nth(6)).toContainText("Short lesson 7");

    // From the keyboard too: the done fold opens three finished rows and closes them again.
    const doneFold = card.getByRole("button", {
      name: new RegExp(`^3 done\\s+${lesson.estimatedMinutes + 4} min$`, "u"),
    });

    await expect(doneFold).toHaveAttribute("aria-expanded", "false");
    await tabTo(page, doneFold);
    await page.keyboard.press("Enter");
    await expect(doneFold).toHaveAttribute("aria-expanded", "true");
    await expect(day).toHaveCount(10);
    await expect(day.nth(0)).toHaveText(/^Quick review\s*, done/u);
    await page.keyboard.press("Enter");
    await expect(doneFold).toHaveAttribute("aria-expanded", "false");
    await expect(day).toHaveCount(7);

    // The upcoming fold reveals only the two lessons beyond the six after the next block.
    const moreFold = card.getByRole("button", { name: /^\+2 more\s+6 min$/u });
    await expect(moreFold).toHaveAttribute("aria-expanded", "false");
    await tabTo(page, moreFold);
    await page.keyboard.press("Enter");
    await expect(moreFold).toHaveAttribute("aria-expanded", "true");
    await expect(day).toHaveCount(9);
    await expect(day.nth(8)).toContainText("Short lesson 9");
    await page.keyboard.press("Enter");
    await expect(moreFold).toHaveAttribute("aria-expanded", "false");
    await expect(card.getByText("Short lesson 9")).toBeHidden();
    await expect(page).toHaveURL(/\/today$/u);
    await page.context().close();
  });

  test("ends the day with its completed queue, what changed and 10 more minutes", async ({
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

    await expect(
      card.getByRole("status").filter({ hasText: "Today's session is complete." }),
    ).toBeVisible();

    await expect(card.getByRole("listitem")).toHaveText([
      /^Quick review\s*, done/u,
      /^Discounts in your head\s*, skipped/u,
      /^Mixed practice\s*, done/u,
    ]);

    await expect(card.getByRole("button", { name: /^Study \d+ more minutes$/u })).toBeVisible();
    await expectAccessibleScreen(page, "Today once the day is done");

    // Enter opens what changed, the day's one next step, on the session screen of this goal's day.
    await expect(card.getByRole("link", { name: /^See what changed/u })).toHaveAttribute(
      "href",
      `/session?goal=${session.goalId}`,
    );

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/session\\?goal=${session.goalId}$`, "u"));
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

      // The Plan still says honestly what those days left, under its pace (drawn once per
      // viewport: a tile in the column, a number in the aside).
      await page.goto("/plan");

      await expect(
        page
          .getByRole("main")
          .getByText(/\d+ lessons? to catch up/u)
          .filter({ visible: true }),
      ).toBeVisible();
    });
  });

  // Rafaela back after a month read "You're behind", three percentages and a wall of topics
  // before her greeting, with "Study 4 hr a day" as the main action.
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
      note.getByRole("heading", {
        name: "At 2 hr a day, your plan now covers 39% of the exam, down from 48%.",
      }),
    ).toBeVisible();

    await expect(
      note.getByText(
        "Semantic categories, Word meanings and 3 more topics no longer fit by your date.",
      ),
    ).toBeVisible();

    // The greeting and the lighter day come first; the card waits under them.
    const [cardBox, noteBox] = await Promise.all([card.boundingBox(), note.boundingBox()]);
    expect(cardBox?.y ?? Infinity).toBeLessThan(noteBox?.y ?? 0);

    // Each choice says what it does, with no searched number (LEAD ruling A: more time opens the
    // plan editor's time a day), and more hours isn't the main action on the day she's back.
    await expect(note.getByRole("link").or(note.getByRole("button"))).toHaveText([
      "Choose where to focus",
      "Keep my time",
      "More time a day",
      "Study everything",
    ]);

    await expect(note.getByRole("link", { name: "More time a day" })).toHaveCSS(
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

      await expect(
        card.getByRole("status").filter({ hasText: "No study planned today." }),
      ).toContainText("Welcome back! Today is a rest day in your plan, so enjoy it.");

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

    await expect(card.getByRole("listitem")).toHaveText([
      /^Quick review/u,
      /^Discounts in your head/u,
      /^Mixed practice/u,
      /^Missed lesson 1/u,
      /^Missed lesson 2/u,
    ]);

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
      card.getByRole("status").filter({ hasText: "Getting today's lessons ready…" }),
    ).toContainText("They show up here on their own.");

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

    await expect(
      card.getByRole("status").filter({ hasText: "No study planned today." }),
    ).toContainText("Enjoy your day off!");

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
    const reviewRow = card.getByRole("listitem").filter({ hasText: "Quick review" });
    await expect(reviewRow).toHaveAttribute("aria-current", "step");

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

    await expect(
      card.getByRole("status").filter({ hasText: "Nothing new for today." }),
    ).toContainText("You've done every lesson in your plan, or already know it.");

    // No practiceable content exists yet: a button here would lead to nothing to study.
    await expect(card.getByRole("button", { name: /^Practice for \d+ minutes$/u })).toHaveCount(0);
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

    // Today keeps its frame: its title, and one line saying the goal is paused.
    await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();

    await expect(
      page.getByRole("status").filter({ hasText: "Bake sourdough bread is paused." }),
    ).toContainText("Nothing is planned until you resume it.");

    // Today reads the page again from the resume's note, after reading its view, never from the
    // button on its own: a read of the page sent with the resume (the button's) could overlap
    // Today's, and leave the page paused, with Resume busy.
    const events: string[] = [];

    page.on("request", (request) => {
      const url = new URL(request.url());

      if (
        url.pathname === "/today" &&
        url.searchParams.has("_rsc") &&
        !request.headers()["next-router-prefetch"]
      ) {
        events.push("page");
      }
    });

    page.on("response", (response) => {
      if (new URL(response.url()).pathname === "/api/learner/views/today") {
        events.push("view");
      }
    });

    await page.getByRole("button", { name: "Resume Bake sourdough bread" }).click();

    await expect(page.getByRole("region", { name: "Today's session" })).toBeVisible();

    // No read of the page is fine too: the resume's own answer can draw the day.
    const firstPage = events.indexOf("page");
    expect(firstPage === -1 ? ["view"] : events.slice(0, firstPage)).toContain("view");

    await expect.poll(() => readGoalStatus(goal.id)).toBe("active");

    await page.context().close();
  });

  // Bia had Today open in two tabs on her paused goal and resumed it in one: the other still said
  // the goal was paused, with nothing planned.
  test("shows the day in another tab once a paused goal is resumed", async ({ browser }) => {
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
    const other = await page.context().newPage();
    await page.goto("/today");
    await other.goto("/today");

    await expect(
      other.getByRole("status").filter({ hasText: "Bake sourdough bread is paused." }),
    ).toBeVisible();

    expect(await other.evaluate(() => document.visibilityState)).toBe("visible");

    await page.getByRole("button", { name: "Resume Bake sourdough bread" }).click();
    await expect(page.getByRole("region", { name: "Today's session" })).toBeVisible();
    await expect(other.getByRole("region", { name: "Today's session" })).toBeVisible();
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
    await expect(card.getByRole("listitem")).toHaveText([new RegExp(`^${LESSON_TITLE}`, "u")]);

    // On a narrow phone the line goes under the title instead of squeezing it to a word a line.
    const [title, line] = await Promise.all([
      card.getByRole("heading", { level: 1, name: "Today" }).boundingBox(),
      coming.boundingBox(),
    ]);

    expect(title).not.toBeNull();
    expect((title?.x ?? 0) + (title?.width ?? 0)).toBeLessThanOrEqual(NARROW_PHONE_WIDTH);
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

    await expect(card.getByRole("listitem")).toHaveText([
      new RegExp(`^${LESSON_TITLE}`, "u"),
      /^Fractions on a number line/u,
    ]);

    await expect(card.getByText(/more as you go/u)).toHaveCount(0);
    await expect(card.getByRole("listitem").nth(0)).toHaveAttribute("aria-current", "step");
    await page.context().close();
  });
});

/**
 * A learner without a goal who typed one on Today (its reading stored, as a real read leaves it)
 * and has Today open in another tab too, both showing the draft to confirm.
 */
async function openDraftInTwoTabs(browser: Browser) {
  const user = await createE2EUser(getBaseURL());
  const id = randomUUID().slice(0, 8);
  const title = `Understand quantum physics ${id}`;

  await goalUnderstandingFixture({
    goal: `understand quantum physics ${id}`,
    result: {
      followUps: [],
      goals: [{ kind: "learn", subject: "quantum physics", title }],
      route: "goals",
    },
    userId: user.id,
  });

  const page = await openAs(browser, user);
  const other = await page.context().newPage();
  await page.goto("/today");
  const send = page.getByRole("button", { name: "Build my plan" });

  // The box sends once React drives it: a click on the server's HTML alone sends nothing.
  await expect
    .poll(() =>
      send.evaluate((button) => Object.keys(button).some((key) => key.startsWith("__react"))),
    )
    .toBe(true);

  await page.getByRole("textbox", { name: "I want to" }).fill(`understand quantum physics ${id}`);
  await send.click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();

  await other.goto("/today");
  await expect(other.getByText(title, { exact: true })).toBeVisible();
  expect(await other.evaluate(() => document.visibilityState)).toBe("visible");

  return { id, other, page };
}

test.describe("Today without a day to show", () => {
  test("lets a learner without a goal start one right on Today", async ({
    userWithoutProgress,
  }) => {
    await userWithoutProgress.goto("/today");

    // Today keeps its own title; the start form is its section, on the page's edges.
    await expect(userWithoutProgress).toHaveURL(/\/today$/u);

    await expect(
      userWithoutProgress.getByRole("heading", { level: 1, name: "Today" }),
    ).toBeVisible();

    await expect(userWithoutProgress.getByRole("heading", { name: "Start a goal" })).toBeVisible();
    await expect(userWithoutProgress.getByRole("textbox", { name: "I want to" })).toBeVisible();

    // On a wide screen the examples to start from sit in Today's aside, beside the form; on a
    // phone they follow the form.
    const example = userWithoutProgress.getByRole("button", { name: /^Read sheet music/u });
    const aside = userWithoutProgress.getByRole("complementary", { name: "Getting started" });

    await userWithoutProgress.setViewportSize({ height: 900, width: 1440 });
    await expect(example).toHaveCount(1);
    await expect(aside.getByRole("button", { name: /^Read sheet music/u })).toBeVisible();
    await expect(aside.getByRole("heading", { name: "How it works" })).toBeVisible();

    await userWithoutProgress.setViewportSize({ height: 844, width: 390 });
    await expect(example).toHaveCount(1);
    await expect(aside).toBeHidden();
  });

  // Bia typed "understand quantum physics" on Today and had it open in two tabs: she renamed the
  // goal in one, and the other kept the old name, so confirming there made the goal she'd changed.
  test("shows a goal draft corrected in another tab on Today's card", async ({ browser }) => {
    const { id, other, page } = await openDraftInTwoTabs(browser);
    const renamed = `Understand quantum computing ${id}`;

    await page.getByRole("button", { name: "Edit Goal" }).click();
    await page.getByRole("textbox", { name: "Goal" }).fill(renamed);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(renamed, { exact: true })).toBeVisible();

    await expect(other.getByText(renamed, { exact: true })).toBeVisible();
    await page.context().close();
  });

  // Bia renamed the goal in one tab, then in the other. The second tab's own name briefly gave way
  // to the first tab's, from a page read made before her second rename was saved: confirming then
  // made the goal with the older name.
  test("keeps a draft corrected here over an older copy Today read before it", async ({
    browser,
  }) => {
    const { id, other, page } = await openDraftInTwoTabs(browser);
    const fromOther = `Understand quantum optics ${id}`;
    const fromHere = `Understand quantum computing ${id}`;

    // Today's read of the page here that has the other tab's rename is answered by the server,
    // then held: it doesn't have this tab's rename, which is saved meanwhile.
    const answered = Promise.withResolvers<null>();
    const deliver = Promise.withResolvers<null>();
    let held = false;

    await page.route(
      (url) => url.pathname === "/today" && url.searchParams.has("_rsc"),
      async (route, request) => {
        if (held || request.headers()["next-router-prefetch"]) {
          await route.continue();
          return;
        }

        const response = await route.fetch();

        // Only the read that already has the other tab's rename is held; an earlier one goes on.
        const body = await response.text();

        if (!body.includes(fromOther)) {
          await route.fulfill({ response });
          return;
        }

        held = true;
        answered.resolve(null);
        await deliver.promise;
        await route.fulfill({ response });
      },
    );

    await other.getByRole("button", { name: "Edit Goal" }).click();
    await other.getByRole("textbox", { name: "Goal" }).fill(fromOther);
    await other.getByRole("button", { name: "Save" }).click();
    await answered.promise;

    // Today's reads here wait until the older page read is delivered, so nothing newer overtakes it.
    const reads = Promise.withResolvers<null>();

    await page.route("**/api/learner/views/today", async (route) => {
      await reads.promise;
      await route.continue();
    });

    await page.getByRole("button", { name: "Edit Goal" }).click();
    await page.getByRole("textbox", { name: "Goal" }).fill(fromHere);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(fromHere, { exact: true })).toBeVisible();

    await page.evaluate((older) => {
      const main = document.querySelector("main") ?? document.body;

      new MutationObserver(() => {
        if (main.textContent.includes(older)) {
          document.documentElement.dataset.sawOlder = "true";
        }
      }).observe(main, { characterData: true, childList: true, subtree: true });
    }, fromOther);

    const delivered = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/today" &&
        !response.request().headers()["next-router-prefetch"],
    );

    // The older read lands first: Today's next read of the page here only goes out once its view
    // reads are let go, and the check waits for it, so the older one had its chance to show.
    deliver.resolve(null);
    await delivered;

    const next = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/today" &&
        !response.request().headers()["next-router-prefetch"],
    );

    reads.resolve(null);
    await next;

    await expect(page.getByText(fromHere, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.dataset.sawOlder)).toBeUndefined();
    await page.context().close();
  });

  // Bia confirmed the goal in one tab: the other kept offering the same draft to confirm again.
  test("leaves the goal draft in another tab once the goal is confirmed", async ({ browser }) => {
    const { other, page } = await openDraftInTwoTabs(browser);

    await page.getByRole("button", { name: "Looks right" }).click();
    await expect(page).toHaveURL(/\/start\/[0-9a-f-]{36}$/u);

    await expect(other.getByRole("heading", { name: "Here's what I understood" })).toBeHidden();
    await page.context().close();
  });

  test("sends a learner without a goal from a goal's tab to Today to start one", async ({
    userWithoutProgress,
  }) => {
    await userWithoutProgress.goto("/mistakes");

    await userWithoutProgress.getByRole("main").getByRole("link", { name: "Start a goal" }).click();

    await expect(userWithoutProgress).toHaveURL(/\/today$/u);
    await expect(userWithoutProgress.getByRole("heading", { name: "Start a goal" })).toBeVisible();
  });

  // Sam came for one question and only search found it again: Today offers it first.
  test("offers an unfinished quick explanation before starting a goal", async ({ browser }) => {
    const user = await createE2EUser(getBaseURL());

    const goal = await goalFixture({
      details: { question: "what does 'the market is up 2%' mean?" },
      kind: "explain",
      timezone: "UTC",
      title: "What 'the market is up 2%' means",
      userId: user.id,
    });

    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });

    const page = await openAs(browser, user);
    await page.goto("/today");

    const explanation = page.getByRole("region", { name: "Your quick explanation" });
    await expect(explanation).toContainText("What 'the market is up 2%' means");

    await expect(explanation.getByRole("link", { name: "Continue explanation" })).toHaveAttribute(
      "href",
      `/explain/${goal.id}`,
    );

    await expect(page.getByRole("heading", { name: "Start a goal" })).toBeVisible();
    await page.context().close();
  });

  test("welcomes a returning learner back to their last course", async ({ browser }) => {
    const user = await createE2EUser(getBaseURL());
    const suggestion = await suggestedGoalFixture({ title: "Physics", userId: user.id });
    const page = await openAs(browser, user);
    await page.goto("/today");

    await expect(page.getByRole("heading", { level: 1, name: "Welcome back" })).toBeVisible();

    const card = page.getByRole("region", { name: "Suggested goal" });
    await expect(card.getByText("Continue Physics?")).toBeVisible();
    await card.getByRole("button", { name: "Build my plan" }).click();

    await expect(page).toHaveURL(/\/start\?goal=Physics$/u);
    await expect(page.getByRole("textbox", { name: "I want to" })).toHaveValue("Physics");

    await expect
      .poll(async () => {
        const row = await prisma.suggestedGoal.findUnique({ where: { id: suggestion.id } });
        return row?.status;
      })
      .toBe("accepted");

    await page.context().close();
  });

  // Bia had "Continue Physics?" open in two tabs and said "Not now" in one: the other kept offering
  // it, and answering it there failed, since it was answered already.
  test("drops a returning learner's suggested goal answered in another tab", async ({
    browser,
  }) => {
    const user = await createE2EUser(getBaseURL());
    await suggestedGoalFixture({ title: "Physics", userId: user.id });
    const page = await openAs(browser, user);
    const other = await page.context().newPage();
    await page.goto("/today");
    await other.goto("/today");

    const elsewhere = other.getByRole("region", { name: "Suggested goal" });
    await expect(elsewhere.getByText("Continue Physics?")).toBeVisible();
    expect(await other.evaluate(() => document.visibilityState)).toBe("visible");

    await page
      .getByRole("region", { name: "Suggested goal" })
      .getByRole("button", { name: "Not now" })
      .click();

    await expect(page).toHaveURL(/\/start$/u);
    await expect(elsewhere).toBeHidden();
    await page.context().close();
  });

  // Marcos accepted "Continue Spanish?" and landed on a blank "I want to" form with the word
  // "Spanish", a different path from the course he was taking.
  test("opens the start of the course a returning learner was taking, while it exists", async ({
    browser,
  }) => {
    const [user, course] = await Promise.all([
      createE2EUser(getBaseURL()),
      courseFixture({
        isPublished: true,
        slug: `e2e-spanish-${randomUUID().slice(0, 8)}`,
        title: "Spanish",
        visibility: "public",
      }),
    ]);

    await suggestedGoalFixture({ courseId: course.id, title: "Spanish", userId: user.id });
    const page = await openAs(browser, user);
    await page.goto("/today");

    const card = page.getByRole("region", { name: "Suggested goal" });
    await card.getByRole("button", { name: "Build my plan" }).click();

    await expect(page).toHaveURL(new RegExp(`/start/course/${course.id}$`, "u"));
    await page.context().close();
  });

  test("follows the plan being built and opens the day on its own", async ({ browser }) => {
    const user = await createE2EUser(getBaseURL());
    const runId = `e2e-today-${randomUUID()}`;

    const goal = await goalFixture({
      details: PAST_THE_QUESTIONS,
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
      details: PAST_THE_QUESTIONS,
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

    await expect(
      page.getByRole("progressbar", { name: "0 of 1 done · more as you go" }),
    ).toHaveAttribute("aria-valuenow", "0");

    await expect(page.getByRole("heading", { level: 2, name: LESSON_TITLE })).toBeVisible();
    await page.context().close();
  });
});
