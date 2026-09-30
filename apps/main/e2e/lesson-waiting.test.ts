import { randomUUID } from "node:crypto";
import { type Page } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { expect, test } from "./fixtures";
import { type Mode, setDeviceMode } from "./learn-personas";
import { openAs } from "./study-day";

/**
 * These tests cover the page when the API can't write the lesson. Another local server may be
 * listening on the E2E API port, so the request fails on purpose instead of by assumption.
 */
async function failLessonWriting(page: Page) {
  await page.route("**/v1/library/lessons/*/generations", (route) => route.abort());
}

/**
 * Stands in for the API: asking for the lesson answers with the run writing it (the next run id
 * each time it's asked), and each run's step stream is read afresh on every connection, so steps
 * pushed later arrive when the page reconnects after the stream closes.
 */
async function answerLessonWriting(page: Page, runs: { events: object[]; id: string }[]) {
  const asked: string[] = [];

  await page.route("**/v1/library/lessons/*/generations", async (route) => {
    const run = runs[Math.min(asked.length, runs.length - 1)];
    asked.push(run?.id ?? "");
    await route.fulfill({ json: { generationId: run?.id, status: "generating" }, status: 202 });
  });

  await Promise.all(
    runs.flatMap((run) => [
      page.route(`**/v1/generations/${run.id}/events**`, (route) =>
        route.fulfill({
          body: run.events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
          contentType: "text/event-stream",
          status: 200,
        }),
      ),
      page.route(`**/v1/generations/${run.id}`, (route) =>
        route.fulfill({ json: { id: run.id, status: "running" }, status: 200 }),
      ),
    ]),
  );

  return asked;
}

function lessonStep(step: string, status: "completed" | "error" | "started") {
  return { entityId: "lesson", status, step };
}

/** A learner whose plan's next lesson isn't written yet, with a written one after it. */
async function createWaitingLearner(mode: Mode) {
  const [user, unwritten, written] = await Promise.all([
    createE2EUser(getBaseURL()),
    libraryLessonFixture({ title: `Compound interest ${randomUUID().slice(0, 6)}` }),
    playableLessonFixture({ lesson: { title: `Simple interest ${randomUUID().slice(0, 6)}` } }),
  ]);

  const goal = await goalFixture({ timezone: "UTC", userId: user.id });
  const plan = await planFixture({ goalId: goal.id });

  await Promise.all([
    planItemFixture({ kind: "lesson", lessonId: unwritten.id, planId: plan.id, position: 0 }),
    planItemFixture({ kind: "lesson", lessonId: written.lesson.id, planId: plan.id, position: 1 }),
    learningProfileFixture({ activeGoalId: goal.id, experienceMode: mode, userId: user.id }),
  ]);

  return { unwritten, user, written: written.lesson };
}

/**
 * Writes the lesson the way the API's workflows do: straight to the database, from another app
 * whose cache revalidation never reaches this app's cache.
 */
async function writeLessonElsewhere(lessonId: string) {
  await Promise.all([
    libraryStepFixture({
      content: playableStepContent.explanation,
      kind: "explanation",
      lessonId,
      position: 0,
    }),
    libraryStepFixture({
      content: playableStepContent.check,
      kind: "check",
      lessonId,
      position: 1,
    }),
  ]);

  await prisma.lesson.update({ data: { contentStatus: "completed" }, where: { id: lessonId } });
}

