import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { expect, test } from "./fixtures";
import { openAs } from "./study-day";

async function createFocusTestLearner() {
  const user = await createE2EUser(getBaseURL());
  const suffix = randomUUID().slice(0, 6);
  const goal = await goalFixture({ details: { placementDeclined: true }, userId: user.id });

  const skills = await Promise.all(
    ["Algebra", "Geometry"].flatMap((area) =>
      Array.from({ length: 4 }, async (_, index) => ({
        area,
        skill: await skillFixture({ name: `${area} skill ${index + 1} ${suffix}` }),
      })),
    ),
  );

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Basics" }],
      skills: skills.map(({ area, skill }) => ({
        area,
        lessons: 2,
        name: skill.name,
        phase: 0,
        skillId: skill.id,
        weight: null,
      })),
    },
  });

  await Promise.all([
    learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ...skills.map(({ skill }) => itemFixture({ content: choiceItemContent(), skillId: skill.id })),
  ]);

  return { goal, plan, user };
}

async function countRecorded({ planId, userId }: { planId: string; userId: string }) {
  const [attempts, changes, events] = await Promise.all([
    prisma.attempt.count({ where: { userId } }),
    prisma.planChange.count({ where: { planId } }),
    prisma.learningEvent.count({ where: { lessonKind: "focusTest", userId } }),
  ]);

  return { attempts, changes, events };
}

test.describe("Focus test on a bad connection", () => {
  test("answers that reached the server but not back count once after Try again", async ({
    browser,
  }) => {
    const { goal, plan, user } = await createFocusTestLearner();
    const page = await openAs(browser, user);
    let dropped = false;

    await page.route("**/*", async (route) => {
      const request = route.request();
      const isAction = request.method() === "POST" && request.headers()["next-action"];
      const isAnswers = (request.postData() ?? "").includes('"itemId"');

      if (!dropped && isAction && isAnswers) {
        dropped = true;
        await route.fetch();
        await route.abort();
        return;
      }

      await route.fallback();
    });

    await page.goto(`/focus-test?goal=${goal.id}`);
    await page.getByRole("button", { name: "Start the test" }).click();

    const failed = page.getByText("That didn't go through. Your answers are kept.");

    await expect(async () => {
      if (await failed.isVisible()) {
        return;
      }

      await page.getByRole("button", { name: "I don't know yet" }).click({ timeout: 1000 });
      await expect(failed).toBeVisible({ timeout: 300 });
    }).toPass({ timeout: 30_000 });

    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("heading", { name: "How you did" })).toBeVisible();

    await expect(countRecorded({ planId: plan.id, userId: user.id })).resolves.toStrictEqual({
      attempts: 8,
      changes: 1,
      events: 1,
    });

    await page.context().close();
  });
});
