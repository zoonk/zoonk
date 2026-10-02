import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { type Page, expect, test } from "./fixtures";

/**
 * The way into onboarding: a goal sent from the home page or `/start` is saved as a draft and read,
 * the address keeps the draft so a refresh shows the same screen, and visitors who already started
 * keep the home page with a way back. Understandings are stored the way a real one is (the cache),
 * so these run without the AI task; the E2E API isn't reachable, so words nobody read yet can't
 * start, which is how a failed start looks.
 */

type Understanding = Parameters<typeof goalUnderstandingFixture>[0]["result"];

const DRAFT_URL = /\/start\?draft=[0-9a-f-]{36}$/u;

function uniqueWords(words: string) {
  return `${words} ${randomUUID().slice(0, 8)}`;
}

async function sendGoal(page: Page, goal: string) {
  await page.goto("/start");
  await page.getByRole("textbox", { name: "Your goal" }).fill(goal);
  await page.getByRole("button", { name: "Start with your goal" }).click();
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
  test("without scripts, the home goal box opens /start with the goal, which only fills the box", async ({
    browser,
    page,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const noScripts = await context.newPage();

    try {
      await noScripts.goto("/");

      const hero = noScripts.getByRole("region", { name: /Get ready for/u });
      await hero.getByRole("textbox", { name: "I want to" }).fill("learn to cook for my family");
      await hero.getByRole("button", { exact: true, name: "Start" }).click();

      await expect(noScripts).toHaveURL(/\/start\?goal=learn\+to\+cook\+for\+my\+family$/u);
    } finally {
      await context.close();
    }

    // A link with a goal never reads it by itself: the box is filled, and nothing was sent.
    await page.goto("/start?goal=learn+to+cook+for+my+family");

    await expect(page.getByRole("textbox", { name: "Your goal" })).toHaveValue(
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
  test("a guest's goal from the home page's box waits for them on home and on Today", async ({
    page,
  }) => {
    const goal = uniqueWords("understand quantum physics, back later");
    await goalUnderstandingFixture({ goal, result: QUANTUM });

    // The home goal box sends what was typed, with no second submit.
    await page.goto("/");
    const hero = page.getByRole("region", { name: /Get ready for/u });
    await hero.getByRole("textbox", { name: "I want to" }).fill(goal);
    await hero.getByRole("button", { exact: true, name: "Start" }).click();

    await expect(page).toHaveURL(DRAFT_URL);
    await expect(page.getByText("Understand quantum physics", { exact: true })).toBeVisible();
    const draftUrl = page.url();

    // A guest keeps the home page, with a way back to the goal they typed.
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Get ready for");

    await page.getByRole("link", { name: /Continue where you left off/u }).click();
    await expect(page).toHaveURL(draftUrl);
    await expect(page.getByRole("main").getByText(goal, { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Here's what I understood:" })).toBeVisible();

    // Without a goal yet, Today opens the goal they typed.
    await page.goto("/today");

    await expect(page).toHaveURL(draftUrl);
    await expect(page.getByRole("heading", { name: "Here's what I understood:" })).toBeVisible();
  });

  test("a start that failed offers to try again, and a refresh follows the read to the card", async ({
    page,
  }) => {
    const goal = uniqueWords("learn to juggle five balls");
    await sendGoal(page, goal);

    // Nobody read these words before and the API can't be reached: the draft is saved, unread.
    await expect(page).toHaveURL(DRAFT_URL);
    await expect(page.getByText("This didn't start")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();

    const draft = await findDraft(goal);
    const runId = `e2e-understanding-${randomUUID()}`;
    await prisma.onboardingDraft.update({ data: { runId }, where: { id: draft.id } });

    const release = Promise.withResolvers<null>();

    await page.route(`**/v1/generations/${runId}/events**`, async (route) => {
      await release.promise;

      await prisma.onboardingDraft.update({
        data: {
          status: "understood",
          understanding: {
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
          },
        },
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

    // The refresh only follows the run it finds: the wait, then the card on its own.
    await page.reload();
    await expect(page.getByRole("heading", { name: "Understanding your goal" })).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Reading your goal" })).toBeVisible();

    release.resolve(null);

    await expect(page.getByRole("heading", { name: "Here's what I understood:" })).toBeVisible();
    await expect(page.getByText("Juggle five balls", { exact: true })).toBeVisible();
  });

  test("try again moves on once the words can be read", async ({ page }) => {
    const goal = uniqueWords("learn to whistle with two fingers");
    await sendGoal(page, goal);
    await expect(page.getByText("This didn't start")).toBeVisible();

    // The words got read after all (the cache has them now): trying again shows the card.
    const draft = await findDraft(goal);

    await prisma.onboardingDraft.update({
      data: {
        status: "understood",
        understanding: {
          goals: [
            {
              draft: {
                details: { onboardingId: draft.id, subject: "whistling" },
                kind: "learn",
                language: "en",
                prompt: goal,
                title: "Whistle with two fingers",
              },
              examDates: [],
            },
          ],
          schedule: { dailyMinutes: 15, studyDays: null, studyTime: null, studyTimeNote: null },
          status: "goals",
        },
      },
      where: { id: draft.id },
    });

    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("Whistle with two fingers", { exact: true })).toBeVisible();
  });
});

test.describe("Fixing what was understood", () => {
  test("fixing the words reads them again and replaces every fact", async ({ page }) => {
    const examWords = uniqueWords("pass the enem, nursing at a federal university");
    const learnWords = uniqueWords("actually, understand quantum physics");

    await Promise.all([
      goalUnderstandingFixture({
        goal: examWords,
        result: {
          followUps: [],
          goals: [
            {
              examName: "ENEM",
              institution: "a federal university",
              kind: "exam",
              subject: "ENEM",
              targetCourse: "Nursing",
              title: "Pass the ENEM",
            },
          ],
          route: "goals",
        },
      }),
      goalUnderstandingFixture({ goal: learnWords, result: QUANTUM }),
    ]);

    await sendGoal(page, examWords);
    await expect(page.getByText("Nursing", { exact: true })).toBeVisible();
    const firstUrl = page.url();

    await page.getByRole("button", { name: "Fix something" }).click();
    await expect(page.getByRole("textbox", { name: "What you wrote" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Fix something" })).toBeFocused();

    await page.getByRole("button", { name: "Fix something" }).click();
    await page.getByRole("textbox", { name: "What you wrote" }).fill(learnWords);
    await page.getByRole("button", { name: "Read it again" }).click();

    await expect(page.getByText("Understand quantum physics", { exact: true })).toBeVisible();
    await expect(page.getByText(learnWords, { exact: true })).toBeVisible();
    await expect(page.getByText("Nursing", { exact: true })).toBeHidden();
    await expect(page.getByText("Exam year")).toBeHidden();
    await expect(page).toHaveURL(DRAFT_URL);
    expect(page.url()).not.toBe(firstUrl);
  });
});

test.describe("Goal limits", () => {
  test("a guest's second goal says why, with the way to an account", async ({ page }) => {
    const goal = uniqueWords("understand astronomy as a guest");

    const [guest] = await Promise.all([
      page.request.post("/api/auth/sign-in/anonymous", {
        data: {},
        headers: { Origin: getBaseURL() },
      }),
      goalUnderstandingFixture({
        goal,
        result: {
          followUps: [],
          goals: [{ kind: "learn", subject: "astronomy", title: "Understand astronomy" }],
          route: "goals",
        },
      }),
    ]);

    expect(guest.ok(), await guest.text()).toBe(true);

    // The guest already follows their one goal.
    const { user } = await guest.json();
    await goalFixture({ userId: user.id });

    await sendGoal(page, goal);
    await page.getByRole("button", { name: "Looks right" }).click();

    await expect(
      page.getByText(
        "Without an account, you can follow one goal. Create a free account to keep going.",
      ),
    ).toBeVisible();

    await expect(page.getByRole("link", { name: "Create a free account" })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});

test.describe("The app's bar on /start", () => {
  test("visitors get the home page's bar and an account ask on the paperclip, learners get their own bar", async ({
    page,
    userWithoutProgress,
  }) => {
    await page.goto("/start");
    await expect(page.getByRole("link", { name: "Zoonk home page" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();

    // A visitor's paperclip asks for an account first.
    await page.getByRole("button", { name: "Study your own material" }).click();
    await expect(page.getByText(/Create a free account to add a PDF/u)).toBeVisible();

    await expect(page.getByRole("link", { name: "Create an account" })).toHaveAttribute(
      "href",
      "/login",
    );

    await userWithoutProgress.goto("/start");
    await expect(userWithoutProgress.getByRole("button", { name: "User menu" })).toBeVisible();
    await expect(userWithoutProgress.getByRole("link", { name: "Log in" })).toBeHidden();
  });
});
