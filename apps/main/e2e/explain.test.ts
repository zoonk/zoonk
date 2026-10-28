import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { ensureGuest } from "@zoonk/e2e/fixtures/guests";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import {
  goalFixture,
  planFixture,
  planItemFixture,
  plannedSkills,
} from "@zoonk/testing/fixtures/goals";
import { lessonSkillFixture } from "@zoonk/testing/fixtures/library-lessons";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { type Page, expect, test } from "./fixtures";
import { expectHydrated } from "./hydration";
import { asPersona } from "./learn-personas";

/**
 * Quick explanations: a question goes straight to its explanation, with a wait while it's
 * written, then about five short screens, one question and "Now you know".
 */

/** One idea per screen: "Next" moves through the story one screen at a time. */
async function readStory(page: Page, screens: number): Promise<void> {
  if (screens === 0) {
    return;
  }

  // The first screen is in the page's HTML before the player's code runs, and a tap on its Next
  // does nothing until then.
  const next = page.getByRole("button", { name: /^Next/u });
  await expectHydrated(next);
  await next.click();
  await readStory(page, screens - 1);
}

const STORY_SCREENS = 5;

test.describe("Quick explanations", () => {
  test("a question goes straight to its explanation", async ({ page }) => {
    const question = `how does a microwave work ${randomUUID().slice(0, 8)}?`;

    await goalUnderstandingFixture({
      goal: question,
      result: { question: "How a microwave works", route: "explain" },
      userId: await ensureGuest(page),
    });

    await page.goto("/start");
    await page.getByRole("textbox", { name: "I want to" }).fill(question);
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/explain\/[0-9a-f-]{36}$/u);
    await expect(page.getByRole("heading", { name: "How a microwave works" })).toBeVisible();

    const goal = await prisma.goal.findFirstOrThrow({
      include: { user: true },
      where: { prompt: question },
    });

    expect(goal).toMatchObject({ kind: "explain", title: "How a microwave works" });
    expect(goal.details).toMatchObject({ question });
    expect(goal.user.isAnonymous).toBe(true);
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

    const [plan, skill] = await Promise.all([
      planFixture({ goalId: goal.id }),
      skillFixture({ name: "Why the sky is blue" }),
    ]);

    await lessonSkillFixture({ lessonId: played.lesson.id, skillId: skill.id });

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
        await Promise.all([
          prisma.plan.update({
            data: { graph: { skills: plannedSkills([skill]) } },
            where: { id: plan.id },
          }),
          planItemFixture({
            kind: "lesson",
            lessonId: played.lesson.id,
            planId: plan.id,
            skillId: skill.id,
            titleSnapshot: "Why the sky is blue",
          }),
        ]);

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

  test(`a learner with only quick explanations starts a goal on Today, and one plays its story to "Now you know"`, async ({
    browser,
  }) => {
    await asPersona(browser, { persona: "explain" }, async ({ page, user: persona }) => {
      await page.goto("/today");
      await expect(page.getByRole("textbox", { name: "I want to" })).toBeVisible();
      await expect(page).toHaveURL(/\/today$/u);

      await page.goto(`/explain/${persona.goalId}`);

      await expect(
        page.getByRole("main", { name: "Lesson content" }).getByText("The market isn't one price"),
      ).toBeVisible();

      await readStory(page, STORY_SCREENS);

      await expect(
        page.getByText("A headline says the market is up 2% today. What do you know for sure?"),
      ).toBeVisible();

      await page.keyboard.press("1");
      await page.keyboard.press("Enter");
      await expect(page.getByRole("status").filter({ hasText: "Correct!" })).toBeVisible();
      await page.keyboard.press("Enter");

      await expect(page.getByText("Now you know")).toBeVisible();
    });
  });
});
