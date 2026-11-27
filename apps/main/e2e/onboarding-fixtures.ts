import { randomUUID } from "node:crypto";
import { type Locator, type Page } from "@playwright/test";
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

/** Where a test is, which only its header's segments say; `total` is any when omitted. */
export function testQuestion(page: Page, number: number, total?: number): Locator {
  return page
    .getByRole("progressbar", {
      name: new RegExp(`^Question ${number} of ${total ?? String.raw`\d+`}$`, "u"),
    })
    .filter({ visible: true });
}

/** A test's ✕: it offers the two ways out once stopping gives a result, and only leaves before. */
export function testLeave(page: Page): Locator {
  return page.getByRole("link", { exact: true, name: "Leave" }).filter({ visible: true });
}

export async function stopTest(page: Page) {
  await testLeave(page).click();
  await page.getByRole("button", { name: "Stop and use my answers" }).click();
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
