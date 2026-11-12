import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";

export async function followWithOutdatedSummary(examBlueprintId: string) {
  const [user, skill] = await Promise.all([userFixture(), skillFixture()]);

  const outdated = {
    asked: 0,
    complete: false,
    offerQuestions: 9,
    paceMs: 30_000,
    quick: 9,
    suggested: [],
    total: 9,
    unasked: 9,
  };

  const goal = await goalFixture({
    details: { focusTest: { summary: outdated } },
    examBlueprintId,
    kind: "exam",
    userId: user.id,
  });

  await planFixture({
    goalId: goal.id,
    graph: {
      phases: [{ milestone: null, name: "Basics" }],
      skills: [{ lessons: 2, name: skill.name, phase: 0, skillId: skill.id }],
    },
    phases: [],
  });

  return goal;
}

export async function readFollowerDetails(goalId: string) {
  const { details } = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
  return details;
}
