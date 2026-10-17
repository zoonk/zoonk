import { randomUUID } from "node:crypto";
import { type Page } from "@playwright/test";
import {
  type LessonQuestionResource,
  type TutorToolOffer,
  createLessonQuestionInputSchema,
} from "@zoonk/core/lesson-questions/contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { type MissionMomentView } from "@zoonk/core/sessions/completion-contract";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { goalFixture, planChangeFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { createGoalLearner } from "./checkpoint-fixtures";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { captureMissionEnding } from "./mission-ending-captures";
import { expectHydrated, holdCodeWith, isHydrated } from "./on-demand-code";
import { createStudyDay, openAs, saveMissions } from "./study-day";
import { fulfillTutorAnswer, proposeFutureRestDay, toProposal } from "./tutor-answer";

const STUDY_SECONDS = 600;
const FULL_MEAL_DAYS = [1, 2];
const SATURDAY = 6;

/** A phone, where the buddy's day is one line beside its name that opens a sheet. */
const PHONE = { height: 812, width: 390 };

async function readGlasses(userId: string) {
  const buddy = await readBuddy(userId);
  return buddy.buddyGlasses;
}

async function readBuddy(userId: string) {
  return prisma.userLearningProfile.findUniqueOrThrow({
    select: { buddyGlasses: true, buddyKind: true, buddyName: true },
    where: { userId },
  });
}

function readChangeStatus(changeId: string) {
  return prisma.planChange
    .findUniqueOrThrow({ where: { id: changeId } })
    .then((change) => change.status);
}

/**
 * A learner with Zu who won a checkpoint (the Star glasses), did all three missions on two earlier
 * days and, today, finished the new lesson but not its review, with nothing to fix.
 */
async function createBuddyLearner() {
  const { goal, user } = await createGoalLearner();
  const today = toUTCMidnight(new Date());

  const [session] = await Promise.all([
    studySessionFixture({ goalId: goal.id, userId: user.id }),
    learningProfileFixture({ activeGoalId: goal.id, buddyKind: "zu", userId: user.id }),
    learningEventFixture({
      correctAnswers: 8,
      incorrectAnswers: 2,
      kind: "checkpoint",
      lessonKind: "boss",
      userId: user.id,
    }),
    prisma.milestone.create({ data: { key: "star", kind: "glasses", userId: user.id } }),
    ...FULL_MEAL_DAYS.map((daysAgo) => {
      const localDate = new Date(today.getTime() - daysAgo * MS_PER_DAY);

      return studySessionFixture({
        fullMealAt: localDate,
        goalId: goal.id,
        localDate,
        userId: user.id,
      });
    }),
  ]);

  await Promise.all([
    studySessionBlockFixture({
      kind: "learn",
      position: 0,
      sessionId: session.id,
      status: "completed",
    }),
    studySessionBlockFixture({
      kind: "review",
      payload: {
        capsules: [
          {
            format: "rapidFire",
            itemIds: [randomUUID()],
            key: "skill:percentages",
            lessonId: null,
            skillIds: [],
            title: "Percentages",
          },
        ],
      },
      position: 1,
      sessionId: session.id,
    }),
  ]);

  return user;
}

/**
 * A learner with Zu who did all three missions today, and got their bonus: the new lesson, the
 * day's review and a mistake fixed. Nothing left to do.
 */
async function createAllMissionsLearner() {
  const { goal, user } = await createGoalLearner();
  const today = toUTCMidnight(new Date());
  const skill = await skillFixture();

  const [session, item] = await Promise.all([
    studySessionFixture({
      fullMealAt: new Date(),
      goalId: goal.id,
      localDate: today,
      userId: user.id,
    }),
    itemFixture({ skillId: skill.id }),
    learningProfileFixture({ activeGoalId: goal.id, buddyKind: "zu", userId: user.id }),
    mistakeFixture({ fixedAt: new Date(), status: "fixed", userId: user.id }),
  ]);

  await Promise.all([
    studySessionBlockFixture({
      kind: "learn",
      position: 0,
      sessionId: session.id,
      status: "completed",
    }),
    studySessionBlockFixture({
      kind: "review",
      payload: {
        capsules: [
          {
            format: "rapidFire",
            itemIds: [item.id],
            key: `skill:${skill.id}`,
            lessonId: null,
            skillIds: [skill.id],
            title: "Percentages",
          },
        ],
      },
      position: 1,
      sessionId: session.id,
      status: "completed",
    }),
    attemptFixture({ itemId: item.id, studySessionId: session.id, userId: user.id }),
  ]);

  return user;
}

/** Opens the buddy's day from the line beside its name: its Energy and today's missions, in a sheet. */
async function openBuddyToday(page: Page, buddy: string) {
  await page
    .getByRole("main")
    .getByRole("button", { name: /missions$/iu })
    .click();

  const sheet = page.getByRole("dialog", { name: `${buddy} today` });
  await expect(sheet).toBeVisible();
  return sheet;
}

type BuddyAnswer = {
  answer: string;
  planChange?: PlanChangeView;
  /** Earlier proposals this answer's change replaced, as the API sends them. */
  replaced?: string[];
  /** The answer as the API saved it, its links checked (`data-saved-answer`). */
  saved?: string;
  toolOffer?: TutorToolOffer;
};

/**
 * Stands in for the goal's tutor routes in the browser, as the lesson tutor's tests do (the API
 * doesn't run here): an empty thread, each question stored as sent, and each answer streamed in
 * order, with the plan change it proposed or the app tool it offered as the API sends them. The API's own tests cover how
 * answers are written and saved.
 */
