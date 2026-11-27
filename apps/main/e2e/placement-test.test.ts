import { prisma } from "@zoonk/db";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { type Page, expect, test } from "./fixtures";
import { ANSWERED, createMappedGoal } from "./onboarding-fixtures";

const STEPS = [
  "Write the equation",
  "Undo the addition",
  "Simplify both sides",
  "Check the answer",
];

/** A learn goal past onboarding whose topics each have a quick question and three to put in order. */
async function createLearnGoal(userId: string, { onboarding = false } = {}) {
  const goal = await createMappedGoal(userId);

  if (!onboarding) {
    await prisma.goal.update({
      data: {
        details: { answered: [...ANSWERED, "placement"], subject: "algebra" },
        planRevealedAt: new Date(),
      },
      where: { id: goal.id },
    });
  }

  const items = await prisma.planItem.findMany({
    select: { skillId: true },
    where: { plan: { goalId: goal.id }, skillId: { not: null } },
  });

  await Promise.all(
    [...new Set(items.flatMap((item) => item.skillId ?? []))].flatMap((skillId) =>
      ["first", "second", "third"].map((copy) =>
        itemFixture({
          content: {
            question: `Put the ${copy} steps in order.`,
            reason: "In order.",
            steps: STEPS,
          },
          format: "order",
          skillId,
        }),
      ),
    ),
  );

  return goal;
}

const confirm = (page: Page) => page.getByRole("button", { exact: true, name: "Confirm" }).click();

async function sortSteps(page: Page) {
  const list = page.getByRole("list", { name: "Steps, in your order" });
  const rows = list.getByRole("button");
  await expect(rows).toHaveCount(STEPS.length);
  await expect(rows.first()).toBeEnabled();

  // Each move starts from the order left by the last one.
  /* oxlint-disable no-await-in-loop */
  for (const [target, step] of STEPS.entries()) {
    const destination = rows.nth(target);

    if ((await destination.textContent()) !== step) {
      const row = list.getByRole("button", { exact: true, name: step });
      await row.dragTo(destination, { steps: 12 });
      await expect(destination).toHaveText(step);
    }
  }
  /* oxlint-enable no-await-in-loop */
}

/** The quick question asks "Solve x + a = b": its right answer is b - a. */
async function answerRight(page: Page) {
  const title = page.getByRole("heading", { level: 1, name: /Solve x \+|Put the/u });
  const text = await title.innerText();
  const solve = /x \+ (?<add>\d+) = (?<sum>\d+)/u.exec(text)?.groups;

  if (solve) {
    await page.getByRole("radio", { name: String(Number(solve.sum) - Number(solve.add)) }).click();
  } else {
    await sortSteps(page);
  }

  // The drag sensor suppresses clicks for 50 ms after pointer release.
  await page.getByRole("button", { exact: true, name: "Confirm" }).click({ delay: 80 });
  await expect(title.filter({ hasText: text })).toBeHidden();
}

const skippedLessons = (goalId: string) =>
  prisma.planItem.count({ where: { plan: { goalId }, status: "testedOut" } });

async function finishQuickTest(page: Page) {
  await page.getByRole("button", { exact: true, name: "Start" }).click();

  for (const _ of [1, 2, 3, 4]) {
    // oxlint-disable-next-line no-await-in-loop -- Questions come one at a time.
    await answerRight(page);
  }

  await page.getByRole("button", { name: "Stop and use my answers" }).click();
  await expect(page.getByRole("heading", { name: /^[1-9]\d* lessons? skipped$/u })).toBeVisible();
}

