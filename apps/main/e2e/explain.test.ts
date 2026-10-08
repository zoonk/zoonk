import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { openPaletteWithKeyboard } from "./command-palette";
import { type Page, expect, test } from "./fixtures";
import { asPersona } from "./learn-personas";

/**
 * Quick explanations: a question goes straight to its explanation, with a designed wait while
 * it's written, then about five short screens, one question and "Now you know".
 */

/** One idea per screen: "Next" moves through the story one screen at a time. */
async function readStory(page: Page, screens: number): Promise<void> {
  if (screens === 0) {
    return;
  }

  await page.getByRole("button", { name: /^Next/u }).click();
  await readStory(page, screens - 1);
}

const STORY_SCREENS = 5;

test.describe("Quick explanations", () => {
  test("a question goes straight to its explanation, with a designed wait while it's written", async ({
    page,
  }) => {
    const question = `how does a microwave work ${randomUUID().slice(0, 8)}?`;

    await goalUnderstandingFixture({
      goal: question,
      result: { question: "How a microwave works", route: "explain" },
    });

    await page.goto("/start");
    await page.getByRole("textbox", { name: "Your goal" }).fill(question);
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/explain\/[0-9a-f-]{36}$/u);
    await expect(page.getByRole("heading", { name: "How a microwave works" })).toBeVisible();
    await expect(page.getByText("Writing your explanation…")).toBeVisible();
    await expect(page.getByText("Quick explanation · 5 min")).toBeVisible();

    const goal = await prisma.goal.findFirstOrThrow({
      include: { user: true },
      where: { prompt: question },
    });

    expect(goal).toMatchObject({ kind: "explain", title: "How a microwave works" });
    expect(goal.details).toMatchObject({ question });
    expect(goal.user.isAnonymous).toBe(true);
  });

  test("the wait follows the writing live, the outline fills in, then it starts", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const runId = `e2e-explain-${randomUUID()}`;

    const goal = await goalFixture({
      details: { question: "how does a microwave work?" },
      generationRunId: runId,
      kind: "explain",
      prompt: `how does a microwave work? ${runId}`,
      title: "How a microwave works",
      userId: noProgressUser.id,
    });

    const plan = await planFixture({ goalId: goal.id });

    const events = [
      { entityId: goal.id, status: "started", step: "classifyQuestion" },
      { entityId: goal.id, status: "completed", step: "classifyQuestion" },
      { entityId: goal.id, status: "started", step: "findExplanation" },
      { entityId: goal.id, status: "started", step: "writeExplanation" },
    ];

    await page.route(`**/v1/generations/${runId}/events**`, (route) =>
      route.fulfill({
        body: events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
        contentType: "text/event-stream",
        status: 200,
      }),
    );

    await page.goto(`/explain/${goal.id}`);

    const progress = page.getByRole("list", { name: "Progress" });

    await expect(
      progress.getByRole("listitem").filter({ hasText: "Checking if someone asked it before" }),
    ).toHaveAttribute("data-state", "done");

    await expect(
      progress.getByRole("listitem").filter({ hasText: "Writing about 5 short screens" }),
    ).toHaveAttribute("data-state", "current");

    await expect(page.getByText("1 quick question at the end")).toBeVisible();

    await expect(
      page.getByRole("link", { name: /I want to learn this in depth/u }),
    ).toHaveAttribute(
      "href",
      `/start?goal=${encodeURIComponent("I want to understand how a microwave works in depth")}`,
    );

    // The explanation is saved while the stream is silent: the page's own check, every five
    // seconds, fills the outline in with its screens, and it starts on a tap.
    const played = await playableLessonFixture({
      steps: ["explanation", "explanation", "check", "summary"],
    });

    await planItemFixture({
      kind: "lesson",
      lessonId: played.lesson.id,
      planId: plan.id,
      titleSnapshot: "How a microwave works",
    });

    await expect(
      page.getByRole("list", { name: "What's coming" }).getByText("A cloud, not a little ball"),
    ).toHaveCount(2, { timeout: 10_000 });

    await page.getByRole("button", { name: "See explanation" }).click();
    await expect(page.getByText("A cloud, not a little ball").first()).toBeVisible();
  });

  test("builds the subject's course plan in one tap, with no goal to type", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const id = randomUUID().slice(0, 8);
    const org = await getAiOrganization();

    const course = await courseFixture({
      isPublished: true,
      language: "en",
      organizationId: org.id,
      title: `E2E Everyday physics ${id}`,
    });

    const goal = await goalFixture({
      details: { question: "how does a microwave work?" },
      kind: "explain",
      primaryCourseId: course.id,
      prompt: `how does a microwave work? ${id}`,
      title: "How a microwave works",
      userId: noProgressUser.id,
    });

    await planFixture({ goalId: goal.id });
    await page.goto(`/explain/${goal.id}`);

    await page
      .getByRole("button", { name: `I want to learn this in depth Build a ${course.title} plan` })
      .click();

    // The course is the goal already: no goal to type and nothing to confirm, just its steps.
    await expect(page).toHaveURL(/\/start\/[0-9a-f-]{36}$/u);

    await expect(
      page.getByRole("heading", { name: "How much do you already know?" }),
    ).toBeVisible();

    await expect(page.getByRole("main").getByText(course.title, { exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Your goal" })).toBeHidden();
    await expect(page.getByRole("heading", { name: "Here's what I understood:" })).toBeHidden();

    const goalId = new URL(page.url()).pathname.split("/").at(-1) ?? "";

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goalId } })).resolves.toMatchObject({
      details: { courseStart: { chapterId: null } },
      kind: "learn",
      primaryCourseId: course.id,
      userId: noProgressUser.id,
    });
  });

  test("the explanation opens as soon as its run says it can be read", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const runId = `e2e-explain-${randomUUID()}`;

    const [goal, played] = await Promise.all([
      goalFixture({
        details: { question: "why is the sky blue?" },
        generationRunId: runId,
        kind: "explain",
        prompt: `why is the sky blue? ${runId}`,
        title: "Why the sky is blue",
        userId: noProgressUser.id,
      }),
      playableLessonFixture({ steps: ["explanation", "explanation", "check", "summary"] }),
    ]);

    const plan = await planFixture({ goalId: goal.id });

    const events = [
      { entityId: goal.id, status: "started", step: "classifyQuestion" },
      { entityId: goal.id, status: "completed", step: "classifyQuestion" },
      { entityId: goal.id, status: "started", step: "findExplanation" },
      { entityId: goal.id, status: "started", step: "writeExplanation" },
      { entityId: goal.id, status: "completed", step: "writeExplanation" },
    ];

    const saved = Promise.withResolvers<null>();

    // The run saves the explanation on the goal's plan, then reports writing done; its course
    // to go further is still being found, so the run isn't over.
    await page.route(
      `**/v1/generations/${runId}/events**`,
      async (route) => {
        await planItemFixture({
          kind: "lesson",
          lessonId: played.lesson.id,
          planId: plan.id,
          titleSnapshot: "Why the sky is blue",
        });

        saved.resolve(null);

        await route.fulfill({
          body: events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
          contentType: "text/event-stream",
          status: 200,
        });
      },
      { times: 1 },
    );

    await page.goto(`/explain/${goal.id}`);
    await saved.promise;

    // It opens without a refresh, before the page's own next check five seconds later.
    await expect(page.getByRole("button", { name: "See explanation" })).toBeVisible({
      timeout: 3000,
    });
  });

  test(`plays the story and ends with "Now you know"`, async ({ browser }) => {
    await asPersona(browser, { persona: "explain" }, async ({ page, user: persona }) => {
      await page.goto(`/explain/${persona.goalId}`);
      await expect(page.getByText("The market isn't one price")).toBeVisible();

      await readStory(page, STORY_SCREENS);

      await expect(
        page.getByText("A headline says the market is up 2% today. What do you know for sure?"),
      ).toBeVisible();

      await page.keyboard.press("1");
      await page.keyboard.press("Enter");
      await expect(page.getByRole("status").filter({ hasText: "Correct!" })).toBeVisible();
      await page.keyboard.press("Enter");

      await expect(page.getByText("Now you know")).toBeVisible();

      await expect(
        page.getByRole("heading", { level: 2, name: /the market is up 2%/u }),
      ).toBeVisible();

      await expect(
        page.getByText("An index fund lets you own the whole basket, so its move is yours."),
      ).toBeVisible();

      // No feedback widget on the ending: a problem is reported from the "…" menu.
      await expect(page.getByText("Was this explanation helpful?")).toBeHidden();

      // Going further is a plan of its own, one tap away at the end as before the explanation.
      const goFurther = page.getByRole("region", { name: "Want to go further?" });

      await expect(
        goFurther.getByRole("button", {
          name: /I want to learn this in depth Build a How the stock market works plan/u,
        }),
      ).toBeVisible();

      // Sam only asks questions: with no plan to go back to, Done leads to the next question.
      await expect(page.getByRole("link", { name: "Done" })).toHaveAttribute("href", "/start");
    });
  });

  test("a learner with only quick explanations gets no study plan around them", async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "explain" }, async ({ page }) => {
      await page.goto("/today");

      await expect(page).toHaveURL(/\/start(?:\?|$)/u);
      await expect(page.getByRole("textbox", { name: "Your goal" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Learning tabs" })).toHaveCount(0);
    });
  });

  test("a learner with a plan goes back to Today after an explanation", async ({ browser }) => {
    await asPersona(browser, { persona: "explain" }, async ({ page, user: persona }) => {
      await goalFixture({ title: "Learn percentages", userId: persona.id });
      await page.goto(`/explain/${persona.goalId}`);

      await readStory(page, STORY_SCREENS);
      await page.keyboard.press("1");
      await page.keyboard.press("Enter");
      await expect(page.getByRole("status").filter({ hasText: "Correct!" })).toBeVisible();
      await page.keyboard.press("Enter");

      await page.getByRole("link", { name: "Done" }).click();
      await expect(page).toHaveURL(/\/today$/u);

      // Read to the end, the explanation is done: the tabs follow the plan, the goal list leaves
      // it out, and search finds it again.
      await page.getByRole("button", { name: /Current goal: Learn percentages/u }).click();
      await expect(page.getByRole("menuitemradio")).toHaveCount(1);
      await expect(page.getByRole("menuitem", { name: /the market is up 2%/u })).toHaveCount(0);
      await page.keyboard.press("Escape");

      const palette = await openPaletteWithKeyboard(page);
      const explanations = palette.getByRole("group", { name: "Quick explanations" });
      await explanations.getByRole("option", { name: /the market is up 2%/u }).click();

      await expect(page).toHaveURL(`/explain/${persona.goalId}`);
    });
  });
});
