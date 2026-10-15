import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { type skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { createGoalPlan } from "../../../plans/create-goal-plan";
import { uniqueWord } from "../../identity/_test-utils/identity-mocks";
import { saveOutlineChapter } from "../save-outline-chapter";

/** The day these goals start, a Monday in 2020: tests fake the clock to it. */
export const WAITING_START = new Date("2020-09-28T12:00:00Z");

type Skill = Awaited<ReturnType<typeof skillFixture>>;

/** A learner's goal planned before the skill's lessons were outlined: its plan holds a stand-in. */
export async function waitingGoal(skill: Skill, { dailyMinutes }: { dailyMinutes?: number } = {}) {
  const user = await userFixture();
  const goal = await goalFixture({ ...(dailyMinutes && { dailyMinutes }), userId: user.id });

  const plan = await prisma.plan.create({
    data: { goalId: goal.id, settings: { startDate: WAITING_START.toISOString().slice(0, 10) } },
  });

  await createGoalPlan({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Phase" }],
      skills: [
        {
          area: "Physics",
          lessons: 2,
          name: skill.name,
          phase: 0,
          skillId: skill.id,
          weight: null,
        },
      ],
    },
  });

  return { goal, plan };
}

/** An outline chapter lands, teaching the skill: its lessons, in order. */
export async function outlineSkill(skill: Skill): Promise<string[]> {
  const course = await courseFixture({ outlineStatus: "running" });
  const word = uniqueWord();

  const saved = await saveOutlineChapter({
    chapter: {
      description: `What chapter ${word} covers`,
      lessons: ["one", "two"].map((part) => ({
        canDo: `Do part ${part} ${word}`,
        description: `Why part ${part} ${word} matters`,
        estimatedMinutes: 3,
        skills: [`Skill ${part} ${word}`],
        title: `Part ${part} ${word}`,
      })),
      objectives: ["Explain the idea"],
      skillKeys: ["first"],
      title: `Chapter ${word}`,
      tools: [],
    },
    courseId: course.id,
    goalSkills: [{ description: skill.description, id: skill.id, key: "first", name: skill.name }],
    level: "beginner",
    position: 0,
    provenance: {
      generatedAt: WAITING_START,
      model: "openai/gpt-6-sol",
      promptVersion: "v1",
      runId: "run",
    },
    scope: { generalGoal: "Learn physics", language: "en", ownerId: null, targetLanguage: null },
    workflowRunId: randomUUID(),
  });

  return saved.lessonIds;
}

/** The plan's lessons in order: a lesson's id, or its skill's id while a stand-in holds its place. */
export async function plannedLessons(planId: string): Promise<string[]> {
  const items = await prisma.planItem.findMany({
    orderBy: { position: "asc" },
    where: { kind: "lesson", planId },
  });

  return items.map((item) => item.lessonId ?? item.skillId ?? "");
}
