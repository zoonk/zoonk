import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { attemptFixture, learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { isJsonObject } from "@zoonk/utils/json";
import { type Page, expect, test } from "./fixtures";
import { type StreamEvent, followRun } from "./generation-run";
import { openUserAsGuest } from "./guest-session";
import { tabTo } from "./keyboard-focus";
import { continueToLastStep, continueToStep } from "./result-steps";
import {
  LESSON_TITLE,
  answerRight,
  checkWithEnter,
  continueWithEnter,
  createStudyDay,
  openAs,
  writeStudyLesson,
} from "./study-day";

/** The next step reads the session again every 5 seconds while its lesson is written. */
const WAITING_REFRESH_MS = 5000;

/**
 * A moment sits under its header's heading: the lesson's title in the player, "Today's session"
 * between a session's blocks.
 */
async function expectMoment(page: Page, title: string) {
  await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
  await expect(page.getByRole("main").getByText(/^\+\d+ Brain Power$/u)).toBeVisible();
}

/**
 * What Continue opens, named right above it. The screen before keeps its moment hidden (Next keeps
 * a route it left in the page, hidden, for going back), so only the one in view counts.
 */
async function expectUpNext(page: Page, title: string) {
  const next = page.locator('[data-slot="study-moment-next"]').filter({ visible: true });
  await expect(next.getByText("Up next", { exact: true })).toBeVisible();
  await expect(next.getByText(title, { exact: true })).toBeVisible();
}

/**
 * Stands in for the API turning the learner's request for a lesson down, the way it does once
 * their plan's cap for new lessons is reached (see its `usageDecisionError`).
 */
async function refuseLessonWriting(
  page: Page,
  limit: { limit: number; period: "day" | "month" | "total"; tier: "free" | "guest" },
) {
  await page.route("**/v1/library/lessons/*/generations", (route) =>
    route.fulfill({
      json: {
        error: {
          code: "USAGE_LIMIT_REACHED",
          details: { limit: { ...limit, resource: "lessonStart" } },
          message: "This plan's limit is reached",
        },
      },
      status: limit.tier === "guest" ? 403 : 402,
    }),
  );
}

/**
 * A first-week day: placement is still unsure about a skill, so today's review opens with
 * one placement question about it, the way the session builder puts it first.
 */
async function createFirstWeekDay() {
  const day = await createStudyDay();
  const skill = await skillFixture({ name: `Ratios ${randomUUID()}` });

  const [item, review] = await Promise.all([
    itemFixture({ content: choiceItemContent(`Placement: ${randomUUID()}?`), skillId: skill.id }),
    prisma.studySessionBlock.findFirstOrThrow({
      where: { kind: "review", sessionId: day.session.id },
    }),
  ]);

  const payload = isJsonObject(review.payload) ? review.payload : {};

  await prisma.studySessionBlock.update({
    data: { payload: { ...payload, placementItemIds: [item.id] } },
    where: { id: review.id },
  });

  return day;
}

/** The placement question says what it's for and takes "I don't know yet"; the capsules follow. */
async function answerPlacement(page: Page) {
  await expect(page).toHaveURL((url) => url.pathname === "/session");
  await expect(page.getByRole("heading", { name: /^Placement:/u })).toBeVisible();

  await expect(
    page.getByText("Fine-tuning your plan. A miss here is never saved as a mistake."),
  ).toBeVisible();

  await page.getByRole("button", { name: "I don't know yet" }).click();
  await expect(page.getByRole("region", { name: "Answer feedback" })).toBeVisible();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: /^Capsule one/u })).toBeVisible();
  await expect(page.getByText("Fine-tuning your plan", { exact: false })).toBeHidden();
}

/**
 * Both capsules from the keyboard, with the first one and its feedback scanned. The first was
 * answered wrong days ago: before the answer the line says only when, since the earlier answer
 * could give it away; after it, the earlier answer in quotes.
 */