async function stubBuddy({
  answers,
  missionMoment = null,
  onQuestionCreated,
  page,
}: {
  answers: BuddyAnswer[];
  /** What asking does to the day's missions, as the API says when the question is created. */
  missionMoment?: MissionMomentView | null;
  /** Persists a transport fixture's mission receipt so the real day read agrees with the chat. */
  onQuestionCreated?: (question: LessonQuestionResource) => Promise<void>;
  page: Page;
}) {
  const asked: { question: string }[] = [];
  const queue = [...answers];

  await page.route(/\/v1\/goals\/[^/]+\/plan\/questions/u, async (route) => {
    const request = route.request();

    if (request.method() === "GET") {
      await route.fulfill({ body: "null", contentType: "application/json" });
      return;
    }

    const input = createLessonQuestionInputSchema.parse(request.postDataJSON());
    const now = new Date().toISOString();
    asked.push({ question: input.question });

    const question: LessonQuestionResource = {
      answer: null,
      context: { kind: "plan" },
      createdAt: now,
      id: randomUUID(),
      planChange: null,
      question: input.question,
      status: "pending",
      toolOffer: null,
      updatedAt: now,
    };

    await onQuestionCreated?.(question);
    await route.fulfill({ json: { ...question, missionMoment }, status: 201 });
  });

  await page.route("**/v1/questions/*/answers", async (route) => {
    const next = queue.shift() ?? { answer: "Okay." };

    const parts = [
      ...(next.planChange ? [{ data: next.planChange, type: "data-plan-change" as const }] : []),
      ...(next.replaced
        ? [{ data: { ids: next.replaced }, type: "data-plan-changes-replaced" as const }]
        : []),
      ...(next.toolOffer ? [{ data: next.toolOffer, type: "data-tool-offer" as const }] : []),
      ...(next.saved === undefined
        ? []
        : [{ data: { answer: next.saved }, type: "data-saved-answer" as const }]),
    ];

    await fulfillTutorAnswer(route, next.answer, parts);
  });

  return asked;
}

