import { randomUUID } from "node:crypto";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { expect, test } from "./fixtures";
import { openAs } from "./study-day";

const GENERATIONS_URL = "**/v1/goals/*/skills/*/outline/generations";
const OUTLINE_URL = /\/v1\/goals\/[^/]+\/skills\/[^/]+\/outline$/u;

/** The far topic starts two months from now, past the two weeks the plan writes ahead. */
const START_DAYS = 60;

/**
 * A learner of a learn goal whose current phase holds a chapter to study now, in the Charts module,
 * and a topic two months away, in the Inference module, its lessons not written yet. Each module's
 * page lists its chapters.
 */
async function createLearner() {
  const user = await createE2EUser(getBaseURL());
  const suffix = randomUUID().slice(0, 6);
  const start = new Date(Date.now() + START_DAYS * MS_PER_DAY);

  const [goal, course, chapter, now, far] = await Promise.all([
    goalFixture({ timezone: "UTC", title: `Learn statistics ${suffix}`, userId: user.id }),
    courseFixture({ language: "en", title: `Statistics ${suffix}` }),
    libraryChapterFixture({ title: "Reading charts" }),
    skillFixture({ name: `Read a bar chart ${suffix}` }),
    skillFixture({ level: "beginner", name: `Compare two means ${suffix}` }),
  ]);

  const [plan] = await Promise.all([
    planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "Statistics basics" }],
        skills: [
          { area: "Charts", size: 2, skill: now },
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
      lessons: 12,
      planId: plan.id,
      position: 2,
      scheduledFor: start,
      skillId: far.id,
    }),
  ]);

  return { far, user };
}

test.describe("Far topics", () => {
  test("write their lessons only once the learner taps", async ({ browser }) => {
    const { far, user } = await createLearner();
    const page = await openAs(browser, user);
    let requested = 0;

    await page.route(GENERATIONS_URL, async (route) => {
      requested += 1;
      await route.fulfill({ json: { generationId: "run-1", status: "writing" }, status: 202 });
    });

    await page.route(OUTLINE_URL, (route) =>
      route.fulfill({
        json: { chapters: [], status: requested > 0 ? "writing" : "available" },
        status: 200,
      }),
    );

    await page.goto("/plan/inference");

    // Opening it reads its lesson plan; it writes nothing until the tap.
    await page.getByRole("button", { name: new RegExp(far.name, "u") }).click();
    const sheet = page.getByRole("dialog", { name: far.name });
    const see = sheet.getByRole("button", { name: "See the lessons" });
    await expect(see).toBeVisible();
    expect(requested).toBe(0);

    await see.click();
    await expect(sheet.getByRole("status")).toHaveText(/Preparing the lessons/u);
    expect(requested).toBe(1);

    await page.context().close();
  });
});
