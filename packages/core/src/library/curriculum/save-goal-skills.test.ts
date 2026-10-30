import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { linkGoalSkillPrerequisites } from "./save-goal-skills";

function graphSkill(key: string, prerequisites: string[] = []) {
  return { key, prerequisites };
}

async function listPrerequisiteIds(skillId: string): Promise<string[]> {
  const edges = await prisma.skillPrerequisite.findMany({ where: { skillId } });
  return edges.map((edge) => edge.prerequisiteId).toSorted();
}

describe(linkGoalSkillPrerequisites, () => {
  it.each([1, 12, 48])("links a %i-skill graph with bounded database work", async (size) => {
    const rows = await Promise.all(Array.from({ length: size }, () => skillFixture()));
    const idsByKey = Object.fromEntries(rows.map((row, index) => [String(index), row.id]));

    const skills = rows.map((_, index) =>
      graphSkill(String(index), index > 0 ? [String(index - 1)] : []),
    );

    const counts = await countDatabaseStatements(() =>
      linkGoalSkillPrerequisites({ idsByKey, skills }),
    );

    expect(counts.statements).toBeLessThanOrEqual(16);
    expect(counts.writes).toBeLessThanOrEqual(2);

    const edges = await prisma.skillPrerequisite.findMany({
      where: { skillId: { in: rows.map((row) => row.id) } },
    });

    expect(edges.map(({ skillId, prerequisiteId }) => ({ prerequisiteId, skillId }))).toStrictEqual(
      expect.arrayContaining(
        rows.slice(1).map((row, index) => ({ prerequisiteId: rows[index]?.id, skillId: row.id })),
      ),
    );

    expect(edges).toHaveLength(Math.max(0, size - 1));
  });

  it("rolls back every link if a skill disappeared before publication", async () => {
    const [first, second, previous] = await Promise.all([
      skillFixture(),
      skillFixture(),
      skillFixture(),
    ]);

    await prisma.skillPrerequisite.create({
      data: { prerequisiteId: previous.id, skillId: first.id },
    });

    await expect(
      linkGoalSkillPrerequisites({
        idsByKey: {
          first: first.id,
          missing: randomUUID(),
          previous: previous.id,
          second: second.id,
        },
        skills: [graphSkill("first", ["second"]), graphSkill("missing", ["first"])],
      }),
    ).rejects.toThrow();

    await expect(listPrerequisiteIds(first.id)).resolves.toStrictEqual([previous.id]);
  });

  it("invalidates every dependent plan once while publishing a graph", async () => {
    const [first, second, user] = await Promise.all([
      skillFixture(),
      skillFixture(),
      userFixture(),
    ]);

    const goals = await Promise.all([
      goalFixture({ userId: user.id }),
      goalFixture({ userId: user.id }),
    ]);

    const plans = await Promise.all(
      goals.map((goal, index) =>
        planFixture({
          goalId: goal.id,
          sourceSkillIds: index === 0 ? [first.id, second.id] : [second.id],
        }),
      ),
    );

    await linkGoalSkillPrerequisites({
      idsByKey: { first: first.id, second: second.id },
      skills: [graphSkill("first"), graphSkill("second", ["first"])],
    });

    const saved = await prisma.plan.findMany({
      where: { id: { in: plans.map((plan) => plan.id) } },
    });

    expect(saved.map((plan) => plan.inputVersion)).toStrictEqual([1, 1]);
  });

  it("lets the newest graph decide the edges between its own skills", async () => {
    const [ecology, functions, tissues, chemistry] = await Promise.all([
      skillFixture(),
      skillFixture(),
      skillFixture(),
      skillFixture(),
    ]);

    await prisma.skillPrerequisite.createMany({
      data: [
        { prerequisiteId: functions.id, skillId: ecology.id },
        { prerequisiteId: chemistry.id, skillId: ecology.id },
      ],
    });

    await linkGoalSkillPrerequisites({
      idsByKey: { ecology: ecology.id, functions: functions.id, tissues: tissues.id },
      skills: [graphSkill("ecology"), graphSkill("functions", ["tissues"]), graphSkill("tissues")],
    });

    const [ecologyNeeds, functionsNeed] = await Promise.all([
      listPrerequisiteIds(ecology.id),
      listPrerequisiteIds(functions.id),
    ]);

    expect(ecologyNeeds).toStrictEqual([chemistry.id]);
    expect(functionsNeed).toStrictEqual([tissues.id]);
  });

  it("keeps what each key of a skill learned in several courses lists", async () => {
    const [skill, first, second] = await Promise.all([
      skillFixture(),
      skillFixture(),
      skillFixture(),
    ]);

    const createdAt = new Date("2026-01-01T00:00:00Z");

    await prisma.skillPrerequisite.create({
      data: { createdAt, prerequisiteId: first.id, skillId: skill.id },
    });

    await linkGoalSkillPrerequisites({
      idsByKey: { first: first.id, second: second.id, skill: skill.id, "skill:math": skill.id },
      skills: [
        graphSkill("skill", ["first", "skill"]),
        graphSkill("skill:math", ["second"]),
        graphSkill("first"),
        graphSkill("second"),
      ],
    });

    await expect(listPrerequisiteIds(skill.id)).resolves.toStrictEqual(
      [first.id, second.id].toSorted(),
    );

    await expect(
      prisma.skillPrerequisite.findUniqueOrThrow({
        where: { skillId_prerequisiteId: { prerequisiteId: first.id, skillId: skill.id } },
      }),
    ).resolves.toMatchObject({ createdAt });
  });
});
