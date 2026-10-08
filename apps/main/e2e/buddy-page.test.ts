import { randomUUID } from "node:crypto";
import { type Page } from "@playwright/test";
import {
  type LessonQuestionResource,
  type TutorToolOffer,
  createLessonQuestionInputSchema,
} from "@zoonk/core/lesson-questions/contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { goalFixture, planChangeFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { createGoalLearner } from "./checkpoint-fixtures";
import { expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";
import { openAs } from "./study-day";
import { fulfillTutorAnswer } from "./tutor-answer";

const STUDY_SECONDS = 600;
const FULL_MEAL_DAYS = [1, 2];
const SATURDAY = 6;

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
 * A learner with Zu who won a checkpoint (the Star glasses), had a full meal on two earlier days
 * and, today, finished the new lesson but not its review, with nothing to fix.
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

/** A learner with Zu whose session today already made a full meal: nothing left to do. */
async function createFullMealLearner() {
  const { goal, user } = await createGoalLearner();
  const today = toUTCMidnight(new Date());

  const [session] = await Promise.all([
    studySessionFixture({
      fullMealAt: new Date(),
      goalId: goal.id,
      localDate: today,
      userId: user.id,
    }),
    learningProfileFixture({ activeGoalId: goal.id, buddyKind: "zu", userId: user.id }),
  ]);

  await studySessionBlockFixture({
    kind: "learn",
    position: 0,
    sessionId: session.id,
    status: "completed",
  });

  return user;
}

/** Opens the tiles under the buddy's name: its Energy and today's missions, in a sheet. */
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
  toolOffer?: TutorToolOffer;
};

/**
 * Stands in for the goal's tutor routes in the browser, as the lesson tutor's tests do (the API
 * doesn't run here): an empty thread, each question stored as sent, and each answer streamed in
 * order, with the plan change it proposed or the app tool it offered as the API sends them. The API's own tests cover how
 * answers are written and saved.
 */
async function stubBuddy({ answers, page }: { answers: BuddyAnswer[]; page: Page }) {
  const asked: { question: string; suggested: boolean }[] = [];
  const queue = [...answers];

  await page.route(/\/v1\/goals\/[^/]+\/plan\/questions/u, async (route) => {
    const request = route.request();

    if (request.method() === "GET") {
      await route.fulfill({ body: "null", contentType: "application/json" });
      return;
    }

    const input = createLessonQuestionInputSchema.parse(request.postDataJSON());
    const now = new Date().toISOString();
    asked.push({ question: input.question, suggested: input.suggested === true });

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

    await route.fulfill({ json: question, status: 201 });
  });

  await page.route("**/v1/questions/*/answers", async (route) => {
    const next = queue.shift() ?? { answer: "Okay." };

    const parts = [
      ...(next.planChange ? [{ data: next.planChange, type: "data-plan-change" as const }] : []),
      ...(next.replaced
        ? [{ data: { ids: next.replaced }, type: "data-plan-changes-replaced" as const }]
        : []),
      ...(next.toolOffer ? [{ data: next.toolOffer, type: "data-tool-offer" as const }] : []),
    ];

    await fulfillTutorAnswer(route, next.answer, parts);
  });

  return asked;
}

/** A proposal as the conversation shows it, from the change core saved. */
function toProposal(change: { createdAt: Date; id: string; payload: unknown }): PlanChangeView {
  const { operations } = change.payload as Pick<PlanChangeView, "operations">;

  return {
    behind: null,
    canUndo: false,
    createdAt: change.createdAt.toISOString(),
    days: null,
    effect: null,
    id: change.id,
    kind: "edited",
    lessonsSkipped: 0,
    officialDate: null,
    operations,
    // A change read from the learner's words is said from what it does, never the model's words.
    reason: null,
    seen: false,
    source: "planEdit",
    status: "proposed",
    todaySession: null,
  };
}

