import { randomUUID } from "node:crypto";
import { expectAccessibleScreen } from "@zoonk/e2e/fixtures/accessibility";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import {
  chapterSkillFixture,
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";
import { openAs } from "./study-day";

const GENERATIONS_URL = "**/v1/goals/*/skills/*/outline/generations";
const OUTLINE_URL = /\/v1\/goals\/[^/]+\/skills\/[^/]+\/outline$/u;

/** The far topic starts two months from now, past the two weeks the plan writes ahead. */
const START_DAYS = 60;

/** "March", or "March 2027" once it's another year: when the row says the topic starts. */
function startMonth(date: Date): string {
  const sameYear = date.getUTCFullYear() === new Date().getUTCFullYear();

  return date.toLocaleString("en-US", {
    month: "long",
    timeZone: "UTC",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/**
 * A learner of a learn goal whose current phase holds a chapter to study now and a topic two
 * months away, its lessons not written yet: the plan teaches `lessons` of them (the graph sizes
 * the skill at 30). In two modules, Charts and Inference, each module's page lists its chapters;
 * in one, Inference, the Journey's path does. With `taught`, the course already teaches the far
 * topic in a chapter the plan studies first, and the stand-in is the rest of it.
 */
async function createLearner({
  lessons,
  modules,
  taught = false,
}: {
  lessons: number | null;
  modules: 1 | 2;
  taught?: boolean;
}) {
  const user = await createE2EUser(getBaseURL());
  const suffix = randomUUID().slice(0, 6);
  const start = new Date(Date.now() + START_DAYS * MS_PER_DAY);

  const [goal, course, chapter, now, far, written] = await Promise.all([
    goalFixture({ timezone: "UTC", title: `Learn statistics ${suffix}`, userId: user.id }),
    courseFixture({ language: "en", title: `Statistics ${suffix}` }),
    libraryChapterFixture({ title: "Reading charts" }),
    skillFixture({ name: `Read a bar chart ${suffix}` }),
    skillFixture({ level: "beginner", name: `Compare two means ${suffix}` }),
    libraryChapterFixture({ title: `Means and medians ${suffix}` }),
  ]);

  const [plan] = await Promise.all([
    planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "Statistics basics" }],
        skills: [
          { area: modules === 2 ? "Charts" : "Inference", size: 2, skill: now },
          { area: "Inference", size: 30, skill: far },
        ].map(({ area, size, skill }) => ({
          area,
          courseIds: [course.id],
          lessons: size,
          name: skill.name,
          phase: 0,
          skillId: skill.id,
          weight: null,
        })),
      },
      phases: [{ name: "Statistics basics" }],
    }),
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
  ]);

  await Promise.all([
    planItemFixture({ chapterId: chapter.id, planId: plan.id, position: 0, skillId: now.id }),
    planItemFixture({
      lessons,
      planId: plan.id,
      position: 2,
      scheduledFor: start,
      skillId: far.id,
    }),
    taught && teachInCourse({ chapterId: written.id, courseId: course.id, skillId: far.id }),
    taught &&
      planItemFixture({ chapterId: written.id, planId: plan.id, position: 1, skillId: far.id }),
  ]);

  return { far, start, user, written };
}

/** A chapter of the course with a lesson, teaching the skill. */
async function teachInCourse({
  chapterId,
  courseId,
  skillId,
}: {
  chapterId: string;
  courseId: string;
  skillId: string;
}) {
  const lesson = await libraryLessonFixture();

  await Promise.all([
    courseChapterFixture({ chapterId, courseId }),
    chapterLessonFixture({ chapterId, lessonId: lesson.id }),
    chapterSkillFixture({ chapterId, skillId }),
  ]);
}

