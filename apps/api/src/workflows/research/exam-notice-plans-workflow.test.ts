import { prisma } from "@zoonk/db";
import {
  goalFixture,
  planFixture,
  planItemFixture,
  plannedSkills,
} from "@zoonk/testing/fixtures/goals";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseRows } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { examNoticePlansWorkflow } from "./exam-notice-plans-workflow";

const DAY_MS = 86_400_000;

describe(examNoticePlansWorkflow, () => {
  it("prunes an old shared exam graph and its active plans, then offers the extra the graph gains", async () => {
    const [blueprint, user, required, outside] = await Promise.all([
      examBlueprintFixture({
        structure: {
          formats: [],
          mock: null,
          rules: [],
          subjects: [
            {
              citation: { passage: "", sourceId: "notice" },
              name: "Public finance",
              questions: 1,
              topics: ["Budgets"],
              weight: 1,
            },
          ],
        },
      }),
      userFixture(),
      skillFixture({ name: "Read a budget" }),
      skillFixture({ name: "Choose when to leave an answer blank" }),
    ]);

    const goal = await goalFixture({
      dailyMinutes: 60,
      examBlueprintId: blueprint.id,
      kind: "exam",
      targetDate: new Date(Date.now() + 30 * DAY_MS),
      userId: user.id,
    });

    const [official, strategy] = plannedSkills([required, outside]);

    const finance = {
      ...official,
      area: "Public finance",
      skillId: required.id,
      topics: ["Budgets"],
    };

    const extra = { ...strategy, area: "Strategy", skillId: outside.id, topics: [] };

    const graph = {
      phases: [{ milestone: null, name: "Exam preparation" }],
      skills: [finance, extra],
    };

    const [plan, shared] = await Promise.all([
      planFixture({ goalId: goal.id, graph }),
      prisma.examSkillGraph.create({
        data: {
          examBlueprintId: blueprint.id,
          generatedAt: new Date(),
          graph,
          model: "test",
          promptVersion: "test",
          runId: "test",
        },
      }),
    ]);

    await examNoticePlansWorkflow({ examBlueprintId: blueprint.id });

    await planItemFixture({ planId: plan.id, skillId: required.id });

    const itemReads = await countDatabaseRows(
      () => examNoticePlansWorkflow({ examBlueprintId: blueprint.id }),
      '"plan_items"',
    );

    expect.soft(itemReads.rows).toBe(0);

    const [updated, reused, changes] = await Promise.all([
      prisma.plan.findUniqueOrThrow({ where: { id: plan.id } }),
      prisma.examSkillGraph.findUniqueOrThrow({ where: { id: shared.id } }),
      prisma.planChange.findMany({ where: { kind: "noticeChanged", planId: plan.id } }),
    ]);

    const skills = [{ skillId: required.id, topics: ["Budgets"] }];
    expect(updated.graph).toMatchObject({ skills });
    expect(reused.graph).toMatchObject({ skills });
    expect(changes).toMatchObject([{ payload: { effect: { noticeRemoved: ["Strategy"] } } }]);

    const extraSkills = [extra];

    await prisma.examSkillGraph.update({
      data: { graph: { extraSkills, phases: graph.phases, skills: [finance] } },
      where: { id: shared.id },
    });

    await examNoticePlansWorkflow({ examBlueprintId: blueprint.id });

    const offered = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });

    expect(offered.graph).toMatchObject({ extraSkills, skills });

    expect(offered.summary).toMatchObject({
      advice: {
        extraOffer: { lessons: 1, operations: [{ kind: "setExtras", skillIds: [outside.id] }] },
      },
    });
  });
});