test("opens a lesson once another app writes it, though this app saw it unwritten", async ({
  userWithoutProgress: page,
}) => {
  const unwritten = await libraryLessonFixture({
    title: `Electron clouds ${randomUUID().slice(0, 6)}`,
  });

  await failLessonWriting(page);
  await page.goto(`/learn/${unwritten.id}`);
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();

  await writeLessonElsewhere(unwritten.id);
  await page.reload();

  await expect(page.getByText("A cloud, not a little ball")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeHidden();
});

test.describe("A lesson still being written", () => {
  test("follows the writing live and opens the lesson on its own", async ({ browser }) => {
    const { unwritten, user } = await createWaitingLearner("focus");
    const page = await openAs(browser, user);

    const events = [
      lessonStep("planLesson", "started"),
      lessonStep("planLesson", "completed"),
      lessonStep("writeLesson", "started"),
    ];

    await answerLessonWriting(page, [{ events, id: `e2e-lesson-${randomUUID()}` }]);
    await page.goto(`/learn/${unwritten.id}`);

    await expect(page.getByRole("progressbar", { name: "Writing your lesson" })).toBeVisible();
    const phases = page.getByRole("list", { name: "Writing your lesson" });

    await expect(phases.getByRole("listitem")).toHaveText([
      /^Planning the lesson, done/u,
      /^Writing the lesson, in progress/u,
    ]);

    // The run writes the lesson and says it's ready: the page opens it without a refresh.
    await writeLessonElsewhere(unwritten.id);
    events.push(lessonStep("lessonReady", "completed"));

    await expect(page.getByText("A cloud, not a little ball")).toBeVisible();
    await page.context().close();
  });

  test("a run that fails says so, and writing it again follows the new run", async ({
    browser,
  }) => {
    const { unwritten, user, written } = await createWaitingLearner("fun");
    const page = await openAs(browser, user);

    const asked = await answerLessonWriting(page, [
      {
        events: [lessonStep("planLesson", "started"), lessonStep("workflowError", "error")],
        id: `e2e-lesson-${randomUUID()}`,
      },
      {
        events: [
          lessonStep("planLesson", "started"),
          lessonStep("planLesson", "completed"),
          lessonStep("writeLesson", "started"),
        ],
        id: `e2e-lesson-${randomUUID()}`,
      },
    ]);

    await page.goto(`/learn/${unwritten.id}`);

    await expect(page.getByText("This didn't finish")).toBeVisible();
    await expect(page.getByRole("link", { name: written.title })).toBeVisible();

    await page.getByRole("button", { name: "Try again" }).click();

    // Asking again starts a new run, and the wait follows that one.
    await expect(
      page
        .getByRole("list", { name: "Writing your lesson" })
        .getByRole("listitem")
        .filter({ hasText: "Writing the lesson" }),
    ).toHaveAttribute("aria-current", "step");

    await expect(page.getByText("This didn't finish")).toBeHidden();
    expect(asked).toHaveLength(2);
    await page.context().close();
  });

  test("a lesson set aside says so, with something ready instead", async ({ browser }) => {
    const { unwritten, user, written } = await createWaitingLearner("focus");
    const page = await openAs(browser, user);

    await page.route("**/v1/library/lessons/*/generations", (route) =>
      route.fulfill({
        json: { error: { code: "LESSON_SET_ASIDE", message: "Set aside" } },
        status: 409,
      }),
    );

    await page.goto(`/learn/${unwritten.id}`);

    await expect(page.getByRole("status").getByText("This lesson isn't available")).toBeVisible();
    await expect(page.getByText("Something ready to do instead:")).toBeVisible();
    await expect(page.getByRole("link", { name: written.title })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeHidden();
    await page.context().close();
  });

  test("a lesson the learner's plan can't cover now says why, with the way to keep going", async ({
    browser,
  }) => {
    const { unwritten, user, written } = await createWaitingLearner("fun");
    const page = await openAs(browser, user);

    await page.route("**/v1/library/lessons/*/generations", (route) =>
      route.fulfill({
        json: {
          error: {
            code: "USAGE_LIMIT_REACHED",
            details: { limit: { limit: 20, period: "day", resource: "lessonStart", tier: "free" } },
            message: "This plan's limit is reached",
          },
        },
        status: 402,
      }),
    );

    await page.goto(`/learn/${unwritten.id}`);

    await expect(
      page.getByText(
        "That's all the new lessons for today. They open again tomorrow, or get Plus to keep going now.",
      ),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: "See Plus" })).toHaveAttribute(
      "href",
      /\/subscription$/u,
    );

    await expect(page.getByRole("link", { name: written.title })).toBeVisible();
    await page.context().close();
  });

  test("never leaves a dead end: it can be tried again or swapped for a ready lesson", async ({
    browser,
  }) => {
    const { unwritten, user, written } = await createWaitingLearner("focus");
    const page = await openAs(browser, user);
    await failLessonWriting(page);
    await page.goto(`/learn/${unwritten.id}`);

    await expect(page.getByRole("heading", { level: 1, name: unwritten.title })).toBeVisible();

    // Asking the API for the lesson fails: the page says so,
    // offers to try again and offers the plan's next written lesson instead.
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await page.getByRole("link", { name: written.title }).click();

    await expect(page).toHaveURL(new RegExp(`/learn/${written.id}$`, "u"));
    await page.context().close();
  });

  test("a visitor who starts it becomes a guest and gets it written", async ({ page }) => {
    const unwritten = await libraryLessonFixture({
      title: `Continuous compounding ${randomUUID().slice(0, 6)}`,
    });

    const writeRequests: string[] = [];

    page.on("request", (sent) => {
      if (sent.method() === "POST" && sent.url().includes("/generations")) {
        writeRequests.push(sent.url());
      }
    });

    await setDeviceMode(page.context(), "fun");
    await failLessonWriting(page);
    await page.goto(`/learn/${unwritten.id}`);

    await expect(page.getByRole("heading", { level: 1, name: unwritten.title })).toBeVisible();

    // Loading the page alone makes no guest and writes nothing, so a crawler never starts AI work.
    const start = page.getByRole("button", { name: "Start this lesson" });
    await expect(start).toBeVisible();

    const before = await page.request.get("/api/auth/get-session");
    expect(await before.json()).toBeNull();
    expect(writeRequests).toStrictEqual([]);

    await start.click();

    // Asking for the lesson made the visitor a guest. Writing it fails here, so the page offers
    // to try again instead of ending there.
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    expect(writeRequests).toHaveLength(1);

    const session = await page.request.get("/api/auth/get-session");
    expect(await session.json()).toMatchObject({ user: { isAnonymous: true } });
  });
});
