import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { getDateInTimeZone, getLocalTimeZone } from "@zoonk/utils/time-zone";
import { type Page, expect, test } from "./fixtures";
import { MODES, type Mode, setDeviceMode } from "./learn-personas";
import { ANSWERED, createMappedGoal } from "./onboarding-fixtures";

/**
 * The end of onboarding: placement while the plan is being made, then the plan in the learner's
 * mode. The goal is one whose skill map is already written, the way the goal workflow leaves it.
 */

/** Placement asks up to this many questions a day (`DAY_PLACEMENT_ANSWERS` in core). */
const DAY_PLACEMENT_ANSWERS = 12;

async function openOnboarding(page: Page, { goalId, mode }: { goalId: string; mode: Mode }) {
  await setDeviceMode(page.context(), mode);
  await page.goto(`/start/${goalId}`);
}

for (const mode of MODES) {
  test.describe(`Placement and the plan in ${mode} mode`, () => {
    test("placement adapts to answers, welcomes 'I don't know yet' and ends with the plan", async ({
      noProgressUser,
      userWithoutProgress: page,
    }) => {
      const goal = await createMappedGoal(noProgressUser.id);
      await openOnboarding(page, { goalId: goal.id, mode });

      await expect(
        page.getByRole("heading", { name: "Let's see what you already know" }),
      ).toBeVisible();

      await page.getByRole("button", { exact: true, name: "Start" }).click();

      await expect(page.getByRole("heading", { name: /^Question/u })).toBeVisible();
      // What it's about and how many so far: no total and no score.
      await expect(page.getByText("Question 1", { exact: true })).toBeVisible();
      await expect(page.getByText("Algebra", { exact: true })).toBeVisible();
      const first = await page.getByRole("heading", { name: /^Question/u }).textContent();
      await page.keyboard.press("1");
      await expect(page.getByRole("radio", { name: /Right answer/u })).toBeChecked();
      await page.keyboard.press("Enter");

      await expect(page.getByRole("heading", { name: /^Question/u })).not.toHaveText(first ?? "");
      await expect(page.getByText("Question 2", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "I don't know yet" }).click();

      await expect(page.getByRole("heading", { name: /^Question/u })).toBeVisible();
      await page.getByRole("button", { name: "Stop here and see my plan" }).click();

      await expect(page.getByText(mode === "fun" ? "Route ready" : "Plan ready")).toBeVisible();
      await expect(page.getByRole("heading", { level: 1, name: goal.title })).toBeVisible();

      await expect(page.getByRole("link", { name: "Start day 1" })).toHaveAttribute(
        "href",
        "/today",
      );

      await expect(
        mode === "fun"
          ? page.getByRole("list", { name: "Phases of your route" })
          : page.getByText(/Phase 1:/u),
      ).toBeVisible();

      // A phase's size is never "0 h", even before the planner timed its lessons.
      await expect(page.getByText(/~0 h/u)).toHaveCount(0);

      const [attempts, saved] = await Promise.all([
        prisma.attempt.count({ where: { itemId: { not: null }, userId: noProgressUser.id } }),
        prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
      ]);

      expect(attempts).toBeGreaterThanOrEqual(2);
      expect(saved.details).toMatchObject({ answered: expect.arrayContaining(["placement"]) });
    });

    test("starting from scratch skips placement and shows the plan", async ({
      noProgressUser,
      userWithoutProgress: page,
    }) => {
      const goal = await createMappedGoal(noProgressUser.id);
      await openOnboarding(page, { goalId: goal.id, mode });

      await page.getByRole("button", { name: "I'd rather start from scratch" }).click();
      await expect(page.getByRole("heading", { level: 1, name: goal.title })).toBeVisible();

      await expect(
        page
          .getByRole("list", { name: "Your plan in numbers" })
          .getByRole("listitem")
          .filter({ hasText: "minutes a day" }),
      ).toHaveText("30minutes a day");
    });
  });
}