async function playCapsules(page: Page) {
  await expect(page.getByRole("heading", { name: /^Capsule one/u })).toBeVisible();
  await expect(page.getByText(/^You saw this on \w+ \d+\.$/u)).toBeVisible();
  await expect(page.getByText(/you answered/u)).toBeHidden();

  // One header, the same as a lesson's: the block's name, how far into it, one bar.
  await expect(page.getByRole("heading", { level: 1, name: "Quick review" })).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveCount(1);
  await expect(page.getByRole("progressbar", { name: /^Question \d of \d$/u })).toBeVisible();

  await expectAccessibleScreen(page, "a capsule");

  // A number picks, as in the lesson; nothing is graded until Check (or Enter).
  await page.keyboard.press("1");
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(1);
  await expect(page.getByRole("region", { name: "Answer feedback" })).toBeHidden();
  await checkWithEnter(page);

  await expect(
    page.getByRole("region", { name: "Answer feedback" }).getByText("Correct!"),
  ).toBeVisible();

  await expect(page.getByText(/^On \w+ \d+ you answered “Wrong answer”\.$/u)).toBeVisible();
  await expectAccessibleScreen(page, "a capsule's feedback");
  await continueWithEnter(page);
  await answerRight(page, /^Capsule two/u);
}

async function playLesson(page: Page) {
  await expect(page).toHaveURL(/\/learn\/[\w-]+\?session=[\w-]+$/u);
  await expect(page.getByText('What does the electron "cloud" show?')).toBeVisible();

  // The lesson keeps one bar, its own; the day's progress waits for its moment.
  await expect(page.getByRole("progressbar")).toHaveCount(1);
  await page.keyboard.press("2");

  await expect(
    page.getByRole("radio", { name: "Where the electron is most likely to be found" }),
  ).toBeChecked();

  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Correct!" })).toBeVisible();
  await page.keyboard.press("Enter");

  await expectMoment(page, "Lesson complete");
  await expectUpNext(page, "Mixed practice");

  // The session's header takes the lesson's: the day's bar, not a second one under the title.
  await expect(page.getByRole("progressbar", { name: "2 of 3 done" })).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveCount(1);

  await page.getByRole("button", { name: /^Continue/u }).click();
}

/** The day's last block: its last answer goes straight to the summary, one tap fewer. */
async function playPractice(page: Page) {
  await expect(page).toHaveURL((url) => url.pathname === "/session");
  await answerRight(page, /^Practice one/u);
  await answerRight(page, /^Practice two/u);
}

test("reopening a fully answered block waits for Finish before completing the session", async ({
  browser,
}) => {
  const { session, user } = await createStudyDay({ reviewDone: true });

  const block = await prisma.studySessionBlock.findFirstOrThrow({
    where: { kind: "practice", sessionId: session.id },
  });

  const payload = block.payload as { itemIds: string[] };

  await Promise.all([
    prisma.studySessionBlock.updateMany({
      data: { status: "completed" },
      where: { kind: "learn", sessionId: session.id },
    }),
    prisma.studySessionBlock.update({
      data: { startedAt: new Date(), status: "active" },
      where: { id: block.id },
    }),
    ...payload.itemIds.map((itemId) =>
      attemptFixture({ itemId, studySessionId: session.id, userId: user.id }),
    ),
  ]);

  const page = await openAs(browser, user);
  await page.goto("/session");
  await expect(page.getByRole("button", { exact: true, name: "Finish" })).toBeVisible();

  await expect(
    prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
  ).resolves.toMatchObject({ status: "active" });

  await page.reload();

  // Enabled once the page is interactive, so Enter reaches it.
  await expect(page.getByRole("button", { exact: true, name: "Finish" })).toBeEnabled();

  await expect(
    prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
  ).resolves.toMatchObject({ status: "active" });

  await page.keyboard.press("Enter");

  await expect
    .poll(async () => {
      const saved = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } });
      return saved.status;
    })
    .toBe("completed");

  await page.context().close();
});

