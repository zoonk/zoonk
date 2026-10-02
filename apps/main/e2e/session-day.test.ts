import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { isJsonObject } from "@zoonk/utils/json";
import { type Page, expect, test } from "./fixtures";
import { type StreamEvent, followRun } from "./generation-run";
import { tabTo } from "./keyboard-focus";
import {
  answerRight,
  continueWithEnter,
  createStudyDay,
  openAs,
  writeStudyLesson,
} from "./study-day";

/** The next stop reads the session again every 5 seconds while its lesson is written. */
const WAITING_REFRESH_MS = 5000;

/** A lesson's moment sits under the player's heading (the lesson's title); a block's is the page's. */
async function expectMoment(page: Page, title: string, { level = 1 }: { level?: 1 | 2 } = {}) {
  await expect(page.getByRole("heading", { level, name: title })).toBeVisible();
  await expect(page.getByRole("main").getByText("Brain Power")).toBeVisible();
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
 * A first-week day in Focus: placement is still unsure about a skill, so today's review opens with
 * one placement question about it, the way the session builder puts it first.
 */
async function createFirstWeekDay() {
  const day = await createStudyDay({ mode: "focus" });
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

/** Both capsules from the keyboard, with the first one and its feedback scanned. */
async function playCapsules(page: Page) {
  await expect(page.getByRole("heading", { name: /^Capsule one/u })).toBeVisible();
  await expectAccessibleScreen(page, "a capsule");
  await page.keyboard.press("1");

  await expect(
    page.getByRole("region", { name: "Answer feedback" }).getByText("Correct!"),
  ).toBeVisible();

  await expectAccessibleScreen(page, "a capsule's feedback");
  await continueWithEnter(page);
  await answerRight(page, /^Capsule two/u);
}

async function playLesson(page: Page) {
  await expect(page).toHaveURL(/\/learn\/[\w-]+\?session=[\w-]+$/u);

  await expect(
    page.getByRole("progressbar", { name: "Today's session: 1 of 3 done" }),
  ).toBeVisible();

  await expect(page.getByText('What does the electron "cloud" show?')).toBeVisible();
  await page.keyboard.press("2");

  await expect(
    page.getByRole("radio", { name: "Where the electron is most likely to be found" }),
  ).toBeChecked();

  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Correct!" })).toBeVisible();
  await page.keyboard.press("Enter");

  await expectMoment(page, "Lesson complete", { level: 2 });
  await expect(page.getByText("2 of 3 done today")).toBeVisible();

  await expect(
    page.getByRole("progressbar", { name: "Today's session: 2 of 3 done" }),
  ).toBeVisible();

  await page.getByRole("button", { name: /^Continue/u }).click();
}

async function playPractice(page: Page) {
  await expect(page).toHaveURL(/\/session$/u);
  await answerRight(page, /^Practice one/u);
  await answerRight(page, /^Practice two/u);
  await expectMoment(page, "Practice done");
  await tabTo(page, page.getByRole("button", { name: /^See what changed/u }));
  await page.keyboard.press("Enter");
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

    await expect(page.getByText(/you answered Wrong answer\. What about now\?/u)).toBeVisible();
    await playCapsules(page);
    await expectMoment(page, "Review done");

    await expect(
      page.getByRole("progressbar", { name: "Today's session: 1 of 3 done" }),
    ).toBeVisible();

    await expectAccessibleScreen(page, "the capsules' moment");
    await page.keyboard.press("Enter");

    await playLesson(page);
    await playPractice(page);

    await expect(
      page.getByRole("heading", { level: 1, name: "Today's session is done" }),
    ).toBeVisible();

    await expectAccessibleScreen(page, "the session's summary");

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/today$/u);
    await expect(page.getByText("Today's session is done. Nice work!")).toBeVisible();
    await page.context().close();
  });

  test("stops for today between blocks, what's done counts, and 10 more minutes come after", async ({
    browser,
  }) => {
    const { lesson, session, user } = await createStudyDay({ mode: "fun" });
    const page = await openAs(browser, user);
    await page.goto("/today");

    await tabTo(page, page.getByRole("button", { name: /^Take off/u }));
    await page.keyboard.press("Enter");
    await playCapsules(page);
    await expectMoment(page, "Capsules opened");
    await expectAccessibleScreen(page, "the capsules' moment");
    await page.getByRole("button", { name: "Stop for today" }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Flight plan complete!" }),
    ).toBeVisible();

    await expectAccessibleScreen(page, "the session's summary");

    const blocks = await prisma.studySessionBlock.findMany({
      orderBy: { position: "asc" },
      where: { sessionId: session.id },
    });

    expect(blocks.map((block) => block.status)).toStrictEqual(["completed", "skipped", "skipped"]);

    await expect(page.getByText("Save your plan so it's here next time.")).toBeHidden();

    await page.getByRole("button", { name: /^Study \d+ more minutes/u }).click();

    // Nothing new to practice, so the bonus time goes to the plan's lesson skipped earlier.
    await expect(page).toHaveURL(new RegExp(`/learn/${lesson.id}\\?session=`, "u"));
    await expect(page.getByText('What does the electron "cloud" show?')).toBeVisible();

    const extra = await prisma.studySessionBlock.findFirst({
      where: { position: 3, sessionId: session.id },
    });

    expect(extra).toMatchObject({ kind: "learn", lessonId: lesson.id, status: "active" });
    await page.context().close();
  });

  test("asks a guest to save their plan when their session ends", async ({ browser }) => {
    const { user } = await createStudyDay({ mode: "focus", reviewDone: true });
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

  test("opens the lesson on its own once it's written", async ({ browser }) => {
    const { lesson, user } = await createStudyDay({
      mode: "focus",
      reviewDone: true,
      writtenLesson: false,
    });

    const page = await openAs(browser, user);
    await page.clock.install();
    await page.goto("/session");

    await expect(
      page.getByText(
        "This lesson is being written for you. It's usually ready in a minute or two.",
      ),
    ).toBeVisible();

    await expectAccessibleScreen(page, "the session's next stop while its lesson is written");

    // The API's run writes it meanwhile; it opens without a tap at the screen's next check.
    await writeStudyLesson(lesson.id);
    await page.clock.fastForward(WAITING_REFRESH_MS);

    await expect(page).toHaveURL(new RegExp(`/learn/${lesson.id}\\?session=`, "u"));
    await page.context().close();
  });

  test("shows the lesson's writing as it happens and opens it once written", async ({
    browser,
  }) => {
    const { lesson, user } = await createStudyDay({
      mode: "fun",
      reviewDone: true,
      writtenLesson: false,
    });

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

    await expectAccessibleScreen(page, "the session's next stop while its lesson is written");

    // The run says it's ready: the screen reads the session again and opens the lesson.
    await writeStudyLesson(lesson.id);
    events.push({ entityId: lesson.id, status: "completed", step: "lessonReady" });

    await expect(page).toHaveURL(new RegExp(`/learn/${lesson.id}\\?session=`, "u"));
    await page.context().close();
  });

  test("offers to ask again when writing the lesson stopped, and a ready block meanwhile", async ({
    browser,
  }) => {
    const { lesson, user } = await createStudyDay({
      mode: "focus",
      reviewDone: true,
      writtenLesson: false,
    });

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
    const { user } = await createStudyDay({ mode: "fun", reviewDone: true, writtenLesson: false });
    const page = await openAs(browser, user);
    await refuseLessonWriting(page, { limit: 40, period: "month", tier: "free" });
    await page.goto("/today");

    await page.getByRole("button", { name: /^Keep flying/u }).click();

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
    const { user } = await createStudyDay({
      mode: "focus",
      reviewDone: true,
      writtenLesson: false,
    });

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
    const { lesson, user } = await createStudyDay({
      mode: "fun",
      reviewDone: true,
      writtenLesson: false,
    });

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