test("the plan shows lessons still being written as such, never by a skill's raw name", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const goal = await createMappedGoal(noProgressUser.id);
  await openOnboarding(page, { goalId: goal.id, mode: "focus" });

  await page.getByRole("button", { name: "I'd rather start from scratch" }).click();
  await expect(page.getByRole("heading", { level: 1, name: goal.title })).toBeVisible();

  await expect(page.getByText("Lessons being written").first()).toBeVisible();
  await expect(page.getByText("Lesson 1", { exact: true })).toHaveCount(0);
});

test("an exam's placement starts with the areas it covers", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const id = randomUUID();

  const blueprint = await prisma.examBlueprint.create({
    data: {
      country: "BR",
      identityKey: `e2e-exam-${id}`,
      language: "en",
      model: "test",
      name: `Test exam ${id}`,
      promptVersion: "test",
      runId: "test",
      structure: {
        formats: [],
        mock: null,
        rules: [],
        subjects: ["Languages", "Humanities", "Science", "Math"].map((name) => ({
          citation: { passage: name, sourceId: id },
          name,
          questions: 45,
          topics: [],
          weight: null,
        })),
      },
    },
  });

  const goal = await createMappedGoal(noProgressUser.id);

  await prisma.goal.update({
    data: {
      details: { answered: [...ANSWERED, "target"], subject: "ENEM" },
      examBlueprintId: blueprint.id,
      kind: "exam",
    },
    where: { id: goal.id },
  });

  await openOnboarding(page, { goalId: goal.id, mode: "focus" });

  await expect(page.getByText(/Quick questions from the 4 areas below/u)).toBeVisible();

  await expect(page.getByRole("list", { name: "Subjects" }).getByRole("listitem")).toHaveText([
    "Languages",
    "Humanities",
    "Science",
    "Math",
  ]);
});

test("after an answer, placement waits for its next questions instead of repeating one", async ({
  noProgressUser,
  userWithoutProgress: page,
}) => {
  const id = randomUUID().slice(0, 8);

  const goal = await goalFixture({
    details: { answered: ANSWERED, subject: "algebra" },
    prompt: `learn algebra ${id}`,
    title: `Learn algebra ${id}`,
    userId: noProgressUser.id,
  });

  const skills = await Promise.all(
    [1, 2, 3].map((index) => skillFixture({ name: `Skill ${index} ${id}` })),
  );

  // The skill map is written, but questions exist only for the middle skill so far.
  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Stage 1" }],
      skills: skills.map((skill) => ({
        area: null,
        lessons: 1,
        name: skill.name,
        phase: 0,
        skillId: skill.id,
        weight: null,
      })),
    },
  });

  await Promise.all([
    ...skills.map((skill, position) =>
      planItemFixture({
        kind: "lesson",
        phase: 0,
        planId: plan.id,
        position,
        skillId: skill.id,
        titleSnapshot: `Lesson ${position + 1}`,
      }),
    ),
    itemFixture({ content: choiceItemContent(`First ${id}?`), skillId: skills[1]?.id ?? "" }),
  ]);

  await openOnboarding(page, { goalId: goal.id, mode: "focus" });
  await page.getByRole("button", { exact: true, name: "Start" }).click();

  await expect(page.getByText("Question 1", { exact: true })).toBeVisible();
  await page.keyboard.press("1");
  await expect(page.getByRole("radio", { name: /Right answer/u })).toBeChecked();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: "Getting your questions ready" })).toBeVisible();

  await itemFixture({ content: choiceItemContent(`Next ${id}?`), skillId: skills[2]?.id ?? "" });

  await expect(page.getByText("Question 2", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: new RegExp(`Next ${id}`, "u") })).toBeVisible();
});