test.describe("Buddy tab", () => {
  test("on a phone keeps the buddy's day to one line beside its name, opening Energy and the missions in a sheet, glasses and the rest in its menu, and studying wakes it", async ({
    browser,
  }) => {
    const user = await createBuddyLearner();
    const page = await openAs(browser, user);
    await page.setViewportSize(PHONE);
    const main = page.getByRole("main");
    await stubBuddy({ answers: [], page });

    await page.goto("/buddy");

    await expect(main.getByRole("heading", { level: 1, name: "Zu" })).toBeVisible();
    await expect(main.getByRole("region", { name: "Conversation with Zu" })).toBeVisible();
    await expectAccessibleScreen(page, "the buddy tab");

    // Today's missions ring the buddy's tab, so they're in sight from every tab.
    await expect(
      page
        .getByRole("navigation", { name: "Learning tabs" })
        .getByRole("link", { name: /^Zu\s*1 of 2 missions today$/u }),
    ).toHaveAttribute("aria-current", "page");

    // Before a day of study has passed there's no Energy to show: no empty meter, just when it starts.
    // The line beside the buddy's name says so with the missions, and opens the buddy's day.
    await expect(
      main.getByRole("button", { name: /^Energy\s*Not yet\s*1 of 2 missions$/u }),
    ).toBeVisible();

    const first = await openBuddyToday(page, "Zu");
    await expect(first.getByRole("link", { name: /^Energy/u })).toHaveCount(0);

    await expect(
      first.getByText("Energy starts after your first day of study, and grows as you learn."),
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(first).toBeHidden();

    // A day of study has passed, no study yet today and no Energy left: the buddy naps, and
    // nothing scolds. Energy opens its history.
    await dailyProgressFixtureMany([
      {
        date: new Date(toUTCMidnight(new Date()).getTime() - MS_PER_DAY),
        timeSpentSeconds: STUDY_SECONDS,
        userId: user.id,
      },
    ]);

    await page.reload();

    await expect(
      main.getByRole("button", { name: /^Energy\s*\d+%\s*1 of 2 missions$/u }),
    ).toBeVisible();

    const today = await openBuddyToday(page, "Zu");
    const energy = today.getByRole("link", { name: /^Energy/u });

    await expect(energy).toContainText("Zu took a nap. Anything you learn wakes it up.");
    await expect(energy).toHaveAttribute("href", "/energy");

    const missions = today.getByRole("region", { name: "Today's missions" });
    await expect(missions).toContainText("1/2");

    // A mission to do opens where it's done and says what's left; one done is only its check.
    await expect(
      missions.getByRole("listitem").filter({ hasText: /^Do a new lesson/u }),
    ).toHaveText("Do a new lesson, done");

    await expect(missions.getByRole("listitem")).toHaveText([
      /^Review, go to today's review\s*Quick review$/u,
      "Do a new lesson, done",
    ]);

    await expect(
      missions.getByRole("button", { name: /^Review\b.*go to today's review/u }),
    ).toBeEnabled();

    await expect(missions.getByRole("button", { name: /^Do a new lesson/u })).toHaveCount(0);

    await expect(missions.getByRole("button", { name: "+50 Brain Power" })).toBeVisible();

    await expectAccessibleScreen(page, "the buddy's day");

    await page.keyboard.press("Escape");
    await expect(today).toBeHidden();

    // The rest is behind the buddy's "…".
    const more = main.getByRole("button", { name: "More about Zu" });
    await more.click();

    await expect(page.getByRole("menuitem", { name: "Weekly summary" })).toHaveAttribute(
      "href",
      "/logbook",
    );

    // Statistics open from the sidebar and the level in the top bar, not from here.
    await expect(page.getByRole("menuitem", { name: "Statistics" })).toHaveCount(0);

    await page.getByRole("menuitem", { name: /^Glasses\s*2 of 6$/u }).click();

    const sheet = page.getByRole("dialog", { name: "Glasses" });
    await expect(sheet).toBeVisible();

    // Locked pairs say how they're earned and how far along the learner is.
    await expect(
      sheet.getByRole("radio", { name: /Cat-eye\s*2 of 7 days with every mission done/u }),
    ).toBeDisabled();

    await expect(
      sheet.getByRole("radio", { name: /Monocle\s*Win the final challenge/u }),
    ).toBeDisabled();

    await expect(sheet.getByRole("radio", { name: "Round" })).toBeChecked();
    await expectAccessibleScreen(page, "the glasses sheet");

    // An earned pair goes on with one tap, and the arrow keys move to the next earned one.
    const star = sheet.getByRole("radio", { name: "Star" });
    await star.click();

    await expect(star).toBeChecked();
    await expect.poll(() => readGlasses(user.id)).toBe("star");

    await page.keyboard.press("ArrowUp");

    await expect(sheet.getByRole("radio", { name: "Round" })).toBeChecked();
    await expect.poll(() => readGlasses(user.id)).toBe("round");

    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();

    // Studying today wakes it, however low Energy is.
    await dailyProgressFixtureMany([
      { date: toUTCMidnight(new Date()), timeSpentSeconds: STUDY_SECONDS, userId: user.id },
    ]);

    await page.reload();

    const awake = await openBuddyToday(page, "Zu");

    await expect(awake.getByRole("link", { name: /^Energy/u })).toContainText(
      "You studied today, so Energy won't drop.",
    );

    await expect(awake.getByText(/took a nap/u)).toHaveCount(0);

    // Energy in the buddy's day opens the Energy page, from the keyboard too.
    await awake.getByRole("link", { name: /^Energy/u }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/energy$/u);
    await expect(page.getByRole("heading", { level: 1, name: "Energy" })).toBeVisible();
    await page.context().close();
  });

  test("says in the conversation when asking completed the day's last mission, with the +50", async ({
    browser,
  }) => {
    const user = await createBuddyLearner();

    const session = await prisma.studySession.findFirstOrThrow({
      orderBy: { createdAt: "desc" },
      where: { localDate: toUTCMidnight(new Date()), userId: user.id },
    });

    await saveMissions(session.id, [
      { anchor: {}, kind: "askBuddy", opens: { kind: "buddy" }, total: 1 },
    ]);

    await prisma.studySession.update({
      data: { startedAt: new Date() },
      where: { id: session.id },
    });

    const [thread, before] = await Promise.all([
      prisma.lessonQuestionThread.create({
        data: { goalId: session.goalId, kind: "plan", userId: user.id },
      }),
      prisma.userProgress.findUniqueOrThrow({ where: { userId: user.id } }),
    ]);

    const page = await openAs(browser, user);
    await page.setViewportSize({ height: 900, width: 1440 });

    await stubBuddy({
      answers: [{ answer: "Good question." }],
      missionMoment: {
        completed: ["askBuddy"],
        fullMeal: { bonus: 50, paid: true },
        missions: [{ done: 1, kind: "askBuddy", status: "done", total: 1 }],
      },
      onQuestionCreated: async (question) => {
        const source = { id: question.id, kind: "buddyQuestion" };
        const now = new Date(question.createdAt);

        // The API transport is stubbed, so persist its receipt before the real day refresh reads it.
        await prisma.$transaction(async (tx) => {
          await tx.lessonQuestion.create({
            data: {
              answer: "Good question.",
              contextKind: "plan",
              contextSnapshot: {},
              createdAt: now,
              id: question.id,
              question: question.question,
              requestFingerprint: question.id,
              requestId: randomUUID(),
              status: "completed",
              threadId: thread.id,
            },
          });

          await tx.studySession.update({
            data: {
              fullMealAt: now,
              missions: {
                picks: [
                  {
                    anchor: {},
                    completedBy: source,
                    done: 1,
                    kind: "askBuddy",
                    opens: { kind: "buddy" },
                    total: 1,
                  },
                ],
                version: 1,
              },
              startSnapshot: {
                fullMealReward: {
                  after: Number(before.totalBrainPower) + 50,
                  before: Number(before.totalBrainPower),
                },
                fullMealSource: source,
              },
            },
            where: { id: session.id },
          });

          await tx.userProgress.update({
            data: { totalBrainPower: { increment: 50 } },
            where: { userId: user.id },
          });

          await tx.dailyProgress.upsert({
            create: {
              brainPowerEarned: 50,
              date: session.localDate,
              dayOfWeek: session.localDate.getUTCDay(),
              userId: user.id,
            },
            update: { brainPowerEarned: { increment: 50 } },
            where: { userDate: { date: session.localDate, userId: user.id } },
          });
        });
      },
      page,
    });

    await page.goto("/buddy");
    const conversation = page.getByRole("region", { name: "Conversation with Zu" });
    const day = page.getByRole("complementary", { name: "Zu today" });

    await expect(day.getByRole("region", { name: "Today's missions" })).toContainText(
      "Ask Zu something",
    );

    await expect(
      page
        .getByRole("navigation", { name: "Learning tabs" })
        .getByRole("link", { name: /^Zu\s*0 of 1 missions today$/u }),
    ).toBeVisible();

    await conversation.getByRole("textbox", { name: "Message Zu" }).fill("Why does this work?");
    await conversation.getByRole("button", { name: "Send" }).click();

    const moment = conversation;
    await expect(moment).toContainText("Mission done: Ask Zu something");
    await expect(moment).toContainText("from today's missions");
    await expect(moment.getByRole("button", { name: "+50 Brain Power" })).toBeVisible();

    await expect(
      conversation.getByRole("button", { exact: true, name: "+50 Brain Power" }),
    ).toHaveCount(1);

    const missions = day.getByRole("region", { name: "Missions done" });
    await expect(missions).toContainText("Ask Zu something");
    await expect(missions).toContainText("1/1");
    await expect(missions).toContainText("You earned +50 Brain Power.");
    await expect(missions.getByRole("button", { name: "+50 Brain Power" })).toBeVisible();

    await expect(
      page
        .getByRole("navigation", { name: "Learning tabs" })
        .getByRole("link", { name: /^Zu\s*1 of 1 missions today$/u }),
    ).toBeVisible();

    await expect(
      prisma.userProgress.findUniqueOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ totalBrainPower: before.totalBrainPower + 50n });

    await captureMissionEnding(page, test.info(), "buddy");
    await page.context().close();
  });

  test("names the learner's own buddy in the conversation's moment, and keeps it with its goal", async ({
    browser,
  }) => {
    const { goal: first, user } = await createGoalLearner();
    const second = await goalFixture({ timezone: "UTC", title: "Learn to cook", userId: user.id });

    await Promise.all([
      planFixture({ goalId: first.id }),
      planFixture({ goalId: second.id }),
      learningProfileFixture({
        activeGoalId: first.id,
        buddyKind: "beep",
        buddyName: "Pip",
        userId: user.id,
      }),
    ]);

    const page = await openAs(browser, user);

    await stubBuddy({
      answers: [{ answer: "Good question." }],
      missionMoment: {
        completed: ["askBuddy"],
        fullMeal: { bonus: 50, paid: false },
        missions: [
          { done: 1, kind: "askBuddy", status: "done", total: 1 },
          { done: 0, kind: "review", status: "todo", total: 1 },
        ],
      },
      page,
    });

    await page.goto("/buddy");
    const conversation = page.getByRole("region", { name: "Conversation with Pip" });
    await conversation.getByRole("textbox", { name: "Message Pip" }).fill("Why does this work?");
    await conversation.getByRole("button", { name: "Send" }).click();

    const moment = conversation.locator("[data-slot=mission-moment]");
    await expect(moment).toContainText("Mission done: Ask Pip something");
    await expect(moment).toContainText("1 of 2 · Left: Review");

    // Another goal's conversation never shows this goal's moment.
    await page.getByRole("button", { name: /Current goal: /u }).click();
    await page.getByRole("menuitemradio", { name: "Learn to cook" }).click();
    await expect(page.getByRole("button", { name: /Current goal: Learn to cook/u })).toBeVisible();
    await expect(page.locator("[data-slot=mission-moment]")).toHaveCount(0);
    await page.context().close();
  });

  test("on a laptop keeps the buddy's day beside the conversation: Energy, the missions done and the buddy, and missions wait for a session that doesn't exist yet", async ({
    browser,
  }) => {
    const fed = await createAllMissionsLearner();
    const page = await openAs(browser, fed);
    const main = page.getByRole("main");
    await stubBuddy({ answers: [], page });

    await page.goto("/buddy");

    // The day sits beside the conversation, so the line that opens its sheet on a phone is gone.
    const day = main.getByRole("complementary", { name: "Zu today" });
    await expect(day).toBeVisible();
    await expect(main.getByRole("button", { name: /missions$/iu })).toBeHidden();

    // The conversation keeps a comfortable line instead of stretching across the screen.
    const conversation = main.getByRole("region", { name: "Conversation with Zu" });
    const width = await conversation.evaluate((element) => element.getBoundingClientRect().width);
    expect(width).toBeLessThanOrEqual(720);

    // Every mission done: the card says so and the reward lights up.
    const missions = day.getByRole("region", { name: "Missions done" });
    await expect(missions).toContainText("3/3");
    await expect(missions).toContainText("You earned +50 Brain Power.");
    await expect(missions.getByRole("button", { name: "+50 Brain Power" })).toBeVisible();

    // The buddy's own rows: what it remembers and the week, a tap away.
    await expect(day.getByRole("link", { name: /^What Zu remembers/u })).toHaveAttribute(
      "href",
      "/settings/memory",
    );

    await expect(day.getByRole("link", { name: "Weekly summary" })).toHaveAttribute(
      "href",
      "/logbook",
    );

    // On a laptop the conversation is ready to type into.
    await expect(conversation.getByRole("textbox", { name: "Message Zu" })).toBeFocused();
    await expectAccessibleScreen(page, "the buddy tab beside its day");
    await page.context().close();

    // Reading the buddy never builds today's session, so the missions say when they start.
    const { goal, user } = await createGoalLearner();
    await learningProfileFixture({ activeGoalId: goal.id, buddyKind: "otto", userId: user.id });

    const fresh = await openAs(browser, user);
    await stubBuddy({ answers: [], page: fresh });
    await fresh.goto("/buddy");

    await expect(
      fresh
        .getByRole("complementary", { name: "Otto today" })
        .getByText("Today's missions start with today's session."),
    ).toBeVisible();

    await fresh.context().close();
  });

  test("on a phone says what each mission still asks, asks the buddy in its own composer, and keeps a new learner's first steps under the missions", async ({
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
        { anchor: {}, firstStep: true, kind: "askBuddy", opens: { kind: "buddy" }, total: 1 },
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
    await page.setViewportSize(PHONE);
    const asked = await stubBuddy({ answers: [], page });
    await page.goto("/buddy");

    // Each mission says what it still asks and about how long, in one line; the Trickster says
    // what he waits for.
    const sheet = await openBuddyToday(page, "Zu");
    const missions = sheet.getByRole("region", { name: "Today's missions" });

    await expect(missions.getByRole("listitem")).toHaveText([
      /^Ask Zu something, write your question\s*Anything about today's lessons\s·\s~2\smin$/u,
      /^Have a call, choose a call\s*Quick call · Arriving\s·\s~2\smin$/u,
      /^Practice a pattern, go to the pattern\s*Past simple with did\s·\s~3\smin$/u,
      /^Pronunciation, go to pronunciation practice\s*Due today\s·\s~3\smin$/u,
      /^Take on the Trickster, after today's lessons\s*After today's lessons\s·\s5\smin$/u,
    ]);

    await expect(missions.getByRole("link", { name: /^Have a call\b/u })).toHaveAttribute(
      "href",
      `/content/units/${chapterId}`,
    );

    // A new learner's first steps sit under the missions: the ones the day offers or that are
    // there any time open where they're done, and the rest say when they come.
    const steps = sheet.getByRole("region", { name: "First steps" });
    await expect(steps).toContainText("0/4");

    await expect(steps.getByRole("listitem")).toHaveText([
      /^Finish your first lesson, go to today's new lesson\s*Anytime$/u,
      /^Do your first review, go to today's review\s*Anytime$/u,
      /^Fix your first mistake\s*The day after your first mistake$/u,
      /^Ask Zu something, write your question\s*One of today's missions$/u,
    ]);

    await expect(
      steps
        .getByRole("listitem")
        .filter({ hasText: /^Fix your first mistake/u })
        .getByRole("button"),
    ).toHaveCount(0);

    await expectAccessibleScreen(page, "the buddy's day with first steps");
    await missions.screenshot({ path: test.info().outputPath("buddy-day-missions-phone.png") });
    await steps.screenshot({ path: test.info().outputPath("buddy-day-first-steps-phone.png") });

    // Asking the buddy from its own day is the composer right there: it takes focus inside the
    // tap itself (when a phone raises its keyboard), the sheet closes onto it, and nothing is
    // asked until the learner sends.
    const focusedByTap = page.evaluate(
      () =>
        new Promise<string>((resolve) => {
          globalThis.addEventListener(
            "click",
            () => resolve(document.activeElement?.tagName ?? ""),
            { once: true },
          );
        }),
    );

    await missions.getByRole("button", { name: /^Ask Zu something\b/u }).click();
    await expect(focusedByTap).resolves.toBe("TEXTAREA");
    await expect(sheet).toBeHidden();
    await expect(page.getByRole("textbox", { name: "Message Zu" })).toBeFocused();
    expect(asked).toStrictEqual([]);

    // A lesson finished checks its step off; nothing else changes.
    await learningEventFixture({ startedAt: new Date(), userId: user.id });
    await page.reload();

    const later = await openBuddyToday(page, "Zu");
    const after = later.getByRole("region", { name: "First steps" });
    await expect(after).toContainText("1/4");

    await expect(after.getByRole("listitem").first()).toHaveText("Finish your first lesson, done");
    await page.keyboard.press("Escape");

    // The last steps done today: the list stays, every step checked, and says so for the day.
    const thread = await prisma.lessonQuestionThread.create({
      data: { goalId: goal.id, kind: "plan", userId: user.id },
    });

    await Promise.all([
      learningEventFixture({ kind: "review", startedAt: new Date(), userId: user.id }),
      mistakeFixture({ fixedAt: new Date(), status: "fixed", userId: user.id }),
      prisma.lessonQuestion.create({
        data: {
          contextKind: "plan",
          contextSnapshot: {},
          question: "What should I study first?",
          requestFingerprint: `first-steps-${user.id}`,
          requestId: randomUUID(),
          threadId: thread.id,
        },
      }),
    ]);

    await page.reload();

    const lastSheet = await openBuddyToday(page, "Zu");
    const finished = lastSheet.getByRole("region", { name: "First steps" });

    await expect(finished).toContainText("4/4");
    await expect(finished.getByText("You've tried everything your plan uses.")).toBeVisible();
    await expect(finished.getByRole("listitem").filter({ hasText: /, done$/u })).toHaveCount(4);
    await finished.screenshot({ path: test.info().outputPath("first-steps-finished-phone.png") });
    await page.context().close();
  });

  test("a learner without a goal tells the buddy what they want to learn, and their plan's setup opens on it", async ({
    userWithoutProgress: page,
  }) => {
    const goal = `understand quantum physics ${randomUUID().slice(0, 8)}`;

    await page.goto("/buddy");
    const main = page.getByRole("main");

    // No dead end: the buddy says what it does with a goal and takes one right here.
    await expect(main.getByText(/What do you want to learn, and by when\?/u)).toBeVisible();
    await expect(main.getByRole("list", { name: "Examples" }).getByRole("button")).toHaveCount(3);
    await expectAccessibleScreen(page, "the buddy without a goal");

    await main.getByRole("button", { exact: true, name: "Understand quantum physics" }).click();

    await expect(main.getByRole("textbox", { name: "Your goal" })).toHaveValue(
      "Understand quantum physics",
    );

    await expect(page).toHaveURL(/\/buddy$/u);

    await main.getByRole("textbox", { name: "Your goal" }).fill(goal);
    await main.getByRole("button", { name: /^Build my plan/u }).click();

    await expect(page).toHaveURL(`/start?goal=${encodeURIComponent(goal)}`);
    await expect(page.getByRole("textbox", { name: "I want to" })).toHaveValue(goal);
  });

  for (const tap of ["before", "after"] as const) {
    test(`a goal typed before the buddy's page is ready is sent by a tap ${tap} it is`, async ({
      userWithoutProgress: page,
    }) => {
      const goal = `understand quantum physics ${randomUUID().slice(0, 8)}`;

      // A slow device: the buddy shows its goal box before the box's code has arrived.
      const code = await holdCodeWith({ marker: "buddy-goal-start", page });
      await page.goto("/buddy", { waitUntil: "domcontentloaded" });
      await expect.poll(code.held).toBe(true);
      const main = page.getByRole("main");
      await main.getByRole("textbox", { name: "Your goal" }).fill(goal);
      const send = main.getByRole("button", { name: /^Build my plan/u });
      await expect(isHydrated(send)).resolves.toBe(false);

      if (tap === "before") {
        await send.click();
      }

      code.release();

      if (tap === "after") {
        await expectHydrated(send);
        await send.click();
      }

      await expect(page).toHaveURL(`/start?goal=${encodeURIComponent(goal)}`);
      await expect(page.getByRole("textbox", { name: "I want to" })).toHaveValue(goal);
    });
  }

  test("on a wide screen the buddy's day stays beside a readable thread and the composer opens focused", async ({
    browser,
  }) => {
    const user = await createBuddyLearner();
    const page = await openAs(browser, user);

    try {
      await page.setViewportSize({ height: 900, width: 1440 });
      await stubBuddy({ answers: [], page });
      await page.goto("/buddy");

      const thread = page.getByRole("region", { name: "Conversation with Zu" });
      const day = page.getByRole("complementary", { name: "Zu today" });
      await expect(thread).toBeVisible();
      await expect(day).toBeVisible();
      await expect(day.getByRole("region", { name: "Today's missions" })).toBeVisible();

      await expect(day.getByRole("link", { name: /^What Zu remembers/u })).toHaveAttribute(
        "href",
        "/settings/memory",
      );

      await expect(thread.getByRole("textbox", { name: "Message Zu" })).toBeFocused();

      const [threadBox, dayBox] = await Promise.all([thread.boundingBox(), day.boundingBox()]);
      expect(threadBox!.width).toBeLessThanOrEqual(720);
      expect(threadBox!.x + threadBox!.width).toBeLessThan(dayBox!.x);
    } finally {
      await page.context().close();
    }
  });

  test("a learner starts with Zu, chooses a buddy from the tab, then renames it", async ({
    browser,
  }) => {
    const { user } = await createGoalLearner();
    const page = await openAs(browser, user);
    const main = page.getByRole("main");
    await stubBuddy({ answers: [], page });

    await page.goto("/buddy");

    // Until a choice is saved, Zu is the buddy, and the conversation already works.
    await expect(main.getByRole("heading", { level: 1, name: "Zu" })).toBeVisible();
    await expect(main.getByText(/^Hi! I'm Zu, your AI study buddy\./u)).toBeVisible();

    const tabs = page.getByRole("navigation", { name: "Learning tabs" });
    await expect(tabs.getByRole("link", { name: "Zu" })).toHaveAttribute("aria-current", "page");

    await main.getByRole("button", { name: /^Choose your buddy/u }).click();

    const editor = page.getByRole("dialog", { name: "Your buddy" });
    await expect(editor.getByRole("radio", { name: /Zu/u })).toBeChecked();
    await expectAccessibleScreen(page, "picking a buddy");

    await editor.getByRole("radio", { name: /Beep/u }).click();
    await editor.getByLabel("Name").fill("Bolt");
    await editor.getByRole("button", { name: "Save" }).click();

    await expect(main.getByRole("heading", { level: 1, name: "Bolt" })).toBeVisible();
    await expect(tabs.getByRole("link", { name: "Bolt" })).toHaveAttribute("aria-current", "page");
    await expect(main.getByRole("button", { name: /^Choose your buddy/u })).toHaveCount(0);

    await expect
      .poll(() => readBuddy(user.id))
      .toStrictEqual({ buddyGlasses: "round", buddyKind: "beep", buddyName: "Bolt" });

    // Its "…" changes the buddy in place, without leaving the tab.
    await main.getByRole("button", { name: "More about Bolt" }).click();
    await page.getByRole("menuitem", { name: "Change Bolt" }).click();

    await expect(editor).toBeVisible();

    await editor.getByLabel("Name").fill("Pip");
    await editor.getByRole("button", { name: "Save" }).click();

    await expect(editor).toBeHidden();
    await expect(main.getByRole("heading", { level: 1, name: "Pip" })).toBeVisible();
    await expect(tabs.getByRole("link", { name: "Pip" })).toBeVisible();

    await expect
      .poll(() => readBuddy(user.id))
      .toStrictEqual({ buddyGlasses: "round", buddyKind: "beep", buddyName: "Pip" });

    await page.context().close();
  });

  test("switching goals shows the new goal's conversation", async ({ browser }) => {
    const { goal: first, user } = await createGoalLearner();
    const second = await goalFixture({ timezone: "UTC", title: "Learn to cook", userId: user.id });
    await Promise.all([planFixture({ goalId: first.id }), planFixture({ goalId: second.id })]);

    const page = await openAs(browser, user);

    const asked = new Map([
      [first.id, "How do I turn a fraction into a percentage?"],
      [second.id, "How long do I rest a steak?"],
    ]);

    // Each goal's thread holds the question asked about it.
    await page.route(/\/v1\/goals\/(?<goalId>[^/]+)\/plan\/questions/u, async (route) => {
      const goalId = /\/v1\/goals\/(?<goalId>[^/]+)\//u.exec(route.request().url())?.groups?.goalId;
      const now = new Date().toISOString();

      await route.fulfill({
        json: {
          hasMore: false,
          id: randomUUID(),
          lessonId: null,
          nextCursor: null,
          questions: [
            {
              answer: "Here's how.",
              context: { kind: "plan" },
              createdAt: now,
              id: randomUUID(),
              planChange: null,
              question: asked.get(goalId ?? "") ?? "",
              status: "completed",
              toolOffer: null,
              updatedAt: now,
            },
          ],
        },
      });
    });

    await page.goto("/buddy");

    const conversation = page.getByRole("main").getByRole("log");
    await expect(conversation.getByText(asked.get(first.id) ?? "")).toBeVisible();

    await page.getByRole("button", { name: /Current goal: Learn percentages/u }).click();
    await page.getByRole("menuitemradio", { name: "Learn to cook" }).click();

    await expect(page.getByRole("button", { name: /Current goal: Learn to cook/u })).toBeVisible();
    await expect(conversation.getByText(asked.get(second.id) ?? "")).toBeVisible();
    await expect(conversation.getByText(asked.get(first.id) ?? "")).toHaveCount(0);

    await page.context().close();
  });

  test("the buddy offers the app's own tools: a chapter's test, choosing where to focus, a practice call and a mock exam", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "buddy" }, async ({ page, user }) => {
      const chapterId = randomUUID();

      const call = {
        character: { name: "Ana", role: "recruiter" },
        defaultMinutes: 2,
        limit: null,
        minutes: [1, 2, 3, 5],
        paused: false,
        plusMinutes: [],
      };

      await stubBuddy({
        answers: [
          {
            answer: "Take the test below: passing it skips what you already know.",
            toolOffer: {
              chapterId,
              chapterTitle: "Interview basics",
              goalId: user.goalId,
              kind: "chapterTest",
              lessonsLeft: 4,
            },
          },
          {
            answer: "Pick where the depth goes, or let a short test pick for you.",
            toolOffer: { goalId: user.goalId, kind: "chooseFocus" },
          },
          {
            answer: "Tap below for a short call out loud.",
            toolOffer: {
              call,
              chapterId,
              goalId: user.goalId,
              kind: "conversationCall",
              unitTitle: "Talking about your projects",
            },
          },
          {
            answer: "Pick a mock below and take it now.",
            toolOffer: {
              access: "open",
              goalId: user.goalId,
              kind: "mockExam",
              subjects: ["Matemática"],
            },
          },
        ],
        page,
      });

      await page.goto("/buddy");

      const conversation = page.getByRole("region", { name: "Conversation with Otto" });
      const composer = conversation.getByRole("textbox", { name: "Message Otto" });

      const send = conversation.getByRole("button", { name: "Send" });

      // The conversation reads its latest in the background as it opens; Send is ready after.
      const ask = async (question: string) => {
        await composer.fill(question);
        await expect(send).toBeEnabled();
        await composer.press("Enter");
      };

      await ask("These lessons are too easy");
      const chapterTest = conversation.getByRole("region", { name: "Test: Interview basics" });
      await expect(chapterTest).toContainText("Pass it to skip up to 4 lessons you already know.");
      await expect(chapterTest.getByRole("button", { name: "Take the test" })).toBeVisible();

      await ask("I don't know what to focus on");
      const focus = conversation.getByRole("region", { name: "Choose where to focus" });

      await expect(focus.getByRole("link", { name: "Choose" })).toHaveAttribute(
        "href",
        "/plan?focus=choose",
      );

      await ask("I want to practice speaking for my interview");
      const practice = conversation.getByRole("region", { name: "Talking about your projects" });
      await expect(practice).toContainText("A short call out loud with Ana, recruiter.");

      await ask("I want to take a mock exam");
      const mock = conversation.getByRole("region", { name: "Take a mock exam" });

      await expect(mock).toContainText(
        "Whenever you want: the full exam, half of it or one subject",
      );

      await expect(mock.getByRole("link", { name: "Choose" })).toHaveAttribute("href", "/mock/new");

      await expectAccessibleScreen(page, "the buddy's app tools");

      // The call's length is chosen in its sheet, from the keyboard too.
      await practice.getByRole("button", { name: "Practice a conversation" }).focus();
      await page.keyboard.press("Enter");
      const sheet = page.getByRole("dialog", { name: "Practice a conversation" });
      await expect(sheet.getByRole("radio", { name: "2 min" })).toBeChecked();
      await expect(sheet.getByRole("button", { name: "Start the call" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(sheet).toBeHidden();
    });
  });

  test("the buddy suggests the app's own features as cards, and shows the ones the plan doesn't include locked with what Plus unlocks", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "buddy" }, async ({ page, user }) => {
      const course = {
        brandSlug: "zoonk",
        description: "Chords, rhythm and your first songs.",
        id: randomUUID(),
        imageUrl: null,
        slug: "guitar",
        title: "Guitar",
      };

      await stubBuddy({
        answers: [
          {
            answer: "You can start it as a new goal below, or begin with the Guitar course.",
            toolOffer: {
              access: "open",
              course,
              goal: "Learn to play the guitar",
              kind: "startGoal",
            },
          },
          {
            answer: "The free plan follows one goal at a time.",
            toolOffer: {
              access: "plusRequired",
              course: null,
              goal: "Pass the INSS exam",
              kind: "startGoal",
            },
          },
          {
            answer: "Mock exams come with Plus.",
            toolOffer: {
              access: "plusRequired",
              goalId: user.goalId,
              kind: "mockExam",
              subjects: ["Matemática"],
            },
          },
          {
            answer: "Your notebook has them, with practice for each.",
            toolOffer: { goalId: user.goalId, kind: "mistakes", open: 3 },
          },
          { answer: "Here are your numbers.", toolOffer: { kind: "stats" } },
          {
            answer: "Your plan practices it every week.",
            toolOffer: {
              access: "open",
              cadence: "weekly",
              goalId: user.goalId,
              kind: "essay",
              subject: "Redação",
              subjectKey: "redacao",
            },
          },
        ],
        page,
      });

      await page.goto("/buddy");

      const conversation = page.getByRole("region", { name: "Conversation with Otto" });
      const composer = conversation.getByRole("textbox", { name: "Message Otto" });
      const send = conversation.getByRole("button", { name: "Send" });

      const ask = async (question: string) => {
        await composer.fill(question);
        await expect(send).toBeEnabled();
        await composer.press("Enter");
      };

      // Something outside this goal: a new goal with the learner's words, and the catalog's course.
      await ask("I also want to learn the guitar. Is there an app for that?");
      const newGoal = conversation.getByRole("region", { exact: true, name: "Start a new goal" });
      await expect(newGoal).toContainText("“Learn to play the guitar”");

      await expect(newGoal.getByRole("link", { name: "Start" })).toHaveAttribute(
        "href",
        "/start?goal=Learn%20to%20play%20the%20guitar",
      );

      await expect(newGoal.getByRole("link", { name: /Guitar/u })).toHaveAttribute(
        "href",
        "/b/zoonk/c/guitar",
      );

      // A plan that follows one goal at a time shows the card locked, never hidden.
      await ask("Can I study for the INSS exam too?");

      const lockedGoal = conversation.getByRole("region", {
        name: "Start a new goal Available with Plus",
      });

      await expect(lockedGoal).toContainText("“Pass the INSS exam”");
      await expect(lockedGoal).toContainText("The free plan follows one goal at a time");
      await expect(lockedGoal.getByRole("link", { name: "Start" })).toHaveCount(0);

      await expect(lockedGoal.getByRole("link", { name: "See Plus" })).toHaveAttribute(
        "href",
        "/subscription",
      );

      await ask("I want to take a mock exam");

      const lockedMock = conversation.getByRole("region", {
        name: "Take a mock exam Available with Plus",
      });

      await expect(lockedMock).toContainText(
        "Mock exams come with Plus: whenever you want, and every week in your plan.",
      );

      await expect(lockedMock.getByRole("link", { name: "Choose" })).toHaveCount(0);

      await ask("I keep making the same mistakes");
      const notebook = conversation.getByRole("region", { name: "Mistakes notebook" });
      await expect(notebook).toContainText("3 mistakes to fix");

      await expect(notebook.getByRole("link", { name: "Open" })).toHaveAttribute(
        "href",
        "/mistakes",
      );

      await ask("How am I doing in numbers?");
      const stats = conversation.getByRole("region", { name: "Statistics" });
      await expect(stats.getByRole("link", { name: "Open" })).toHaveAttribute("href", "/stats");

      await ask("I want to practise my essay");
      const essay = conversation.getByRole("region", { name: "Redação" });
      await expect(essay).toContainText("Practiced every week in your plan, each draft graded.");

      await expect(essay.getByRole("link", { name: "Open" })).toHaveAttribute(
        "href",
        "/plan/redacao",
      );

      await expectAccessibleScreen(page, "the buddy's feature cards");
    });
  });

  test("the buddy's answer links where it sends the learner, and the link opens there", async ({
    browser,
  }) => {
    const user = await createBuddyLearner();
    const page = await openAs(browser, user);

    await stubBuddy({
      answers: [
        {
          answer: "Open [your mistakes notebook](/mistakes), not [this site](https://example.com).",
          saved: "Open [your mistakes notebook](/mistakes), not this site.",
        },
      ],
      page,
    });

    await page.goto("/buddy");
    const conversation = page.getByRole("region", { name: "Conversation with Zu" });

    await conversation.getByRole("textbox", { name: "Message Zu" }).fill("Where are my mistakes?");
    await conversation.getByRole("button", { name: "Send" }).click();

    // The answer links only what the app gave it; anything else reads as its words.
    const notebook = conversation.getByRole("link", { name: "your mistakes notebook" });
    await expect(notebook).toHaveAttribute("href", "/mistakes");
    await expect(conversation.getByText("not this site.")).toBeVisible();
    await expect(conversation.getByRole("link", { name: "this site" })).toHaveCount(0);

    await notebook.click();
    await expect(page).toHaveURL(/\/mistakes$/u);
    await expect(page.getByRole("heading", { level: 1, name: "Mistakes notebook" })).toBeVisible();
  });

  test("the buddy answers a doubt and proposes a plan change that applies only on the learner's tap", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "buddy" }, async ({ page, user }) => {
      const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } });
      const { change, name: day, weekday } = await proposeFutureRestDay(plan.id);

      const asked = await stubBuddy({
        answers: [
          { answer: "**Superposition** means a particle is in many states until it's measured." },
          {
            answer: `Done: I prepared it. Tap Apply to free your ${day}s.`,
            planChange: toProposal(change),
          },
        ],
        page,
      });

      await page.goto("/buddy");

      const conversation = page.getByRole("region", { name: "Conversation with Otto" });
      await expect(conversation.getByText(/^Hi! I'm Otto, your AI study buddy\./u)).toBeVisible();

      // Three ways to start, sent with one tap.
      const suggestions = conversation.getByRole("list", { name: "Suggestions" });
      await expect(suggestions.getByRole("button")).toHaveCount(3);
      await suggestions.getByRole("button").first().click();

      await expect(conversation.getByText("Superposition", { exact: true })).toBeVisible();
      await expect(suggestions).toHaveCount(0);
      expect(asked).toHaveLength(1);

      // A plan change in the learner's own words comes back as a card; nothing changes yet.
      const composer = conversation.getByRole("textbox", { name: "Message Otto" });
      await composer.fill(`No studying on ${day}s`);
      await composer.press("Enter");

      const card = conversation.getByRole("region", { name: "Change to your plan" });
      await expect(card).toContainText(`${day}: rest day.`);
      await expect(composer).toHaveValue("");
      expect(asked[1]).toStrictEqual({ question: `No studying on ${day}s` });
      expect(await readChangeStatus(change.id)).toBe("proposed");
      await expectAccessibleScreen(page, "the buddy's conversation");

      const sessionSelect = {
        blocks: {
          orderBy: { position: "asc" },
          select: { id: true, lessonId: true, position: true, startedAt: true, status: true },
        },
        id: true,
        plannedMinutes: true,
        startedAt: true,
        status: true,
      } as const;

      const sessionBefore = await prisma.studySession.findFirstOrThrow({
        orderBy: { localDate: "desc" },
        select: sessionSelect,
        where: { goalId: user.goalId },
      });

      await card.getByRole("button", { name: "Apply" }).click();

      // A future rest day leaves this session as it was; the card never claims it changed today.
      await expect(card.getByRole("status")).toHaveText("Your plan follows it from now on.");

      await expect(card).toBeFocused();
      await expect.poll(() => readChangeStatus(change.id)).toBe("applied");

      await expect(
        prisma.studySession.findUniqueOrThrow({
          select: sessionSelect,
          where: { id: sessionBefore.id },
        }),
      ).resolves.toStrictEqual(sessionBefore);

      await expect
        .poll(async () => {
          const settings = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
          return (settings.settings as { weekdayMinutes?: number[] }).weekdayMinutes?.[weekday];
        })
        .toBe(0);

      // While it's the plan's latest change, it can be undone right there: the card asks again,
      // as it did before Apply.
      await card.getByRole("button", { name: "Undo" }).click();
      await expect(card.getByRole("button", { name: "Apply" })).toBeVisible();
      await expect(card).toBeFocused();
      await expect.poll(() => readChangeStatus(change.id)).toBe("proposed");
    });
  });

  test("every proposal stays answerable until a newer one changes the same thing", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "buddy" }, async ({ page, user }) => {
      const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } });

      const proposal = (operations: PlanChangeView["operations"], reason: string) =>
        planChangeFixture({
          kind: "edited",
          payload: { operations, source: "planEdit" },
          planId: plan.id,
          reason,
          status: "proposed",
        });

      const saturdays = await proposal(
        [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [SATURDAY] }],
        "Saturdays are off.",
      );

      const harder = await proposal(
        [{ bias: "harder", kind: "setDifficultyBias" }],
        "Lessons get harder.",
      );

      // Core replaced the Saturday change when the hour a day changed the same thing: the time.
      const hour = await proposal([{ kind: "setDailyMinutes", minutes: 60 }], "One hour a day.");
      await prisma.planChange.update({ data: { status: "replaced" }, where: { id: saturdays.id } });

      await stubBuddy({
        answers: [
          { answer: "Tap Apply to free your Saturdays.", planChange: toProposal(saturdays) },
          { answer: "Tap Apply for harder lessons.", planChange: toProposal(harder) },
          {
            answer: "Tap Apply for an hour a day.",
            planChange: toProposal(hour),
            replaced: [saturdays.id],
          },
        ],
        page,
      });

      await page.goto("/buddy");

      const conversation = page.getByRole("region", { name: "Conversation with Otto" });
      const composer = conversation.getByRole("textbox", { name: "Message Otto" });

      const cards = conversation.getByRole("region", { name: "Change to your plan" });
      const send = conversation.getByRole("button", { name: "Send" });

      // The conversation reads its latest in the background as it opens; Send is ready after.
      const ask = async (question: string, answered: number) => {
        await composer.fill(question);
        await expect(send).toBeEnabled();
        await composer.press("Enter");
        await expect(cards).toHaveCount(answered);
      };

      await ask("No studying on Saturdays", 1);
      await ask("Harder lessons", 2);
      await ask("One hour a day", 3);
      await expect(cards).toHaveCount(3);

      // The replaced one says so instead of offering Apply; the others still wait.
      await expect(cards.nth(0)).toContainText("A newer suggestion replaced this one.");
      await expect(cards.nth(0).getByRole("button", { name: "Apply" })).toHaveCount(0);
      await expect(cards.nth(1).getByRole("button", { name: "Apply" })).toBeVisible();
      await expect(cards.nth(2).getByRole("button", { name: "Apply" })).toBeVisible();

      // An earlier one is answered on its own, while the newest still waits.
      await cards.nth(1).getByRole("button", { name: "Apply" }).click();
      await expect.poll(() => readChangeStatus(harder.id)).toBe("applied");
      await expect(cards.nth(2).getByRole("button", { name: "Apply" })).toBeVisible();
      expect(await readChangeStatus(hour.id)).toBe("proposed");
    });
  });
});
