import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { isJsonObject } from "@zoonk/utils/json";
import { type Page, expect, test } from "./fixtures";
import { type StreamEvent, followRun } from "./generation-run";
import { continueToLastStep } from "./result-steps";
import { answerRight, createStudyDay, openAs, pressUntil, writeStudyLesson } from "./study-day";

/**
 * A moment sits under its header's heading: the lesson's title in the player, "Today's session"
 * between a session's blocks.
 */
async function expectMoment(page: Page, title: string) {
  await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
}

/**
 * Stands in for the API taking the learner's request to write the lesson: a run starts (still
 * running, nothing written yet), and every request is recorded, so a test can say none went unasked.
 */
async function acceptLessonWriting(page: Page) {
  const runId = `e2e-session-lesson-${randomUUID()}`;
  const asked: string[] = [];

  await followRun({ events: [], page, runId });

  await page.route("**/v1/library/lessons/*/generations", async (route) => {
    asked.push(route.request().method());
    await route.fulfill({ json: { generationId: runId, status: "generating" }, status: 202 });
  });

  return { asked, runId };
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

/** The placement question takes "I don't know yet"; the capsules follow. */
async function answerPlacement(page: Page) {
  await expect(page).toHaveURL((url) => url.pathname === "/session");
  await expect(page.getByRole("heading", { name: /^Placement:/u })).toBeVisible();
  await page.getByRole("button", { name: "I don't know yet" }).click();
  await expect(page.getByRole("region", { name: "Answer feedback" })).toBeVisible();
  await page.keyboard.press("Enter");
}

/** Both capsules from the keyboard. */
async function playCapsules(page: Page) {
  await answerRight(page, /^Capsule one/u);
  await answerRight(page, /^Capsule two/u);
}

async function playLesson(page: Page) {
  await expect(page).toHaveURL(/\/learn\/[\w-]+\?session=[\w-]+$/u);
  await expect(page.getByText('What does the electron "cloud" show?')).toBeVisible();
  await page.keyboard.press("2");

  await expect(
    page.getByRole("radio", { name: "Where the electron is most likely to be found" }),
  ).toBeChecked();

  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Correct!" })).toBeVisible();
  await page.keyboard.press("Enter");

  await expectMoment(page, "Lesson complete");

  await pressUntil(
    () => page.getByRole("button", { name: /^Continue/u }).click({ timeout: 1000 }),
    page.getByRole("heading", { name: /^Practice one/u }),
  );
}

/** The day's last block, to its moment and on to the summary by Enter. */
async function playPractice(page: Page) {
  await expect(page).toHaveURL((url) => url.pathname === "/session");
  await answerRight(page, /^Practice one/u);
  await answerRight(page, /^Practice two/u);
  await expectMoment(page, "Practice done");
  await expect(page.getByRole("button", { name: /^See today's summary/u })).toBeVisible();

  await pressUntil(
    () => page.keyboard.press("Enter"),
    page.getByRole("heading", { level: 1, name: /^Done in /u }),
  );
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
  test("plays a full day by keyboard: placement, capsules, the lesson, practice and the summary", async ({
    browser,
  }) => {
    const { user } = await createFirstWeekDay();
    const page = await openAs(browser, user);
    await page.goto("/today");

    await page.getByRole("button", { name: /^Start/u }).press("Enter");
    await answerPlacement(page);

    await playCapsules(page);
    await expectMoment(page, "Review done");

    await pressUntil(
      () => page.keyboard.press("Enter"),
      page.getByText('What does the electron "cloud" show?'),
    );

    await playLesson(page);
    await playPractice(page);

    // Finish is a link back to Today, and Enter follows it.
    await continueToLastStep(page, { keyboard: true });
    await expect(page.getByRole("link", { name: "Finish" })).toBeVisible();
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

    await page.getByRole("button", { name: /^Start/u }).press("Enter");
    await playCapsules(page);
    await expectMoment(page, "Review done");

    // What changed so far, said as a pause: nothing is skipped.
    await pressUntil(
      () => page.getByRole("button", { name: "Stop for today" }).click({ timeout: 1000 }),
      page.getByRole("heading", { level: 1, name: "Done for now" }),
    );

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

  test("a lesson nobody asked for shows its Start, and only the tap asks for it", async ({
    browser,
  }) => {
    const { user } = await createStudyDay({ reviewDone: true, writtenLesson: false });
    const page = await openAs(browser, user);
    const { asked, runId } = await acceptLessonWriting(page);
    const writing = page.getByRole("progressbar", { name: "Writing your lesson" });

    // A bookmark, or a new tab: nothing writes the lesson, so the step offers its Start.
    await page.goto("/session");
    const start = page.getByRole("main").getByRole("button", { exact: true, name: "Start" });
    await expect(start).toBeEnabled();
    await expect(writing).toHaveCount(0);
    await page.waitForLoadState("networkidle");
    expect(asked).toStrictEqual([]);

    // Start asks for it once, and only then the wait for its writing shows.
    await start.click();
    await expect(writing).toBeVisible();
    await expect(page).toHaveURL((url) => url.searchParams.get("generation") === runId);
    expect(asked).toStrictEqual(["POST"]);

    // Asked for, not picked up by its run yet: the wait stays, without asking again.
    await page.reload();
    await expect(writing).toBeVisible();
    await expect(start).toHaveCount(0);
    expect(asked).toStrictEqual(["POST"]);

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

    // The run says it's ready: the screen reads the session again and opens the lesson.
    await writeStudyLesson(lesson.id);
    events.push({ entityId: lesson.id, status: "completed", step: "lessonReady" });

    await expect(page).toHaveURL(new RegExp(`/learn/${lesson.id}\\?session=`, "u"));
    await page.context().close();
  });
});