for (const mode of MODES) {
  test.describe(`Typed placement answers in ${mode} mode`, () => {
    test("a right pick is confirmed with an answer in the learner's own words", async ({
      noProgressUser,
      userWithoutProgress: page,
    }) => {
      const id = randomUUID().slice(0, 8);

      const [goal, skill] = await Promise.all([
        goalFixture({
          details: { answered: ANSWERED, subject: "fractions" },
          prompt: `learn fractions ${id}`,
          title: `Learn fractions ${id}`,
          userId: noProgressUser.id,
        }),
        skillFixture({ name: `Adding fractions ${id}` }),
      ]);

      const plan = await planFixture({
        goalId: goal.id,
        graph: {
          phases: [{ milestone: null, name: "Stage 1" }],
          skills: [
            { area: null, lessons: 1, name: skill.name, phase: 0, skillId: skill.id, weight: null },
          ],
        },
      });

      await Promise.all([
        planItemFixture({
          kind: "lesson",
          phase: 0,
          planId: plan.id,
          position: 0,
          skillId: skill.id,
          titleSnapshot: "Lesson 1",
        }),
        itemFixture({ content: choiceItemContent(`Quick ${id}?`), skillId: skill.id }),
        itemFixture({
          content: {
            acceptedAnswers: ["5/6"],
            context: null,
            keyPoints: ["Adds the fractions as sixths"],
            question: `How much is 1/2 + 1/3? ${id}`,
            sampleAnswer: "3/6 + 2/6 = 5/6",
          },
          format: "typed",
          skillId: skill.id,
        }),
      ]);

      await openOnboarding(page, { goalId: goal.id, mode });
      await page.getByRole("button", { exact: true, name: "Start" }).click();

      await expect(page.getByText("Question 1", { exact: true })).toBeVisible();
      await page.keyboard.press("1");
      await page.keyboard.press("Enter");

      // A right pick could be a guess, so the next question asks for the answer in words.
      await expect(page.getByText("Question 2", { exact: true })).toBeVisible();
      const answer = page.getByLabel("Your answer, in your own words");
      await expect(answer).toBeFocused();
      await answer.fill("5/6");

      // Enter sends it once the question is ready, like Confirm.
      await expect(page.getByRole("button", { name: "Confirm" })).toBeEnabled();
      await page.keyboard.press("Enter");

      // Both answers settle the only skill, so placement is done.
      await expect(page.getByText("Your starting point is set")).toBeVisible();
      await page.getByRole("button", { name: "See my plan" }).click();

      await expect(page.getByText(mode === "fun" ? "Route ready" : "Plan ready")).toBeVisible();

      await expect(
        prisma.attempt.findFirst({
          where: { item: { format: "typed" }, userId: noProgressUser.id },
        }),
      ).resolves.toMatchObject({ isCorrect: true });
    });

    test("stops after the day's few minutes and leaves the rest to the first sessions", async ({
      noProgressUser,
      userWithoutProgress: page,
    }) => {
      const goal = await createMappedGoal(noProgressUser.id);

      // The plan's first skill: right answers there leave the skills after it still to ask about.
      const first = await prisma.planItem.findFirstOrThrow({
        orderBy: { position: "asc" },
        where: { plan: { goalId: goal.id } },
      });

      const item = await prisma.item.findFirstOrThrow({ where: { skillId: first.skillId ?? "" } });

      // Earlier today, placement already took all but one of the day's answers. "Today" is the
      // learner's day in the browser's time zone, which differs from the UTC day late at night.
      const localDate = getDateInTimeZone({ date: new Date(), timeZone: getLocalTimeZone() });

      await Promise.all(
        Array.from({ length: DAY_PLACEMENT_ANSWERS - 1 }, () =>
          attemptFixture({
            itemId: item.id,
            localDate,
            skillId: item.skillId,
            userId: noProgressUser.id,
          }),
        ),
      );

      await openOnboarding(page, { goalId: goal.id, mode });
      await page.getByRole("button", { exact: true, name: "Start" }).click();

      await expect(page.getByRole("heading", { name: /^Question/u })).toBeVisible();
      await page.keyboard.press("1");
      await page.keyboard.press("Enter");

      await expect(page.getByText("That's enough questions for today")).toBeVisible();
      await expect(page.getByText(/Your first sessions ask a few more/u)).toBeVisible();
      await page.getByRole("button", { name: "See my plan" }).click();
      await expect(page.getByText(mode === "fun" ? "Route ready" : "Plan ready")).toBeVisible();
    });
  });
}
