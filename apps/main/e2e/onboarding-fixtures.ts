import { randomUUID } from "node:crypto";
import { type Locator, type Page, expect } from "@playwright/test";
import { PROFILE_QUESTIONS } from "@zoonk/core/profile/questions/contract";
import { prisma } from "@zoonk/db";
import {
  goalFixture,
  planFixture,
  planItemFixture,
  plannedSkills,
} from "@zoonk/testing/fixtures/goals";
import {
  choiceItemContent,
  itemFixture,
  skillFixture,
  skillPrerequisiteFixture,
} from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { z } from "zod";

const seededKeySchema = z.object({
  options: z.array(z.object({ isCorrect: z.boolean(), text: z.string() })).optional(),
  pairs: z.array(z.object({ left: z.string(), right: z.string() })).optional(),
  question: z.string(),
  steps: z.array(z.string()).optional(),
});

const PHASES = [
  {
    name: "Expressions and first equations",
    skills: ["Adding like terms", "Solving one-step equations", "Using parentheses"],
    summary: "Simplify expressions and solve one-step equations.",
  },
  {
    name: "Solving and checking",
    skills: ["Solving two-step equations", "Checking solutions"],
    summary: "Solve two-step equations and check your answers.",
  },
];

/** The questions about the learner count as skipped, so these goals open past them. */
export const ANSWERED = [
  "purpose",
  "targetDate",
  "level",
  "schedule",
  "buddy",
  ...PROFILE_QUESTIONS,
];

export function testQuestion(page: Page, number: number, total?: number): Locator {
  return page
    .getByRole("progressbar", {
      name: new RegExp(`^Question ${number} of ${total ?? String.raw`\d+`}$`, "u"),
    })
    .filter({ visible: true });
}

/** The locator matches only this question's place, so it's hidden once the test moves on. */
export async function questionOnScreen(page: Page): Promise<Locator> {
  const bar = page.getByRole("progressbar", { name: /^Question \d+ of \d+$/u });
  const label = await bar.filter({ visible: true }).getAttribute("aria-label");

  if (!label) {
    throw new Error("Expected a question's segments on screen");
  }

  return page.getByRole("progressbar", { exact: true, name: label });
}

export function testLeave(page: Page): Locator {
  return page.getByRole("link", { exact: true, name: "Leave" }).filter({ visible: true });
}

export async function answerDontKnow(page: Page) {
  const asked = await questionOnScreen(page);
  await page.getByRole("button", { name: "I don't know yet" }).click();
  await expect(asked).toBeHidden();
}

export async function stopTest(page: Page) {
  await testLeave(page).click();
  await page.getByRole("button", { name: "Stop and use my answers" }).click();
}

/**
 * The app typesets money and numbers for the page's language ("R$ 100" is drawn "R$100" in
 * English), so a seeded text is matched by its letters and digits, whatever sits between them.
 */
function asDrawn(text: string): RegExp {
  const gap = String.raw`[^\p{L}\p{N}]*`;
  const words = text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return new RegExp(`^${gap}${words.join(gap)}${gap}$`, "u");
}

export async function sortSteps(page: Page, steps: readonly string[]) {
  const list = page.getByRole("list", { name: "Steps, in your order" });
  const rows = list.getByRole("button");
  await expect(rows).toHaveCount(steps.length);
  await expect(rows.first()).toBeEnabled();

  /* oxlint-disable no-await-in-loop -- Each drag starts from the order the last one left. */
  for (const [target, step] of steps.entries()) {
    const destination = rows.nth(target);

    const drawn = asDrawn(step);
    const text = await destination.textContent();

    if (!drawn.test(text ?? "")) {
      await list.getByRole("button", { name: drawn }).dragTo(destination, { steps: 12 });
      await expect(destination).toHaveText(drawn);
    }
  }
  /* oxlint-enable no-await-in-loop */
}

/** Titles repeat across the seed's topics, so the first answer on screen tells the items apart. */
async function findSeededItem(page: Page) {
  const heading = page.getByRole("heading", { level: 2 }).filter({ visible: true });
  const text = await heading.textContent();
  const title = text?.trim() ?? "";

  const items = await prisma.item.findMany({
    select: { content: true },
    where: { format: { in: ["matchPairs", "multipleChoice", "order"] } },
  });

  const keys = items
    .flatMap(({ content }) => seededKeySchema.safeParse(content).data ?? [])
    .filter((key) => asDrawn(key.question).test(title));

  const shown = await Promise.all(
    keys.map((key) => {
      const first = key.steps?.[0] ?? key.pairs?.[0]?.left ?? key.options?.[0]?.text ?? "";
      return page.getByText(asDrawn(first)).first().isVisible();
    }),
  );

  const key = keys[shown.indexOf(true)];

  if (!key) {
    throw new Error(`No seeded question on screen for "${title}"`);
  }

  return key;
}

