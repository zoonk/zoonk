import { randomUUID } from "node:crypto";
import { DbNull, prisma } from "@zoonk/db";
import { ensureGuest } from "@zoonk/e2e/fixtures/guests";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import { type Page, expect, test } from "./fixtures";

/**
 * The way into onboarding: a goal sent from `/start` or Today is saved as a draft and read, the
 * address keeps the draft so a refresh shows the same screen, and nothing is read or written
 * until the learner sends. Understandings are stored the way a real one is (the cache), so these
 * run without the AI task. Words nobody read yet fail to be read: the run doesn't start when no
 * API is reachable, and fails on the E2E API, which has no AI. Both offer to try again.
 */

type Understanding = Parameters<typeof goalUnderstandingFixture>[0]["result"];

const DRAFT_URL = /\/start\?draft=[0-9a-f-]{36}$/u;

/**
 * A read that failed: its run didn't start (no API is reachable), or stopped (the E2E API has no
 * AI, and its run gives up only after the workflow's step retries).
 */
const FAILED_READ = /^This didn't (?:start|finish)$/u;
const FAILED_READ_TIMEOUT = 15_000;

function uniqueWords(words: string) {
  return `${words} ${randomUUID().slice(0, 8)}`;
}

async function sendGoal(page: Page, goal: string) {
  await page.goto("/start");
  await page.getByRole("textbox", { name: "I want to" }).fill(goal);
  await page.getByRole("button", { name: "Build my plan" }).click();
}

async function findDraft(prompt: string) {
  return prisma.onboardingDraft.findFirstOrThrow({ where: { prompt } });
}

const QUANTUM: Understanding = {
  followUps: [],
  goals: [{ kind: "learn", subject: "quantum physics", title: "Understand quantum physics" }],
  route: "goals",
};

test.describe("Sending a goal", () => {
  test("a link with a goal only fills the box: nothing is read until the learner sends it", async ({
    page,
  }) => {
    await page.goto("/start?goal=learn+to+cook+for+my+family");

    await expect(page.getByRole("textbox", { name: "I want to" })).toHaveValue(
      "learn to cook for my family",
    );

    await expect(page.getByRole("heading", { name: "What do you want to achieve?" })).toBeVisible();

    await expect
      .poll(() =>
        prisma.onboardingDraft.count({ where: { prompt: "learn to cook for my family" } }),
      )
      .toBe(0);
  });
});

test.describe("Coming back", () => {
  test("a refreshed question draft waits for Explain it instead of starting new work", async ({
    page,
  }) => {
    const question = uniqueWords("why does ice float on water?");
    await sendGoal(page, question);
    await expect(page).toHaveURL(DRAFT_URL);

    const draft = await findDraft(question);

    // The external read finished while this tab was away. Reloading must not turn the old
    // submission into a new explanation request, even if it was made only moments ago.
    await prisma.onboardingDraft.update({
      data: {
        status: "understood",
        understanding: { question: "Why ice floats", status: "explain" },
      },
      where: { id: draft.id },
    });

    await page.reload();
    await expect(page.getByRole("button", { exact: true, name: "Explain it" })).toBeVisible();
    await expect(page).toHaveURL(DRAFT_URL);
    await expect(prisma.goal.count({ where: { prompt: question } })).resolves.toBe(0);

    await page.getByRole("button", { exact: true, name: "Explain it" }).click();
    await expect(page).toHaveURL(/\/explain\/[0-9a-f-]{36}$/u);
    await expect(page.getByRole("heading", { name: "Why ice floats" })).toBeVisible();
    await expect(prisma.goal.count({ where: { prompt: question } })).resolves.toBe(1);
  });

  test("a guest's goal waits for them on Today, where the home page sends them", async ({
    page,
  }) => {
    const goal = uniqueWords("understand quantum physics, back later");
    await goalUnderstandingFixture({ goal, result: QUANTUM, userId: await ensureGuest(page) });

    // With a session, the home page opens Today, whose start form sends what was typed.
    await page.goto("/");
    await expect(page).toHaveURL(/\/today$/u);
    await page.getByRole("textbox", { name: "I want to" }).fill(goal);
    await page.getByRole("button", { name: "Build my plan" }).click();

    await expect(page).toHaveURL(/\/today\?draft=[0-9a-f-]{36}$/u);
    await expect(page.getByText("Understand quantum physics", { exact: true })).toBeVisible();

    // Back on the home page later, a guest without a goal yet finds the goal they typed on Today.
    await page.goto("/");

    await expect(page).toHaveURL(/\/today$/u);
    await expect(page.getByRole("main").getByText(goal, { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Here's what I understood" })).toBeVisible();
  });

  test("a start that failed offers to try again, which moves on once the words can be read, and a refresh follows a read to the card", async ({
    page,
  }) => {
    const goal = uniqueWords("learn to juggle five balls");
    await sendGoal(page, goal);

    // Nobody read these words before and reading them failed: the draft is saved, unread.
    await expect(page).toHaveURL(DRAFT_URL);
    await expect(page.getByText(FAILED_READ)).toBeVisible({ timeout: FAILED_READ_TIMEOUT });
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();

    const draft = await findDraft(goal);

    const understanding = {
      goals: [
        {
          draft: {
            details: { onboardingId: draft.id, subject: "juggling" },
            kind: "learn",
            language: "en",
            prompt: goal,
            title: "Juggle five balls",
          },
          examDates: [],
        },
      ],
      schedule: { dailyMinutes: 15, studyDays: null, studyTime: null, studyTimeNote: null },
      status: "goals",
    };

    // The words got read after all (the cache has them now): trying again shows the card.
    await prisma.onboardingDraft.update({
      data: { status: "understood", understanding },
      where: { id: draft.id },
    });

    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("Juggle five balls", { exact: true })).toBeVisible();

    // A read still running when the page is refreshed: the refresh only follows the run it finds,
    // the wait, then the card on its own.
    const runId = `e2e-understanding-${randomUUID()}`;

    await prisma.onboardingDraft.update({
      data: { runId, status: "understanding", understanding: DbNull },
      where: { id: draft.id },
    });

    const release = Promise.withResolvers<null>();

    await page.route(`**/v1/generations/${runId}/events**`, async (route) => {
      await release.promise;

      await prisma.onboardingDraft.update({
        data: { status: "understood", understanding },
        where: { id: draft.id },
      });

      const events = [
        { status: "started", step: "readGoal" },
        { status: "completed", step: "readGoal" },
        { entityId: draft.id, status: "completed", step: "understandingReady" },
      ];

      await route.fulfill({
        body: events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
        contentType: "text/event-stream",
        status: 200,
      });
    });

    await page.reload();
    await expect(page.getByRole("heading", { name: "Understanding your goal" })).toBeVisible();

    release.resolve(null);

    await expect(page.getByRole("heading", { name: "Here's what I understood" })).toBeVisible();
    await expect(page.getByText("Juggle five balls", { exact: true })).toBeVisible();
  });
});