test.describe("Testing what you know from the plan", () => {
  test("a quick test skips lessons and Undo on the result restores them", async ({
    noProgressUser,
    userWithoutProgress: page,
  }, testInfo) => {
    const goal = await createLearnGoal(noProgressUser.id);

    await page.goto("/plan");
    await page.getByRole("link", { name: /Test what you know/u }).click();

    await expect(page.getByRole("heading", { name: "Skip what you already know" })).toBeVisible();

    await expect(page.getByRole("radio", { name: /Quick/u })).toBeChecked();
    await finishQuickTest(page);
    expect(await skippedLessons(goal.id)).toBeGreaterThan(0);

    await page.getByRole("button", { exact: true, name: "Undo" }).click();
    await expect(page.getByRole("heading", { name: "No lessons skipped" })).toBeVisible();
    await expect(page.getByText(/^The lessons? (?:is|are) back in your plan\.$/u)).toBeVisible();
    await expect(page.getByRole("button", { exact: true, name: "Undo" })).toBeHidden();
    await expect(page.getByRole("button", { exact: true, name: "Done" })).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath("placement-undo.png") });

    await page.getByRole("button", { exact: true, name: "Done" }).click();

    await expect(page.getByRole("link", { name: /Test what you know/u })).toBeVisible();
    expect(await skippedLessons(goal.id)).toBe(0);
  });

  test("a test from Plan only shows question writing while it waits", async ({
    noProgressUser,
    userWithoutProgress: page,
  }, testInfo) => {
    const goal = await createLearnGoal(noProgressUser.id);

    const topics = await prisma.planItem.findMany({
      select: { skillId: true },
      where: { plan: { goalId: goal.id }, skillId: { not: null } },
    });

    await prisma.item.deleteMany({
      where: { skillId: { in: topics.flatMap(({ skillId }) => skillId ?? []) } },
    });

    await page.goto("/placement-test");
    await page.getByRole("radio", { name: /Whole course/u }).click();
    await page.getByRole("button", { exact: true, name: "Start" }).click();

    await expect(
      page.getByText("Writing your questions", { exact: true }).filter({ visible: true }),
    ).toBeVisible();

    await expect(page.getByText("Reading your goal", { exact: true })).toBeHidden();
    await expect(page.getByText("Choosing what to learn", { exact: true })).toBeHidden();
    await page.screenshot({ path: testInfo.outputPath("placement-plan-wait.png") });
  });

  test("a later part waits for its own question after the first part's wait", async ({
    noProgressUser,
    userWithoutProgress: page,
  }, testInfo) => {
    const { goal, skills } = await languageGoalFixture({ userId: noProgressUser.id });
    const [first, second] = skills;

    if (!first || !second) {
      throw new Error("Expected a topic in each part");
    }

    const id = crypto.randomUUID();
    const now = new Date();
    const skillIds = [first.id, second.id];

    await prisma.goal.update({
      data: {
        details: {
          answered: [...ANSWERED, "placement"],
          level: "A2",
          placementTest: {
            attempt: {
              estimatedMinutes: 2,
              id,
              length: "wholeCourse",
              lessonsSkipped: 0,
              part: 1,
              partComplete: false,
              partPrepared: false,
              partSkillIds: [first.id],
              partStartedAt: now.toISOString(),
              skillIds,
            },
            result: null,
          },
        },
        planRevealedAt: now,
      },
      where: { id: goal.id },
    });

    const waiting = page.getByRole("heading", {
      exact: true,
      level: 1,
      name: "Getting your test ready",
    });

    await page.goto("/placement-test");
    await expect(waiting).toBeVisible();

    const firstQuestion = "What would you say first?";
    await itemFixture({ content: choiceItemContent(firstQuestion), skillId: first.id });
    await expect(page.getByRole("heading", { name: firstQuestion })).toBeVisible();
    await page.getByRole("button", { name: "I don't know yet" }).click();
    await page.getByRole("button", { exact: true, name: "Keep going" }).click();

    const secondQuestion = "What would you say next?";
    await expect(waiting).toBeVisible();
    await expect(page.getByRole("heading", { name: firstQuestion })).toBeHidden();

    await page.getByRole("link", { exact: true, name: "Leave" }).click();
    await expect(page).toHaveURL(/\/plan$/u);
    await page.getByRole("link", { name: /Level test/u }).click();
    await expect(waiting).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("placement-part-two-wait.png") });

    const item = await itemFixture({
      content: choiceItemContent(secondQuestion),
      skillId: second.id,
    });

    await expect(page.getByRole("heading", { name: secondQuestion })).toBeVisible();
    await expect(page.getByText("Part 2", { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("placement-part-two.png") });

    await page.getByRole("radio", { name: "Right answer" }).click();
    await confirm(page);

    await expect
      .poll(() => prisma.attempt.count({ where: { focusTestId: id, itemId: item.id } }))
      .toBe(1);
  });

  test("offers no B2 test-out while B2 has no lessons it could skip", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const { goal } = await languageGoalFixture({ userId: noProgressUser.id });

    await prisma.goal.update({
      data: {
        details: {
          answered: [...ANSWERED, "placement"],
          level: "B1",
          levelTest: {
            lastResult: {
              attemptId: null,
              finishedAt: new Date().toISOString(),
              lessonsSkipped: 0,
              levelsSkipped: [],
              ranges: { listening: { high: "B1", low: "A2" }, reading: { high: "B2", low: "B1" } },
            },
          },
        },
        planRevealedAt: new Date(),
      },
      where: { id: goal.id },
    });

    await page.goto("/plan");

    await expect(
      page.getByRole("button", { name: /English level Reading B1–B2\s*Listening A2–B1/u }),
    ).toBeVisible();

    await page.goto("/level-test");

    await expect(page.getByRole("heading", { name: "Skip what you already know" })).toBeVisible();

    await expect(page.getByRole("radio", { name: /Quick/u })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Test out of B2/u })).toBeHidden();
  });

  test("reopens and scores a test-out whose last answer was saved before finishing", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const { goal, skills } = await languageGoalFixture({ userId: noProgressUser.id });
    const skill = skills.at(0);

    if (!skill) {
      throw new Error("Expected a language topic");
    }

    const item = await itemFixture({ skillId: skill.id });
    const attemptId = crypto.randomUUID();

    await Promise.all([
      attemptFixture({
        focusTestId: attemptId,
        isPlacement: true,
        itemId: item.id,
        skillId: skill.id,
        userId: noProgressUser.id,
      }),
      prisma.goal.update({
        data: {
          details: {
            answered: [...ANSWERED, "placement"],
            level: "B1",
            levelTest: {
              testOut: {
                id: attemptId,
                level: "B2",
                questions: [{ id: item.id, skill: "reading", skillId: skill.id }],
              },
            },
          },
          planRevealedAt: new Date(),
        },
        where: { id: goal.id },
      }),
    ]);

    await page.goto("/level-test");
    await page.getByRole("radio", { name: /Test out of B2/u }).click();
    await page.getByRole("button", { exact: true, name: "Start" }).click();
    await expect(page.getByRole("heading", { name: "Your answers are saved" })).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "B2 stays in your plan" })).toBeVisible();
    const finished = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });

    expect(finished.details).toMatchObject({
      levelTest: { testOut: { id: attemptId, result: { finishedAt: expect.any(String) } } },
    });

    expect(await prisma.attempt.count({ where: { focusTestId: attemptId } })).toBe(1);
  });

  test("the last part of a language course test keeps its result until Done", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    const { goal, items, skills } = await languageGoalFixture({ userId: noProgressUser.id });
    const [first, , last] = skills;
    const [firstLesson] = items;

    if (!first || !last || !firstLesson) {
      throw new Error("Expected topics for both test parts");
    }

    const now = new Date();

    await Promise.all([
      prisma.goal.update({
        data: {
          details: {
            answered: [...ANSWERED, "placement"],
            level: "A2",
            placementTest: {
              assessmentId: crypto.randomUUID(),
              attempt: {
                estimatedMinutes: 1,
                id: crypto.randomUUID(),
                length: "wholeCourse",
                lessonsSkipped: 1,
                part: 2,
                partComplete: false,
                partPrepared: true,
                partSkillIds: [last.id],
                partStartedAt: now.toISOString(),
                remainingSkillIds: [last.id],
                skillIds: skills.map(({ id }) => id),
              },
              finishedParts: [
                {
                  knownSkillIds: [first.id],
                  lessonsSkipped: 1,
                  part: 1,
                  testedOutPlanItemIds: [firstLesson.id],
                },
              ],
              result: null,
            },
          },
          planRevealedAt: now,
        },
        where: { id: goal.id },
      }),
      prisma.planItem.update({
        data: { completedAt: now, status: "testedOut" },
        where: { id: firstLesson.id },
      }),
      itemFixture({ content: choiceItemContent("What would you say?"), skillId: last.id }),
      ...["first", "second", "third"].map((copy) =>
        itemFixture({
          content: {
            question: `Put the ${copy} steps in order.`,
            reason: "In order.",
            steps: STEPS,
          },
          format: "order",
          skillId: last.id,
        }),
      ),
    ]);

    await page.goto("/placement-test");
    await page.getByRole("radio", { name: "Right answer" }).click();
    await confirm(page);

    for (const _ of [1, 2, 3]) {
      // oxlint-disable-next-line no-await-in-loop -- Questions come one at a time.
      await answerRight(page);
    }

    const done = page.getByRole("button", { exact: true, name: "Done" });
    await expect(done).toBeEnabled();
    await expect(page).toHaveURL(/\/placement-test$/u);
    await done.click();
    await expect(page).toHaveURL(/\/plan$/u);

    await page.goto("/placement-test");
    await expect(page).toHaveURL(/\/level-test$/u);
  });

  test("a whole-course test picks up where the learner left and stops between parts", async ({
    noProgressUser,
    userWithoutProgress: page,
  }) => {
    await createLearnGoal(noProgressUser.id);

    await page.goto("/placement-test");
    await page.getByRole("radio", { name: /Whole course/u }).click();
    await page.getByRole("button", { exact: true, name: "Start" }).click();

    await expect(page.getByText("Part 1", { exact: true })).toBeVisible();
    await answerRight(page);

    await page.goto("/plan");

    await expect(
      page.getByRole("link", { name: /Test what you know.*In progress/u }),
    ).toBeVisible();

    await page.goto("/placement-test");
    await expect(page.getByRole("button", { name: "I don't know yet" })).toBeVisible();

    await page.reload();
    await answerRight(page);

    await page.getByRole("button", { name: "Stop and use my answers" }).click();
    await expect(page.getByText(/Your answers are saved\./u)).toBeVisible();

    await page.getByRole("button", { exact: true, name: "Finish for today" }).click();

    const row = page.getByRole("link", { name: /Test what you know.*In progress/u });
    await expect(row).toBeVisible();
    const rowTime = await row.getByText(/left$/u).innerText();
    const timeLeft = rowTime.replace(/^·\s*/u, "");

    await page.goto("/placement-test");
    await expect(page.getByRole("heading", { name: "Continue your test" })).toBeVisible();
    await expect(page.getByText(`About ${timeLeft}. Your answers are saved.`)).toBeVisible();
    await page.getByRole("button", { exact: true, name: "Keep going" }).click();
    await expect(page.getByText("Part 2", { exact: true })).toBeVisible();
  });
});