test.describe("Today's session", () => {
  test("a review's moment does not offer the next chapter's test after it was failed today", async ({
    browser,
  }) => {
    const { goal, lesson, session, user } = await createStudyDay();
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
    await page.getByRole("button", { name: /^Start/u }).click();
    await playCapsules(page);
    await expectMoment(page, "Review done");
    await expect(page.getByRole("button", { name: "Take the test" })).toHaveCount(0);
    await expect(page.getByRole("main").getByText("Already know this?")).toHaveCount(0);
    await page.context().close();
  });

  test("plays a full day by keyboard: placement, capsules, the lesson, practice and the summary", async ({
    browser,
  }) => {
    const { user } = await createFirstWeekDay();
    const page = await openAs(browser, user);
    await page.goto("/today");

    await tabTo(page, page.getByRole("button", { name: /^Start/u }));
    await page.keyboard.press("Enter");
    await answerPlacement(page);

    await playCapsules(page);
    await expectMoment(page, "Review done");

    // The moment: what it earned, the day's progress on the header's bar, and what's next right
    // above the button that opens it, with the day's queue beside it on a wide screen.
    await expectUpNext(page, LESSON_TITLE);
    await expect(page.getByRole("progressbar", { name: "1 of 3 done" })).toBeVisible();

    await expect(
      page.getByRole("complementary", { name: "Today's session" }).getByText(LESSON_TITLE),
    ).toBeVisible();

    await expectAccessibleScreen(page, "the capsules' moment");
    await page.keyboard.press("Enter");

    await playLesson(page);
    await playPractice(page);

    // The summary on one screen: the session done with its numbers, and on a wide screen what
    // it earned beside them.
    await expect(page.getByRole("heading", { level: 1, name: /^Done in /u })).toBeVisible();

    await expect(
      page
        .getByRole("main")
        .getByRole("listitem")
        .filter({ hasText: /^Right\b/u }),
    ).toHaveText(/^Right \d+\/\d+/u);

    await expectAccessibleScreen(page, "the session's summary");

    // Finishing both offered missions earns the full completion bonus, with no fix required.
    const earned = page.getByRole("complementary", { name: "Earned today" });
    await expect(earned.getByText(/Brain Power$/u)).toBeVisible();
    await expect(earned.getByText("+50", { exact: true })).toBeVisible();
    await expect(earned.getByText(/^\d+ right in a row$/u)).toBeVisible();

    // The main action keeps its 44px however the bar lays it out.
    const finish = page.getByRole("link", { name: "Finish" });
    await expect(finish).toBeVisible();
    const wideBox = await finish.boundingBox();
    expect(wideBox?.height).toBe(44);

    // On a phone what it earned beyond its Brain Power is a step of its own, with Back (← too).
    await page.setViewportSize({ height: 844, width: 390 });
    await continueToStep(page, /Brain Power$/u, { keyboard: true });
    await expect(page.getByRole("heading", { level: 1, name: /Brain Power$/u })).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByRole("heading", { level: 1, name: /Brain Power$/u })).toBeHidden();
    await continueToLastStep(page, { keyboard: true });

    // Finish is a link back to Today, and Enter follows it.
    await expect(finish).toBeVisible();
    const phoneBox = await finish.boundingBox();
    expect(phoneBox?.height).toBe(44);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/today$/u);
    await page.context().close();
  });

  test("stops for today between blocks: what's done counts and the rest picks up from Today", async ({
    browser,
  }) => {
    const { lesson, session, user } = await createStudyDay();
    const page = await openAs(browser, user);
    await page.goto("/today");

    await tabTo(page, page.getByRole("button", { name: /^Start/u }));
    await page.keyboard.press("Enter");
    await playCapsules(page);
    await expectMoment(page, "Review done");
    await page.getByRole("button", { name: "Stop for today" }).click();

    // What changed so far, said as a pause: nothing is skipped.
    await expect(page.getByRole("heading", { level: 1, name: "Done for now" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Study \d+ more minutes/u })).toBeHidden();
    await expect(page.getByText("Save your plan so it's here next time.")).toBeHidden();
    await expectAccessibleScreen(page, "the summary after stopping");

    const blocks = await prisma.studySessionBlock.findMany({
      orderBy: { position: "asc" },
      where: { sessionId: session.id },
    });

    expect(blocks.map((block) => block.status)).toStrictEqual(["completed", "pending", "pending"]);

    // Today picks the session up where it stopped.
    await page.getByRole("link", { name: "Finish" }).click();
    await expect(page).toHaveURL(/\/today$/u);
    await page.getByRole("button", { name: /^Continue/u }).click();

    await expect(page).toHaveURL(new RegExp(`/learn/${lesson.id}\\?session=`, "u"));
    await expect(page.getByText('What does the electron "cloud" show?')).toBeVisible();
    await page.context().close();
  });

  test("opens any block from Today's queue: the last one first counts, and Continue keeps the day's order", async ({
    browser,
  }) => {
    const { session, user } = await createStudyDay();
    const page = await openAs(browser, user);
    await page.goto("/today");

    const card = page.getByRole("region", { name: "Today's session" });
    await expect(card.locator('[data-slot="today-next"]')).toContainText(/^Quick review/u);

    // The day's last block, picked first: its row opens it, and the session plays that block.
    await card.getByRole("button", { exact: true, name: "Mixed practice" }).click();
    await expect(page).toHaveURL((url) => url.pathname === "/session");
    await answerRight(page, /^Practice one/u);
    await answerRight(page, /^Practice two/u);

    // Its moment says what's next in the day's order: the review the learner went past.
    await expectUpNext(page, "Quick review");

    const blocks = await prisma.studySessionBlock.findMany({
      orderBy: { position: "asc" },
      where: { sessionId: session.id },
    });

    expect(blocks.map((block) => block.status)).toStrictEqual(["pending", "pending", "completed"]);

    // Today shows it done, a row that opens nothing now, and Continue starts the day in order.
    await page.goto("/today");

    await expect(card.getByRole("list").getByRole("listitem")).toHaveText([
      /^Mixed practice, done/u,
      /^Quick review/u,
      /^Discounts/u,
    ]);

    await expect(card.getByRole("button", { name: /^Mixed practice/u })).toHaveCount(0);
    await expect(card.locator('[data-slot="today-next"]')).toContainText(/^Quick review/u);
    await card.getByRole("button", { name: /^Continue/u }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Quick review" })).toBeVisible();
    await page.context().close();
  });

  test("keeps going right after stopping, and offers 10 more minutes once the day is done", async ({
    browser,
  }) => {
    const { lesson, session, user } = await createStudyDay({ reviewDone: true });
    const page = await openAs(browser, user);
    await page.goto("/session");

    // Stopped by mistake: one tap picks the session up again.
    await page.getByRole("button", { name: "Stop for today" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Done for now" })).toBeVisible();
    await page.getByRole("button", { name: "Keep going" }).click();
    await expect(page).toHaveURL(new RegExp(`/learn/${lesson.id}\\?session=`, "u"));

    // The day ends with the lesson left for later and the practice done.
    await Promise.all([
      prisma.studySessionBlock.updateMany({
        data: { status: "skipped" },
        where: { kind: "learn", sessionId: session.id },
      }),
      prisma.studySessionBlock.updateMany({
        data: { status: "completed" },
        where: { kind: "practice", sessionId: session.id },
      }),
    ]);

    await page.goto("/session");

    await expect(page.getByRole("heading", { level: 1, name: /^Done in /u })).toBeVisible();
    await continueToLastStep(page);

    // Nothing new to practice, so the bonus time goes to the plan's lesson left earlier.
    await page.getByRole("button", { name: /^Study \d+ more minutes/u }).click();
    await expect(page).toHaveURL(new RegExp(`/learn/${lesson.id}\\?session=`, "u"));

    const extra = await prisma.studySessionBlock.findFirst({
      where: { position: 3, sessionId: session.id },
    });

    expect(extra).toMatchObject({ kind: "learn", lessonId: lesson.id, status: "active" });
    await page.context().close();
  });

  test("10 more minutes at the session's end goes straight into the bonus practice", async ({
    browser,
  }) => {
    const { lesson, session, user } = await createStudyDay({ reviewDone: true });

    const { skillId } = await prisma.lessonSkill.findFirstOrThrow({
      where: { lessonId: lesson.id },
    });

    // The lesson is done and taught a skill with a question left to practice; the practice is left.
    await Promise.all([
      prisma.studySessionBlock.updateMany({
        data: { status: "completed" },
        where: { kind: "learn", sessionId: session.id },
      }),
      learnerSkillFixture({ reps: 1, skillId, state: "learning", userId: user.id }),
      itemFixture({ content: choiceItemContent(`Bonus one: ${randomUUID()}?`), skillId }),
    ]);

    const page = await openAs(browser, user);
    await page.goto("/session");
    await page.getByRole("button", { name: /^Start/u }).click();
    await playPractice(page);

    await expect(page.getByRole("heading", { level: 1, name: /^Done in /u })).toBeVisible();
    await continueToLastStep(page);
    await page.getByRole("button", { name: /^Study \d+ more minutes/u }).click();

    // The learner asked for more, so the practice opens right here, not the pause after "Stop for today".
    await expect(page.getByRole("heading", { level: 1, name: "Bonus practice" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Done for now" })).toHaveCount(0);
    await answerRight(page, /^Bonus one/u);

    // Its last answer ends the day again.
    await expect(page.getByRole("heading", { level: 1, name: /^Done in /u })).toBeVisible();
    await expect(page.getByRole("button", { name: "Keep going" })).toHaveCount(0);
    await page.context().close();
  });

  test("asks a guest to save their plan when their session ends", async ({ browser }) => {
    const { user } = await createStudyDay({ reviewDone: true });
    const { page } = await openUserAsGuest(browser, user);
    await page.goto("/session");

    await page.getByRole("button", { name: "Stop for today" }).click();

    await expect(page.getByText("Save your plan so it's here next time.")).toBeVisible();

    await expect(page.getByRole("link", { name: "Create an account" })).toHaveAttribute(
      "href",
      /\/login$/u,
    );

    await page.context().close();
  });

  test("the next step is one card with its Start, and Escape leaves it for Today", async ({
    browser,
  }) => {
    const { user } = await createStudyDay({ reviewDone: true });
    const page = await openAs(browser, user);
    await page.goto("/session");

    await expect(page.getByText("Up next", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: LESSON_TITLE })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Start/u })).toBeVisible();

    // Nothing is open yet, so leaving loses nothing. Escape's listener attaches once the page is
    // interactive, which can come after its text shows, so the press retries until it leaves.
    await expect(async () => {
      await page.keyboard.press("Escape");
      await expect(page).toHaveURL(/\/today$/u, { timeout: 1000 });
    }).toPass();

    await page.context().close();
  });

  test("opens the lesson on its own once it's written", async ({ browser }) => {
    const { lesson, user } = await createStudyDay({ reviewDone: true, writtenLesson: false });

    const page = await openAs(browser, user);
    await page.clock.install();
    await page.goto("/session");

    await expect(
      page.getByText(
        "This lesson is being written for you. It's usually ready in about two minutes.",
      ),
    ).toBeVisible();

    await expectAccessibleScreen(page, "the session's next step while its lesson is written");

    // The API's run writes it meanwhile; it opens without a tap at the screen's next check.
    await writeStudyLesson(lesson.id);
    await page.clock.fastForward(WAITING_REFRESH_MS);

    await expect(page).toHaveURL(new RegExp(`/learn/${lesson.id}\\?session=`, "u"));
    await page.context().close();
  });

  test("shows the lesson's writing as it happens and opens it once written", async ({
    browser,
  }) => {
    const { lesson, user } = await createStudyDay({ reviewDone: true, writtenLesson: false });

    const runId = `e2e-session-lesson-${randomUUID()}`;

    // The run writing the lesson, as the API streams it.
    const events: StreamEvent[] = [
      { entityId: lesson.id, status: "started", step: "planLesson" },
      { entityId: lesson.id, status: "completed", step: "planLesson" },
      { entityId: lesson.id, status: "started", step: "writeLesson" },
    ];

    await prisma.lesson.update({
      data: { contentRunId: runId, contentStatus: "running" },
      where: { id: lesson.id },
    });

    const page = await openAs(browser, user);
    await followRun({ events, page, runId });
    await page.goto("/session");

    await expect(page.getByRole("progressbar", { name: "Writing your lesson" })).toBeVisible();

    await expect(
      page.getByRole("list", { name: "Writing your lesson" }).getByRole("listitem"),
    ).toHaveText([/^Planning the lesson, done/u, /^Writing the lesson, in progress/u]);

    await expect(
      page.getByRole("button", { name: "Do Mixed practice while you wait" }),
    ).toBeVisible();

    // The run says it's ready: the screen reads the session again and opens the lesson.
    await writeStudyLesson(lesson.id);
    events.push({ entityId: lesson.id, status: "completed", step: "lessonReady" });

    await expect(page).toHaveURL(new RegExp(`/learn/${lesson.id}\\?session=`, "u"));
    await page.context().close();
  });

  test("offers to ask again when writing the lesson stopped, and a ready block meanwhile", async ({
    browser,
  }) => {
    const { lesson, user } = await createStudyDay({ reviewDone: true, writtenLesson: false });

    await prisma.lesson.update({ data: { contentStatus: "failed" }, where: { id: lesson.id } });

    const page = await openAs(browser, user);
    await page.goto("/session");

    await expect(page.getByRole("alert").getByText("This didn't finish")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();

    // Never a dead end: the ready block can come first.
    await page.getByRole("button", { name: "Do Mixed practice while you wait" }).click();
    await answerRight(page, /^Practice one/u);
    await page.context().close();
  });

  test("a failed writing request stays on Today with an immediate retry", async ({ browser }) => {
    const { user } = await createStudyDay({ reviewDone: true, writtenLesson: false });
    const page = await openAs(browser, user);
    await page.route("**/v1/library/lessons/*/generations", (route) => route.abort());
    await page.goto("/today");
    await page.getByRole("button", { name: /^Continue/u }).click();

    await expect(
      page.getByRole("region", { name: "Today's session" }).getByRole("alert"),
    ).toHaveText("We couldn't open the next step. Try again.");

    await expect(page).toHaveURL(/\/today$/u);
    await page.context().close();
  });

  test("a Plus-only lesson response offers Plus instead of a writing spinner", async ({
    browser,
  }) => {
    const { user } = await createStudyDay({ reviewDone: true, writtenLesson: false });
    const page = await openAs(browser, user);

    await page.route("**/v1/library/lessons/*/generations", (route) =>
      route.fulfill({
        json: { error: { code: "PLUS_REQUIRED", message: "Plus required" } },
        status: 402,
      }),
    );

    await page.goto("/today");
    await page.getByRole("button", { name: /^Continue/u }).click();
    await expect(page.getByRole("link", { name: "See Plus" })).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Writing your lesson" })).toBeHidden();
    await page.context().close();
  });

  test("says why the lesson can't be written now instead of waiting", async ({ browser }) => {
    const { user } = await createStudyDay({ reviewDone: true, writtenLesson: false });
    const page = await openAs(browser, user);
    await refuseLessonWriting(page, { limit: 40, period: "month", tier: "free" });
    await page.goto("/today");

    await page.getByRole("button", { name: /^Continue/u }).click();

    await expect(
      page.getByText(
        "That's all the new lessons for this month. They open again next month, or get Plus to keep going now.",
      ),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: "See Plus" })).toHaveAttribute(
      "href",
      /\/subscription$/u,
    );

    await expect(page.getByRole("progressbar", { name: "Writing your lesson" })).toBeHidden();

    // Nothing to wait for: the ready block comes instead.
    await page.getByRole("button", { name: "Do Mixed practice instead" }).click();
    await answerRight(page, /^Practice one/u);
    await page.context().close();
  });

  test("asks a guest out of new lessons to create an account, straight from Today", async ({
    browser,
  }) => {
    const { lesson, user } = await createStudyDay({ reviewDone: true, writtenLesson: false });
    const { page } = await openUserAsGuest(browser, user);
    await refuseLessonWriting(page, { limit: 1, period: "total", tier: "guest" });
    await page.goto("/today");

    // The refusal must come from the browser's request, not compete with server preparation.
    await Promise.all([
      page.waitForRequest(
        (request) =>
          request.method() === "POST" &&
          new URL(request.url()).pathname === `/v1/library/lessons/${lesson.id}/generations`,
      ),
      page.getByRole("button", { name: /^Continue/u }).click(),
    ]);

    await expect(page).toHaveURL(
      (url) => url.pathname === "/session" && url.searchParams.get("limit") === "guest",
    );

    await expect(
      page.getByText(
        "You've taken the lessons you can try without an account. Create a free account to keep going.",
      ),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: "Create a free account" })).toHaveAttribute(
      "href",
      /\/login$/u,
    );

    await page.context().close();
  });

  test("says a set-aside lesson isn't available instead of offering to ask again", async ({
    browser,
  }) => {
    const { lesson, user } = await createStudyDay({ reviewDone: true, writtenLesson: false });

    await prisma.lesson.update({
      data: { contentStatus: "failed", setAsideAt: new Date() },
      where: { id: lesson.id },
    });

    const page = await openAs(browser, user);
    await page.goto("/session");

    await expect(page.getByText("This lesson isn't available")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Do Mixed practice instead" })).toBeVisible();
    await page.context().close();
  });
});
