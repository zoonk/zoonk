import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { ensureGuest } from "@zoonk/e2e/fixtures/guests";
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
  test("without scripts, the home goal box opens /start with the goal, which only fills the box", async ({
    browser,
    page,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const noScripts = await context.newPage();

    try {
      await noScripts.goto("/");

      const hero = noScripts.getByRole("region", { name: /Know what to study/u });
      await hero.getByRole("textbox", { name: "I want to" }).fill("learn to cook for my family");
      await hero.getByRole("button", { exact: true, name: "Build my plan" }).click();

      await expect(noScripts).toHaveURL(/\/start\?goal=learn\+to\+cook\+for\+my\+family$/u);
    } finally {
      await context.close();
    }

    // A link with a goal never reads it by itself: the box is filled, and nothing was sent.
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
    await expect(page.getByText("This didn't start")).toBeVisible();

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

    await expect(page.getByRole("heading", { name: "Here's what I understood" })).toBeVisible();
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
    const userId = await ensureGuest(page);

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
        userId,
      }),
      goalUnderstandingFixture({ goal: learnWords, result: QUANTUM, userId }),
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

/** Signs the page in as a new guest and returns the guest's id. */
test.describe("Goal limits", () => {
  test("a guest whose one goal is taken is asked for an account before typing another", async ({
    page,
  }) => {
    const guestId = await ensureGuest(page);
    await goalFixture({ userId: guestId });

    await page.goto("/start");

    await expect(
      page.getByRole("heading", { name: "Create a free account to start another goal" }),
    ).toBeVisible();

    await expect(page.getByRole("textbox", { name: "I want to" })).toBeHidden();

    await expect(page.getByRole("link", { name: "Create a free account" })).toHaveAttribute(
      "href",
      "/login",
    );

    await expect(page.getByRole("link", { name: "Back to Today" })).toHaveAttribute(
      "href",
      "/today",
    );

    await expectAccessibleScreen(page, "the account ask before a guest's second goal");
  });

  test("a guest whose one goal was taken while confirming gets the account as the way on", async ({
    page,
  }) => {
    const goal = uniqueWords("understand astronomy as a guest");

    const guestId = await ensureGuest(page);

    await goalUnderstandingFixture({
      goal,
      result: {
        followUps: [],
        goals: [{ kind: "learn", subject: "astronomy", title: "Understand astronomy" }],
        route: "goals",
      },
      userId: guestId,
    });

    await sendGoal(page, goal);
    await expect(page.getByRole("heading", { name: "Here's what I understood" })).toBeVisible();

    // Their one goal is taken in another tab before they confirm this one.
    await goalFixture({ userId: guestId });
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

    await expect(page.getByRole("button", { name: "Looks right" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Fix something" })).toBeHidden();
  });
});

test.describe("Starting a goal inside the app's frame", () => {
  test("a visitor gets the frame and its way in; a learner's Start a new goal keeps the sidebar, marks no tab, and goes back to the page they left", async ({
    noProgressUser,
    page,
    userWithoutProgress,
  }) => {
    await page.goto("/start");

    await expect(
      page.getByRole("heading", { level: 1, name: "What do you want to achieve?" }),
    ).toBeVisible();

    await expect(
      page.getByRole("complementary", { name: "Sidebar" }).getByRole("link", { name: "Log in" }),
    ).toBeVisible();

    // A visitor's paperclip asks for an account first.
    await page.getByRole("button", { name: "Study your own material" }).click();
    await expect(page.getByText(/Create a free account to add a PDF/u)).toBeVisible();

    await expect(page.getByRole("link", { name: "Create an account" })).toHaveAttribute(
      "href",
      "/login",
    );

    // A learner with a goal starts another from the goal switcher and stays in the app.
    await goalFixture({ userId: noProgressUser.id });
    await userWithoutProgress.goto("/today");

    const sidebar = userWithoutProgress.getByRole("complementary", { name: "Sidebar" });
    await sidebar.getByRole("button", { name: /^Current goal:/u }).click();
    await userWithoutProgress.getByRole("menuitem", { name: "Start a new goal" }).click();

    await expect(userWithoutProgress).toHaveURL(/\/start$/u);

    await expect(
      userWithoutProgress.getByRole("heading", { level: 1, name: "What do you want to achieve?" }),
    ).toBeVisible();

    // Starting a goal is none of the tabs' pages: the tabs stay, none of them current.
    const sideTabs = sidebar.getByRole("navigation", { name: "Learning tabs" });
    const sideToday = sideTabs.getByRole("link", { name: /^Today/u });
    const sidePlan = sideTabs.getByRole("link", { name: /^Plan/u });

    await expect(sideToday).toBeVisible();
    await expect(sideToday).not.toHaveAttribute("aria-current");
    await expect(sidePlan).not.toHaveAttribute("aria-current");

    // On a phone onboarding has no tab bar: the bar's way back returns to the page they left,
    // where the tabs are back.
    await userWithoutProgress.setViewportSize({ height: 844, width: 390 });

    const tabBar = userWithoutProgress.getByRole("navigation", { name: "Learning tabs" });

    await expect(tabBar).toHaveCount(0);

    await userWithoutProgress.getByRole("link", { exact: true, name: "Back" }).click();
    await expect(userWithoutProgress).toHaveURL(/\/today$/u);

    await expect(tabBar.getByRole("link", { name: /^Today/u })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