test("a test's skip appears on Plan and Today and can be undone from Today", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const goal = await createLearnGoal(noProgressUser.id);

  await page.goto("/placement-test");
  await finishQuickTest(page);
  await page.getByRole("button", { exact: true, name: "Done" }).click();

  const card = page.getByRole("region", { name: /^Skipped \d+ lessons? you already know/u });
  const undo = card.getByRole("button", { name: "Undo" });

  await expect(undo).toBeVisible();
  await page.getByRole("link", { exact: true, name: "Today" }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/today$/u);
  await expect(page.getByRole("heading", { exact: true, name: "Today" })).toBeVisible();
  await expect(undo).toBeVisible();
  await undo.click();

  await expect(card.getByText(/^The lessons? (?:is|are) back in your plan\.$/u)).toBeVisible();
  expect(await skippedLessons(goal.id)).toBe(0);
});

test("onboarding finishes after part one and the whole course continues from Plan", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const goal = await createLearnGoal(noProgressUser.id, { onboarding: true });

  await page.goto(`/start/${goal.id}`);
  await expect(page.getByRole("radio", { name: /Quick/u })).toBeChecked();
  await page.getByRole("radio", { name: /Whole course/u }).click();
  await page.getByRole("button", { exact: true, name: "Start" }).click();
  await expect(page.getByText("Part 1", { exact: true })).toBeVisible();
  await answerRight(page);

  await page.getByRole("button", { name: "Stop and use my answers" }).click();
  await expect(page.getByText("You can finish the test from Plan.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Keep going" })).toBeHidden();

  await page.reload();
  await expect(page.getByText("You can finish the test from Plan.")).toBeVisible();
  await page.getByRole("button", { exact: true, name: "Continue" }).click();

  await expect(page.getByRole("button", { name: "Adjust plan" })).toBeVisible();
  await page.getByRole("button", { exact: true, name: "Start" }).click();
  await expect(page).toHaveURL(/\/today$/u);
  await page.goto("/plan");

  await expect(page.getByRole("link", { name: /Test what you know.*In progress/u })).toBeVisible();
  await page.getByRole("link", { name: /Test what you know.*In progress/u }).click();
  await page.getByRole("button", { name: "Keep going" }).click();
  await expect(page.getByText("Part 2", { exact: true })).toBeVisible();
});

test("a saved retake result explains why it skipped nothing after Undo", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const goal = await createLearnGoal(noProgressUser.id, { onboarding: true });

  await prisma.goal.update({
    data: {
      details: {
        answered: ANSWERED,
        placementTest: {
          attempt: null,
          result: {
            attemptId: crypto.randomUUID(),
            finishedAt: new Date().toISOString(),
            heldUntilTomorrow: true,
            lessonsSkipped: 0,
          },
        },
        subject: "algebra",
      },
    },
    where: { id: goal.id },
  });

  await page.goto(`/start/${goal.id}`);

  await expect(page.getByRole("heading", { name: "No lessons skipped" })).toBeVisible();

  await expect(
    page.getByText("You undid these today. Answer again tomorrow to skip them."),
  ).toBeVisible();
});
