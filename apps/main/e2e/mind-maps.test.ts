import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { expect, test } from "./fixtures";
import { openAs } from "./study-day";

const GENERATIONS_URL = "**/v1/goals/*/chapters/*/mind-map/generations";
const MAP_URL = /\/v1\/goals\/[^/]+\/chapters\/[^/]+\/mind-map$/u;

/** A picture main serves itself, standing in for the map's on the CDN. */
const PICTURE = "/catalog/chapters/science.webp";

const structure = {
  branches: ["Nucleus", "Membrane", "Cytoplasm"].map((title) => ({
    drawing: "a cell",
    explanation: `What the ${title.toLowerCase()} does.`,
    points: [`${title} point`],
    title,
  })),
  centralIdea: "Each part of a cell has a job.",
  comparison: null,
  summary: "A cell's parts work together.",
  title: "Cell parts",
};

/**
 * A learner whose plan has finished two chapters of written lessons and is in a third. The first
 * finished chapter has no map yet; the second's picture failed its check, so its map is in words.
 */
async function createLearner() {
  const user = await createE2EUser(getBaseURL());
  const suffix = randomUUID().slice(0, 6);

  const [goal, cells, energy, current, ...lessons] = await Promise.all([
    goalFixture({ timezone: "UTC", title: `Biology ${suffix}`, userId: user.id }),
    libraryChapterFixture({ title: `Cell parts ${suffix}` }),
    libraryChapterFixture({ title: `Cell energy ${suffix}` }),
    libraryChapterFixture({ title: `Cell division ${suffix}` }),
    ...[1, 2, 3].map((index) =>
      libraryLessonFixture({ contentStatus: "completed", title: `Cell lesson ${index} ${suffix}` }),
    ),
  ]);

  const chapters = [cells, energy, current];

  const [plan] = await Promise.all([
    planFixture({ goalId: goal.id }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ...lessons.map((lesson, index) =>
      chapterLessonFixture({
        chapterId: chapters[index]?.id ?? "",
        lessonId: lesson.id,
        position: 0,
      }),
    ),
  ]);

  await Promise.all([
    ...lessons.map((lesson, position) =>
      planItemFixture({
        chapterId: chapters[position]?.id ?? null,
        lessonId: lesson.id,
        planId: plan.id,
        position,
        status: position < 2 ? "done" : "todo",
        titleSnapshot: lesson.title,
      }),
    ),
    prisma.chapterMindMap.create({
      data: { chapterId: energy.id, language: "en", status: "completed", structure },
    }),
  ]);

  return { cells, current, energy, user };
}

/** What the run would save once it drew the map: its outline and picture. */
function drawMap(chapterId: string) {
  return prisma.chapterMindMap.update({
    data: {
      generatedAt: new Date(),
      imageHeight: 1024,
      imageUrl: PICTURE,
      imageWidth: 1024,
      status: "completed",
      structure,
      thumbnailUrl: PICTURE,
    },
    where: { chapterId },
  });
}

test.describe("Mind maps", () => {
  test("a finished chapter's map is made on a tap, opens full screen and is listed with the goal's maps", async ({
    browser,
  }) => {
    const { cells, current, energy, user } = await createLearner();
    const page = await openAs(browser, user);
    let drawn = false;

    await page.route(GENERATIONS_URL, async (route) => {
      // The API's request claims the map before its run starts.
      await prisma.chapterMindMap.create({
        data: { chapterId: cells.id, language: "en", status: "running" },
      });

      await route.fulfill({ json: { generationId: "run-1", status: "generating" }, status: 202 });
    });

    await page.route(MAP_URL, (route) =>
      route.fulfill({ json: { status: drawn ? "ready" : "generating" }, status: 200 }),
    );

    // A chapter still to study has no map to offer.
    await page.goto(`/content/chapters/${current.id}`);
    await expect(page.getByRole("heading", { level: 1, name: current.title })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create the mind map" })).toBeHidden();

    await page.goto(`/content/chapters/${cells.id}`);
    const reference = page.getByRole("region", { name: "For reference" });
    await expect(reference.getByText("The chapter's main ideas in one picture")).toBeVisible();
    await expectAccessibleScreen(page, "a finished chapter without its mind map");

    await reference.getByRole("button", { name: "Create the mind map" }).click();
    await expect(reference.getByRole("status")).toHaveText(/Drawing the mind map/u);

    // The run finishes: the page shows the map without a reload.
    await drawMap(cells.id);
    drawn = true;

    // The page reads the map's status every four seconds while it's made.
    const open = reference.getByRole("button", { name: /^Mind map: Cell parts\./u });
    await expect(open).toBeVisible({ timeout: 10_000 });

    // Screen readers hear the picture's short alt, then the whole map in words; nobody else
    // sees a second copy of it.
    await expect(open.getByRole("img")).toHaveAttribute(
      "alt",
      "Mind map: Cell parts. Each part of a cell has a job.",
    );

    await expect(open).toHaveAccessibleDescription(/What the membrane does\./u);
    await expect(open).toHaveAccessibleDescription(/A cell's parts work together\./u);
    await expect(reference.getByText("What the membrane does.")).toBeHidden();

    await reference.getByRole("button", { name: "Full screen" }).click();
    const viewer = page.getByRole("dialog", { name: cells.title });

    await expect(
      viewer.getByRole("img", { name: /^Mind map: Cell parts\./u }),
    ).toHaveAccessibleDescription(/What the nucleus does\./u);

    const download = viewer.getByRole("link", { name: "Download" });
    await expect(download).toHaveAttribute("download", /\.webp$/u);
    await expect(viewer.getByRole("button", { name: "Fit to screen" })).toBeDisabled();

    await page.keyboard.press("+");
    await expect(viewer.getByRole("button", { name: "Fit to screen" })).toContainText("160%");
    await viewer.getByRole("button", { name: "Zoom out" }).click();
    await expect(viewer.getByRole("button", { name: "Fit to screen" })).toContainText("100%");
    await expectAccessibleScreen(page, "the mind map viewer");

    await page.keyboard.press("Escape");
    await expect(viewer).toBeHidden();
    await expect(reference.getByRole("button", { name: "Full screen" })).toBeFocused();

    // Every map of the goal, from the Journey.
    await page.goto("/journey");
    await page.getByRole("link", { name: /^Mind maps/u }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Mind maps" })).toBeVisible();

    const finished = page.getByRole("region", { name: "Chapters you finished" });
    await expect(finished.getByRole("listitem")).toHaveCount(2);
    await expectAccessibleScreen(page, "a goal's mind maps");

    // A map whose picture failed its check opens its chapter, where it's in words.
    await expect(
      finished.getByRole("link", { name: new RegExp(energy.title, "u") }),
    ).toHaveAttribute("href", `/content/chapters/${energy.id}`);

    await finished.getByRole("button", { name: new RegExp(cells.title, "u") }).click();
    const listed = page.getByRole("dialog", { name: cells.title });

    await expect(
      listed.getByRole("img", { name: /^Mind map: Cell parts\./u }),
    ).toHaveAccessibleDescription(/What the cytoplasm does\./u);

    await page.context().close();
  });

  test("a chapter passed with its test before any of its lessons was written gets no maps entry until one is", async ({
    browser,
  }) => {
    const user = await createE2EUser(getBaseURL());
    const suffix = randomUUID().slice(0, 6);

    const [goal, chapter, lesson] = await Promise.all([
      goalFixture({ timezone: "UTC", title: `Chemistry ${suffix}`, userId: user.id }),
      libraryChapterFixture({ title: `Atoms ${suffix}` }),
      libraryLessonFixture({ contentStatus: "pending", title: `Atom lesson ${suffix}` }),
    ]);

    const [plan] = await Promise.all([
      planFixture({ goalId: goal.id }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
      chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position: 0 }),
    ]);

    await planItemFixture({
      chapterId: chapter.id,
      lessonId: lesson.id,
      planId: plan.id,
      status: "testedOut",
      titleSnapshot: lesson.title,
    });

    const page = await openAs(browser, user);

    // Nothing was written to draw a map from, so the Journey doesn't offer an empty page.
    await page.goto("/journey");
    await expect(page.locator('[data-slot="journey"]')).toBeVisible();
    await expect(page.getByRole("link", { name: /^Mind maps/u })).toHaveCount(0);

    // Once another learner's plan has the lesson written, the chapter can get its map.
    await prisma.lesson.update({ data: { contentStatus: "completed" }, where: { id: lesson.id } });
    await page.reload();
    await page.getByRole("link", { name: /^Mind maps/u }).click();

    const finished = page.getByRole("region", { name: "Chapters you finished" });
    await expect(finished.getByRole("listitem")).toHaveCount(1);
    await expect(finished).toContainText(chapter.title);
    await page.context().close();
  });

  for (const [period, message] of [
    ["day", "That's all the new mind maps for today."],
    ["month", "That's all the new mind maps for this month."],
  ] as const) {
    test(`says when a free learner made this ${period}'s mind maps`, async ({ browser }) => {
      const { cells, user } = await createLearner();
      const page = await openAs(browser, user);

      // The API's refusal of a free learner's new map past their plan's cap (`usageDecisionError`).
      await page.route(GENERATIONS_URL, (route) =>
        route.fulfill({
          json: {
            error: {
              code: "USAGE_LIMIT_REACHED",
              details: { limit: { limit: 3, period, resource: "mindMap", tier: "free" } },
              message: "This plan's limit is reached",
            },
          },
          status: 402,
        }),
      );

      await page.goto(`/content/chapters/${cells.id}`);
      await page.getByRole("button", { name: "Create the mind map" }).click();

      // Nothing is hidden: the button stays in sight, disabled, and the notice's link is the one
      // thing left to do.
      const reference = page.getByRole("region", { name: "For reference" });
      await expect(reference.getByText(message)).toBeVisible();
      await expect(reference.getByRole("link", { name: "See Plus" })).toBeVisible();
      await expect(reference.getByRole("button", { name: "Create the mind map" })).toBeDisabled();

      // The goal's maps page says the same under the chapter's tile.
      await page.goto("/mind-maps");
      const finished = page.getByRole("region", { name: "Chapters you finished" });
      const tile = finished.getByRole("listitem").filter({ hasText: cells.title });
      await tile.getByRole("button", { name: "Create" }).click();
      await expect(tile.getByText(message)).toBeVisible();
      await expect(tile.getByRole("link", { name: "See Plus" })).toBeVisible();
      await expect(tile.getByRole("button", { name: "Create" })).toBeDisabled();
      await page.context().close();
    });
  }
});