test.describe("Far topics", () => {
  test("say what the plan knows about them and show their lessons on a tap", async ({
    browser,
  }) => {
    const { far, start, user, written } = await createLearner({ lessons: 12, modules: 2 });
    const page = await openAs(browser, user);
    let outline: "available" | "ready" | "writing" = "available";
    let requested = 0;

    await page.route(GENERATIONS_URL, async (route) => {
      requested += 1;
      outline = "writing";
      await route.fulfill({ json: { generationId: "run-1", status: "writing" }, status: 202 });
    });

    await page.route(OUTLINE_URL, (route) =>
      route.fulfill({
        json: {
          chapters: outline === "ready" ? [{ chapterId: written.id, title: written.title }] : [],
          status: outline,
        },
        status: 200,
      }),
    );

    await page.goto("/journey/inference");

    // Instead of "Lessons on the way" for months, the row says the lessons the plan teaches it.
    const row = page.getByRole("button", { name: new RegExp(far.name, "u") });
    await expect(row).toContainText("About 12 lessons");

    // Opening it reads its lesson plan; it writes nothing until the tap.
    await row.click();
    const sheet = page.getByRole("dialog", { name: far.name });
    await expect(sheet.getByText(`About 12 lessons · from ${startMonth(start)}`)).toBeVisible();
    await expect(sheet.getByText(/planned two weeks before you get to it/u)).toBeVisible();
    expect(requested).toBe(0);
    await expectAccessibleScreen(page, "a far topic's sheet");

    await sheet.getByRole("button", { name: "See the lessons" }).click();
    await expect(sheet.getByRole("status")).toHaveText(/Preparing the lessons/u);
    await expect(sheet.getByRole("button", { name: "See the lessons" })).toBeHidden();
    expect(requested).toBe(1);

    // Its first chapter lands: the sheet lists it without a reload (it reads every few seconds).
    outline = "ready";

    const chapterLink = sheet.getByRole("link", { name: written.title });
    await expect(chapterLink).toBeVisible({ timeout: 10_000 });
    // From the module's page, the chapter's page leads back to it.
    await expect(chapterLink).toHaveAttribute(
      "href",
      `/content/chapters/${written.id}?from=inference`,
    );

    await page.context().close();
  });

  test("a free learner past the day's topics seen ahead of time sees until when, and Plus", async ({
    browser,
  }) => {
    // A topic the plan teaches in one lesson says so, without "about".
    const { start, user } = await createLearner({ lessons: 1, modules: 1 });
    const page = await openAs(browser, user);

    await page.route(GENERATIONS_URL, (route) =>
      route.fulfill({
        json: {
          error: {
            code: "USAGE_LIMIT_REACHED",
            details: { limit: { limit: 3, period: "day", resource: "outline", tier: "free" } },
            message: "The plan's limit is reached",
          },
        },
        status: 402,
      }),
    );

    await page.route(OUTLINE_URL, (route) =>
      route.fulfill({ json: { chapters: [], status: "available" }, status: 200 }),
    );

    // One module: the Journey's path lists the chapters, the far topic under its module's name.
    await page.goto("/journey");
    const path = page.getByRole("list", { name: "Your journey" });
    const row = path.getByRole("button", { name: /^Inference/u });
    await expect(row).toContainText(`1 lesson · from ${startMonth(start)}`);
    await expect(row).not.toContainText("About");

    await row.click();
    const sheet = page.getByRole("dialog", { name: "Inference" });
    await sheet.getByRole("button", { name: "See the lessons" }).click();

    await expect(
      sheet.getByText(
        "That's all the topics you can see ahead of time today. You can see more tomorrow, or get Plus to keep going now.",
      ),
    ).toBeVisible();

    await expect(sheet.getByRole("link", { name: "See Plus" })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "See the lessons" })).toBeDisabled();

    await page.context().close();
  });

  // Maya's "More lessons" sheet listed the chapters above it: its topic was the rest of a skill a
  // chapter already teaches, whose next chapter the plan writes as she gets close. The row still
  // says what the plan knows, and opens nothing.
  test("the rest of a topic a chapter already teaches says what the plan knows, without a sheet", async ({
    browser,
  }) => {
    const path = await createLearner({ lessons: 12, modules: 1, taught: true });
    const modules = await createLearner({ lessons: 12, modules: 2, taught: true });
    const page = await openAs(browser, path.user);
    let outlineReads = 0;

    await page.route(OUTLINE_URL, async (route) => {
      outlineReads += 1;
      await route.continue();
    });

    await page.goto("/journey");
    const journey = page.getByRole("list", { name: "Your journey" });
    await expect(journey.getByRole("link", { name: path.written.title })).toBeVisible();

    const row = journey
      .getByText(`About 12 lessons · from ${startMonth(path.start)}`)
      .locator("xpath=ancestor::li[1]");

    await expect(row).toContainText("Inference");
    await expect(row.getByRole("button")).toHaveCount(0);
    await page.context().close();

    // A module's page lists it by its skill, the same way.
    const modulePage = await openAs(browser, modules.user);

    await modulePage.route(OUTLINE_URL, async (route) => {
      outlineReads += 1;
      await route.continue();
    });

    await modulePage.goto("/journey/inference");
    await expect(modulePage.getByText(modules.far.name).first()).toBeVisible();
    await expect(modulePage.getByText("About 12 lessons").first()).toBeVisible();

    await expect(
      modulePage.getByRole("button", { name: new RegExp(modules.far.name, "u") }),
    ).toHaveCount(0);

    expect(outlineReads).toBe(0);
    await modulePage.context().close();
  });

  // A plan saved before it stored how many lessons it teaches a topic says only when it starts,
  // never a count it doesn't know, until its next change saves them.
  test("a far topic of a plan saved before its sizes says only when it starts", async ({
    browser,
  }) => {
    const { start, user } = await createLearner({ lessons: null, modules: 1 });
    const page = await openAs(browser, user);

    await page.goto("/journey");

    const row = page
      .getByRole("list", { name: "Your journey" })
      .getByRole("button", { name: /^Inference/u });

    await expect(row).toContainText(`From ${startMonth(start)}`);
    await expect(row).not.toContainText("lesson");

    await page.context().close();
  });
});