export async function answerSeededQuestion(page: Page) {
  const asked = await questionOnScreen(page);
  const key = await findSeededItem(page);

  if (key.steps) {
    await sortSteps(page, key.steps);
  }

  /* oxlint-disable no-await-in-loop -- A board takes one tap at a time. */
  for (const pair of key.pairs ?? []) {
    await page.getByRole("button", { name: asDrawn(pair.left) }).click();
    await page.getByRole("button", { name: asDrawn(pair.right) }).click();
  }

  for (const option of key.options?.filter((item) => item.isCorrect) ?? []) {
    await page.getByRole("checkbox", { name: asDrawn(option.text) }).click();
  }
  /* oxlint-enable no-await-in-loop */

  // The drag sensor suppresses clicks for 50 ms after pointer release.
  await page.getByRole("button", { exact: true, name: "Confirm" }).click({ delay: 80 });
  await expect(asked).toBeHidden();
}

export const ORDER_STEPS = [
  "Write the equation",
  "Undo the addition",
  "Simplify both sides",
  "Check the answer",
];

/** A test asks questions a guess rarely gets right, two a topic: each topic gets three to order. */
export async function addOrderQuestions(goalId: string) {
  const items = await prisma.planItem.findMany({
    select: { skillId: true },
    where: { plan: { goalId }, skillId: { not: null } },
  });

  await Promise.all(
    [...new Set(items.flatMap((item) => item.skillId ?? []))].flatMap((skillId) =>
      ["first", "second", "third"].map((copy) =>
        itemFixture({
          content: {
            question: `Put the ${copy} steps in order.`,
            reason: "In order.",
            steps: ORDER_STEPS,
          },
          format: "order",
          skillId,
        }),
      ),
    ),
  );
}

export function solvePlacementEquation(question: string): string | null {
  const equation = /x \+ (?<addend>\d+) = (?<total>\d+)/u.exec(question)?.groups;
  return equation ? String(Number(equation.total) - Number(equation.addend)) : null;
}

export async function createMappedGoal(userId: string, { exam = false } = {}) {
  const blueprint = exam ? await examBlueprintFixture() : null;

  const goal = await goalFixture({
    dailyMinutes: 30,
    details: { answered: ANSWERED, subject: "algebra" },
    ...(blueprint && { examBlueprintId: blueprint.id, kind: "exam" }),
    planRevealedAt: null,
    prompt: "learn algebra",
    title: "Learn algebra",
    userId,
  });

  await mapGoalSkills({ goalId: goal.id });
  return goal;
}

/** Replaces the empty plan a goal the app started has, as its build would. */
export async function mapGoalSkills({ goalId }: { goalId: string }) {
  await prisma.plan.deleteMany({ where: { goalId } });

  const suffix = randomUUID();

  const skills = await Promise.all(
    PHASES.flatMap((phase) =>
      phase.skills.map((name) => skillFixture({ name: `${name} ${suffix}` })),
    ),
  );

  const phaseOf = PHASES.flatMap((phase, index) => phase.skills.map(() => index));

  const plan = await planFixture({
    goalId,
    graph: {
      phases: PHASES.map(({ name }) => ({ milestone: null, name })),
      skills: plannedSkills(skills.map((skill, index) => ({ ...skill, phase: phaseOf[index] }))),
    },
    phases: PHASES.map(({ name, summary }) => ({ name, summary })),
  });

  await Promise.all([
    ...skills
      .slice(1)
      .map((skill, index) =>
        skillPrerequisiteFixture({ prerequisiteId: skills[index]?.id ?? "", skillId: skill.id }),
      ),
    ...skills.map((skill, position) =>
      planItemFixture({
        kind: "lesson",
        phase: phaseOf[position] ?? 0,
        planId: plan.id,
        position,
        skillId: skill.id,
        titleSnapshot: `Lesson ${position + 1}`,
      }),
    ),
    ...skills.flatMap((skill, index) =>
      [1, 2].map((copy) =>
        itemFixture({
          content: {
            ...choiceItemContent(`Solve x + ${copy} = ${index + copy + 1}. What is x?`),
            options: [
              {
                isCorrect: true,
                misconception: null,
                reason: `Subtract ${copy} from both sides to get ${index + 1}.`,
                text: String(index + 1),
              },
              {
                isCorrect: false,
                misconception: "Adds instead of subtracting",
                reason: `Subtract ${copy} from both sides rather than adding it.`,
                text: String(index + copy * 2 + 1),
              },
              {
                isCorrect: false,
                misconception: "Uses the total as the value of x",
                reason: `The total includes the ${copy} added to x.`,
                text: String(index + copy + 1),
              },
            ],
          },
          skillId: skill.id,
        }),
      ),
    ),
  ]);
}
