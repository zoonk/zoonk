import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { isJsonObject } from "@zoonk/utils/json";
import { type Page, expect, test } from "./fixtures";
import { type StreamEvent, followRun } from "./generation-run";
import { tabTo } from "./keyboard-focus";
import { continueToLastStep, continueToStep } from "./result-steps";
import {
  LESSON_TITLE,
  answerRight,
  continueWithEnter,
  createStudyDay,
  openAs,
  writeStudyLesson,
} from "./study-day";

/** The next step reads the session again every 5 seconds while its lesson is written. */
const WAITING_REFRESH_MS = 5000;

/** A lesson's moment sits under the player's heading (the lesson's title); a block's is the page's. */
async function expectMoment(page: Page, title: string, { level = 1 }: { level?: 1 | 2 } = {}) {
  await expect(page.getByRole("heading", { level, name: title })).toBeVisible();
  await expect(page.getByRole("main").getByText("Brain Power")).toBeVisible();
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
  await expect(page).toHaveURL(/\/session$/u);
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
  await page.keyboard.press("1");

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

  await expectMoment(page, "Lesson complete", { level: 2 });
  await expectUpNext(page, "Mixed practice");

  await expect(
    page.getByRole("progressbar", { name: "Today's session: 2 of 3 done" }),
  ).toBeVisible();

  await page.getByRole("button", { name: /^Continue/u }).click();
}

/** The day's last block: its last answer goes straight to the summary, one tap fewer. */
async function playPractice(page: Page) {
  await expect(page).toHaveURL(/\/session$/u);
  await answerRight(page, /^Practice one/u);
  await answerRight(page, /^Practice two/u);
}

test.describe("Today's session", () => {
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

    // The moment: what it earned, the day's progress on its bar, and what's next right above
    // the button that opens it.
    await expectUpNext(page, LESSON_TITLE);

    await expect(
      page.getByRole("progressbar", { name: "Today's session: 1 of 3 done" }),
    ).toBeVisible();

    await expectAccessibleScreen(page, "the capsules' moment");
    await page.keyboard.press("Enter");

    await playLesson(page);
    await playPractice(page);

    // The summary says one thing at a time: the session done with its numbers first.
    await expect(page.getByRole("heading", { level: 1, name: "Session complete" })).toBeVisible();
    await expect(page.getByText(/^\d+ questions$/u)).toBeVisible();
    await expectAccessibleScreen(page, "the session's summary");

    // A review, something new and nothing to fix: the missions make a full meal.
    await continueToStep(page, /Brain Power$/u, { keyboard: true });
    await expect(page.getByRole("heading", { level: 1, name: /Brain Power$/u })).toBeFocused();
    await expect(page.getByText("Full meal", { exact: true })).toBeVisible();
    await expect(page.getByText(/^\d+ right in a row$/u)).toBeVisible();

    // Back goes to the step before, by the arrow key too; the last step's Finish goes to Today.
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByRole("heading", { level: 1, name: /Brain Power$/u })).toBeHidden();
    await continueToLastStep(page, { keyboard: true });
    await expect(page.getByRole("button", { name: "Finish" })).toBeVisible();

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
    await page.getByRole("button", { name: "Finish" }).click();
    await expect(page).toHaveURL(/\/today$/u);
    await page.getByRole("button", { name: /^Continue/u }).click();

    await expect(page).toHaveURL(new RegExp(`/learn/${lesson.id}\\?session=`, "u"));
    await expect(page.getByText('What does the electron "cloud" show?')).toBeVisible();
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

    await expect(page.getByRole("heading", { level: 1, name: "Session complete" })).toBeVisible();
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

  test("asks a guest to save their plan when their session ends", async ({ browser }) => {
    const { user } = await createStudyDay({ reviewDone: true });
    await prisma.user.update({ data: { isAnonymous: true }, where: { id: user.id } });

    const page = await openAs(browser, user);

    // The session cookie's cached copy still says "signed up": drop it so the server reads the guest.
    await page.context().clearCookies({ name: /session_data/u });
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
    const { user } = await createStudyDay({ reviewDone: true, writtenLesson: false });

    await prisma.user.update({ data: { isAnonymous: true }, where: { id: user.id } });

    const page = await openAs(browser, user);
    await page.context().clearCookies({ name: /session_data/u });
    await refuseLessonWriting(page, { limit: 1, period: "total", tier: "guest" });
    await page.goto("/today");

    await page.getByRole("button", { name: /^Continue/u }).click();

    await expect(page).toHaveURL(/\/session\?limit=guest$/u);

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
