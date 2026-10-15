import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { ensureGuest } from "@zoonk/e2e/fixtures/guests";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalUnderstandingFixture } from "@zoonk/testing/fixtures/goal-understandings";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { openPaletteWithKeyboard } from "./command-palette";
import { startCourseWithLevel } from "./course-start";
import { type Page, expect, test } from "./fixtures";
import { followRun } from "./generation-run";
import { asPersona } from "./learn-personas";
import {
  AT_ONCE_MS,
  followRequests,
  markPaintedFrames,
  paintedFramesSince,
  slowCodeFromNow,
  watchPaintedFrames,
} from "./on-demand-code";

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

/** A quick explanation's entry where a learner finds it: the goal switcher or search. */
async function findExplanation(page: Page, from: "goal switcher" | "search") {
  const name = /the market is up 2%/u;

  if (from === "goal switcher") {
    await page
      .getByRole("complementary", { name: "Sidebar" })
      .getByRole("button", { name: "Start a goal" })
      .click();

    return page.getByRole("menuitem", { name });
  }

  const palette = await openPaletteWithKeyboard(page);
  await palette.getByRole("combobox", { name: "Search" }).fill("market");

  return palette.getByRole("group", { name: "Quick explanations" }).getByRole("option", { name });
}

test.describe("Quick explanations", () => {
  test("a question goes straight to its explanation, with a designed wait while it's written", async ({
    page,
  }) => {
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
    await expect(page.getByRole("list", { name: "Writing your explanation" })).toBeVisible();
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

    await followRun({ events, page, runId });

    // Full reads of the page while it waits (not prefetches of other pages).
    const pageReads: string[] = [];

    page.on("request", (request) => {
      const headers = request.headers();
      const isPage = new URL(request.url()).pathname.endsWith(`/explain/${goal.id}`);

      if (isPage && headers.rsc === "1" && !headers["next-router-prefetch"]) {
        pageReads.push(request.url());
      }
    });

    await page.clock.install();
    await page.goto(`/explain/${goal.id}`);

    // The wait's phases, as every generation wait draws them: done ones say so, and the one
    // running is the current step.
    const progress = page.getByRole("list", { name: "Writing your explanation" });

    await expect(
      progress.getByRole("listitem").filter({ hasText: "Checking if someone asked it before" }),
    ).toContainText("done");

    await expect(
      progress.getByRole("listitem").filter({ hasText: "Writing about 5 short screens" }),
    ).toHaveAttribute("aria-current", "step");

    await expect(page.getByText("1 quick question at the end")).toBeVisible();

    await expect(
      page.getByRole("link", { name: /I want to learn this in depth/u }),
    ).toHaveAttribute(
      "href",
      `/start?goal=${encodeURIComponent("I want to understand how a microwave works in depth")}`,
    );

    // The run's progress is the wait: the page doesn't read itself again while it's followed.
    await page.clock.fastForward(15_000);
    expect(pageReads).toStrictEqual([]);

    // The explanation is saved while the stream is silent (another run wrote it): the page's
    // fallback check, twenty seconds in, fills the outline in with its screens, and it starts on
    // a tap.
    const played = await playableLessonFixture({
      steps: ["explanation", "explanation", "check", "summary"],
    });

    await planItemFixture({
      kind: "lesson",
      lessonId: played.lesson.id,
      planId: plan.id,
      titleSnapshot: "How a microwave works",
    });

    await page.clock.fastForward(6000);

    await expect(
      page.getByRole("list", { name: "What's coming" }).getByText("A cloud, not a little ball"),
    ).toHaveCount(2);

    await page.getByRole("button", { name: "See explanation" }).click();
    await expect(page.getByText("A cloud, not a little ball").first()).toBeVisible();
  });

  // Sam left "How much do you already know?" and still had a plan with lessons being written: now
  // the level comes before anything exists, and only Start makes the goal.
  test("builds the subject's course plan with no goal to type, creating nothing before Start", async ({
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
      .getByRole("link", { name: `I want to learn this in depth Build a plan for ${course.title}` })
      .click();

    // The course is the goal: no goal to type and nothing to confirm, just the learner's level.
    await expect(page).toHaveURL(new RegExp(`/start/course/${course.id}$`, "u"));

    await expect(
      page.getByRole("heading", { level: 1, name: "How much do you already know?" }),
    ).toBeVisible();

    await expect(page.getByRole("main").getByText(course.title, { exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "I want to" })).toBeHidden();

    // Leaving here leaves nothing: no goal, so no plan and no lessons being written.
    const courseGoals = {
      kind: "learn" as const,
      primaryCourseId: course.id,
      userId: noProgressUser.id,
    };

    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/explain/${goal.id}$`, "u"));
    await expect(prisma.goal.count({ where: courseGoals })).resolves.toBe(0);

    await page.goForward();
    await startCourseWithLevel(page);
    await expect(page).toHaveURL(/\/start\/[0-9a-f-]{36}$/u);

    // The level is behind them: onboarding goes on with what it still needs.
    await expect(page.getByRole("heading", { name: "How much do you already know?" })).toBeHidden();

    await expect(prisma.goal.findFirstOrThrow({ where: courseGoals })).resolves.toMatchObject({
      details: { answered: ["level"], courseStart: { chapterId: null }, level: "basic" },
      kind: "learn",
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

      // The screen's title, which the outline beside it on a wide screen names too.
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
        goFurther.getByRole("link", {
          name: /I want to learn this in depth Build a plan for How the stock market works/u,
        }),
      ).toBeVisible();

      // Sam only asks questions: with no plan to go back to, Done leads to the next question.
      await expect(page.getByRole("link", { name: "Done" })).toHaveAttribute("href", "/start");
    });
  });

  test("a player that didn't load comes back with Try again", async ({ browser }) => {
    await asPersona(browser, { persona: "explain" }, async ({ page, user: persona }) => {
      const path = `/explain/${persona.goalId}`;
      const response = await page.request.get(path);
      const html = await response.text();

      // The player loads on its own: its code is what the page preloads at low priority and doesn't
      // load as one of its own scripts.
      const hrefs = (pattern: RegExp) =>
        [...html.matchAll(pattern)].map(({ groups }) => groups?.href?.split("?")[0]);

      const pageScripts = new Set(hrefs(/<script [^>]*src="(?<href>[^"]+)"/gu));

      const playerChunks = [...html.matchAll(/<link [^>]*rel="preload"[^>]*>/gu)]
        .map(([tag]) => tag)
        .filter((tag) => tag.includes('as="script"') && /fetchPriority="low"/iu.test(tag))
        .map((tag) => /href="(?<href>[^"?]+)/u.exec(tag)?.groups?.href)
        .filter((href) => href && !pageScripts.has(href));

      expect(playerChunks.length).toBeGreaterThan(0);

      // Offline for a moment: the player's code doesn't arrive, and the page says so.
      const isPlayerChunk = (url: URL) => playerChunks.includes(url.pathname);
      await page.route(isPlayerChunk, (route) => route.abort("internetdisconnected"));
      await page.goto(path);
      await expect(page.getByText("This page didn't load")).toBeVisible();

      // Back online, "Try again" brings the explanation back.
      await page.unroute(isPlayerChunk);
      await page.getByRole("button", { name: "Try again" }).click();

      await expect(
        page.getByRole("main", { name: "Lesson content" }).getByText("The market isn't one price"),
      ).toBeVisible();
    });
  });

  test("a learner with only quick explanations starts a goal on Today", async ({ browser }) => {
    await asPersona(browser, { persona: "explain" }, async ({ page }) => {
      await page.goto("/today");

      await expect(page.getByRole("textbox", { name: "I want to" })).toBeVisible();
      await expect(page).toHaveURL(/\/today$/u);
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
      await palette.getByRole("combobox", { name: "Search" }).fill("market");
      const explanations = palette.getByRole("group", { name: "Quick explanations" });
      await explanations.getByRole("option", { name: /the market is up 2%/u }).click();

      await expect(page).toHaveURL(`/explain/${persona.goalId}`);
    });
  });

  test("an explanation reached for in the goal switcher or search opens with its player, even when code arrives slowly", async ({
    browser,
  }) => {
    for (const from of ["goal switcher", "search"] as const) {
      // oxlint-disable-next-line no-await-in-loop -- Each way in starts from a new tab, one after another.
      await asPersona(browser, { persona: "explain" }, async ({ page, user: persona }) => {
        await watchPaintedFrames(page, { skeleton: 'main [data-slot="skeleton"]' });
        const requests = followRequests(page);

        // Away from Today, whose link to an unfinished explanation loads the player already.
        await page.setViewportSize({ height: 900, width: 1280 });
        await page.goto("/stats");
        const explanation = await findExplanation(page, from);
        await expect(explanation).toBeVisible();

        // From here on code arrives as over a slow network. Pointing at the explanation starts
        // loading the player along with the page.
        await slowCodeFromNow(page);
        await explanation.hover();
        await requests.settled();
        await markPaintedFrames(page);

        await explanation.click();

        await expect(
          page
            .getByRole("main", { name: "Lesson content" })
            .getByText("The market isn't one price"),
          from,
        ).toBeVisible({ timeout: AT_ONCE_MS });

        await expect(page).toHaveURL(`/explain/${persona.goalId}`);

        const frames = await paintedFramesSince(page);
        const skeletons = frames.filter((frame) => frame.seen.skeleton !== "none");
        expect(skeletons, from).toEqual([]);
      });
    }
  });
});