test.describe("Buddy tab", () => {
  test("keeps the buddy's day to two tiles: Energy opening its page and missions in a sheet, glasses and the rest in its menu, and studying wakes it", async ({
    browser,
  }) => {
    const user = await createBuddyLearner();
    const page = await openAs(browser, user);
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
        .getByRole("link", { name: /^Zu\s*2 of 3 missions today$/u }),
    ).toHaveAttribute("aria-current", "page");

    // Before a day of study has passed there's no Energy to show: no empty meter, just when it starts.
    // Its tile still opens the Energy page; the missions tile opens the buddy's day.
    await expect(main.getByRole("link", { exact: true, name: "Energy" })).toHaveAttribute(
      "href",
      "/energy",
    );

    await expect(main.getByRole("button", { name: "2 of 3 missions" })).toBeVisible();
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

    const energyTile = main.getByRole("link", { name: /^Energy \d+%$/u });
    await expect(energyTile).toHaveAttribute("href", "/energy");
    await expect(main.getByRole("button", { name: "2 of 3 missions" })).toBeVisible();

    const today = await openBuddyToday(page, "Zu");
    const energy = today.getByRole("link", { name: /^Energy/u });

    await expect(energy).toContainText("Zu took a nap. Anything you learn wakes it up.");
    await expect(energy).toHaveAttribute("href", "/energy");

    const missions = today.getByRole("region", { name: "Today's missions" });
    await expect(missions.getByText("2 of 3")).toBeVisible();

    // A mission done says nothing more than its check; one to do says what's left.
    await expect(missions.getByRole("listitem")).toHaveText([
      /^Review\s*0 of 1 reviews\s*To do$/u,
      /^Something new\s*Done$/u,
      /^Fix a mistake\s*Nothing due today\. It still counts\.\s*Done$/u,
    ]);

    await expect(missions.getByText("All three make a full meal: +50 Brain Power.")).toBeVisible();
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

    // Statistics open from the account menu and the level in the top bar, not from here.
    await expect(page.getByRole("menuitem", { name: "Statistics" })).toHaveCount(0);

    await page.getByRole("menuitem", { name: /^Glasses\s*2 of 6$/u }).click();

    const sheet = page.getByRole("dialog", { name: "Glasses" });
    await expect(sheet).toBeVisible();

    // Locked pairs say how they're earned and how far along the learner is.
    await expect(sheet.getByRole("radio", { name: /Cat-eye\s*2 of 7 full meals/u })).toBeDisabled();

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

    // The Energy tile opens the Energy page, from the keyboard too.
    await page.keyboard.press("Escape");
    await expect(awake).toBeHidden();
    await energyTile.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/energy$/u);
    await expect(page.getByRole("heading", { level: 1, name: "Energy" })).toBeVisible();
    await page.context().close();
  });

  test("a full meal says it's done, and missions wait for a session that doesn't exist yet", async ({
    browser,
  }) => {
    const fed = await createFullMealLearner();
    const page = await openAs(browser, fed);
    await stubBuddy({ answers: [], page });

    await page.goto("/buddy");

    await expect(
      page.getByRole("main").getByRole("button", { name: /3 of 3 missions$/u }),
    ).toBeVisible();

    const fedToday = await openBuddyToday(page, "Zu");
    const missions = fedToday.getByRole("region", { name: "Today's missions" });

    await expect(missions.getByText("3 of 3")).toBeVisible();
    await expect(missions.getByText("Full meal! +50 Brain Power")).toBeVisible();
    await page.context().close();

    // Reading the buddy never builds today's session, so the missions say when they start.
    const { goal, user } = await createGoalLearner();
    await learningProfileFixture({ activeGoalId: goal.id, buddyKind: "otto", userId: user.id });

    const fresh = await openAs(browser, user);
    await stubBuddy({ answers: [], page: fresh });
    await fresh.goto("/buddy");

    const freshToday = await openBuddyToday(fresh, "Otto");

    await expect(
      freshToday
        .getByRole("region", { name: "Today's missions" })
        .getByText("Today's missions start with today's session."),
    ).toBeVisible();

    await fresh.context().close();
  });

  test("a learner without a buddy talks to a plain one, picks a buddy from the tab, then renames it", async ({
    browser,
  }) => {
    const { user } = await createGoalLearner();
    const page = await openAs(browser, user);
    const main = page.getByRole("main");
    await stubBuddy({ answers: [], page });

    await page.goto("/buddy");

    // Until one is picked, the buddy is just "Buddy", and the conversation already works.
    await expect(main.getByRole("heading", { level: 1, name: "Buddy" })).toBeVisible();
    await expect(main.getByText(/^Hi! I'm your AI study buddy\./u)).toBeVisible();

    const tabs = page.getByRole("navigation", { name: "Learning tabs" });
    await expect(tabs.getByRole("link", { name: "Buddy" })).toHaveAttribute("aria-current", "page");

    await main.getByRole("button", { name: /^Pick your buddy/u }).click();

    const editor = page.getByRole("dialog", { name: "Your buddy" });
    await expect(editor.getByRole("radio", { name: /Zu/u })).toBeChecked();
    await expectAccessibleScreen(page, "picking a buddy");

    await editor.getByRole("radio", { name: /Beep/u }).click();
    await editor.getByLabel("Name").fill("Bolt");
    await editor.getByRole("button", { name: "Save" }).click();

    await expect(main.getByRole("heading", { level: 1, name: "Bolt" })).toBeVisible();
    await expect(tabs.getByRole("link", { name: "Bolt" })).toHaveAttribute("aria-current", "page");
    await expect(main.getByRole("button", { name: /^Pick your buddy/u })).toHaveCount(0);

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
        "/journey?focus=choose",
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
        "/journey/redacao",
      );

      await expectAccessibleScreen(page, "the buddy's feature cards");
    });
  });

  test("the buddy answers a doubt and proposes a plan change that applies only on the learner's tap", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "buddy" }, async ({ page, user }) => {
      const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: user.goalId } });

      const change = await planChangeFixture({
        kind: "edited",
        payload: {
          operations: [{ kind: "setWeekdayMinutes", minutes: 0, weekdays: [SATURDAY] }],
          source: "planEdit",
        },
        planId: plan.id,
        reason: "Saturdays are off.",
        status: "proposed",
      });

      const asked = await stubBuddy({
        answers: [
          { answer: "**Superposition** means a particle is in many states until it's measured." },
          {
            answer: "Done: I prepared it. Tap Apply to free your Saturdays.",
            planChange: toProposal(change),
          },
        ],
        page,
      });

      await page.goto("/buddy");

      const conversation = page.getByRole("region", { name: "Conversation with Otto" });
      await expect(conversation.getByText(/^Hi! I'm Otto, your AI tutor\./u)).toBeVisible();

      // Three ways to start, sent with one tap.
      const suggestions = conversation.getByRole("list", { name: "Suggestions" });
      await expect(suggestions.getByRole("button")).toHaveCount(3);
      await suggestions.getByRole("button").first().click();

      await expect(conversation.getByText("Superposition", { exact: true })).toBeVisible();
      await expect(suggestions).toHaveCount(0);
      expect(asked).toHaveLength(1);
      expect(asked[0]?.suggested).toBe(true);

      // A plan change in the learner's own words comes back as a card; nothing changes yet.
      const composer = conversation.getByRole("textbox", { name: "Message Otto" });
      await composer.fill("No studying on Saturdays");
      await composer.press("Enter");

      const card = conversation.getByRole("region", { name: "Change to your plan" });
      await expect(card).toContainText("Saturday: rest day.");
      await expect(composer).toHaveValue("");
      expect(asked[1]).toStrictEqual({ question: "No studying on Saturdays", suggested: false });
      expect(await readChangeStatus(change.id)).toBe("proposed");
      await expectAccessibleScreen(page, "the buddy's conversation");

      await card.getByRole("button", { name: "Apply" }).click();

      // The answer shows where the buttons were, and focus stays on the card.
      await expect(card.getByRole("status")).toHaveText(
        "It's in your plan, and today's session follows it.",
      );

      await expect(card).toBeFocused();
      await expect.poll(() => readChangeStatus(change.id)).toBe("applied");

      await expect
        .poll(async () => {
          const settings = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
          return (settings.settings as { weekdayMinutes?: number[] }).weekdayMinutes?.[SATURDAY];
        })
        .toBe(0);

      // While it's the plan's latest change, it can be undone right there.
      await card.getByRole("button", { name: "Undo" }).click();
      await expect(card.getByRole("status")).toHaveText("Undone. Your plan is back as it was.");
      await expect.poll(() => readChangeStatus(change.id)).toBe("undone");
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
