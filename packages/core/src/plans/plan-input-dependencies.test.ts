import { randomUUID } from "node:crypto";
import { type Goal, prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import {
  generatedMultipleChoice,
  generatedProvenance,
} from "../library/items/_test-utils/generated-items";
import { createItems } from "../library/items/create-items";

async function makePlan({
  goal = {},
  skillIds = [],
  sourceSkillIds = skillIds,
  userId,
}: {
  goal?: Partial<Pick<Goal, "examBlueprintId">>;
  skillIds?: string[];
  sourceSkillIds?: string[];
  userId: string;
}) {
  const savedGoal = await goalFixture({ ...goal, userId });

  return planFixture({
    goalId: savedGoal.id,
    graph: { phases: [{ name: "Basics" }], skills: skillIds.map((skillId) => ({ skillId })) },
    sourceSkillIds,
  });
}

/** Plans whose builds read the skill, a skill merged into it or its exam, and one that didn't. */
async function contentScope() {
  const [skill, unrelatedSkill, first, second, untouched, exam] = await Promise.all([
    skillFixture(),
    skillFixture(),
    userFixture(),
    userFixture(),
    userFixture(),
    examBlueprintFixture(),
  ]);

  const alias = await skillFixture({ mergedIntoId: skill.id });

  const affected = await Promise.all([
    // A cut skill remains a dependency even when neither the selected graph nor items include it.
    makePlan({ skillIds: [unrelatedSkill.id], sourceSkillIds: [skill.id], userId: first.id }),
    makePlan({ skillIds: [skill.id], userId: first.id }),
    makePlan({ skillIds: [alias.id], userId: second.id }),
    makePlan({ goal: { examBlueprintId: exam.id }, userId: second.id }),
  ]);

  const unaffected = await makePlan({ skillIds: [unrelatedSkill.id], userId: untouched.id });

  return {
    affected,
    input: {
      examBlueprintId: exam.id,
      format: "multipleChoice" as const,
      items: [generatedMultipleChoice(), generatedMultipleChoice()],
      language: "en",
      provenance: generatedProvenance(),
      skillId: skill.id,
    },
    plans: [...affected, unaffected],
    unaffected,
    users: [first, second, untouched],
  };
}

async function readVersions(scope: Awaited<ReturnType<typeof contentScope>>) {
  const plans = await prisma.plan.findMany({
    orderBy: { id: "asc" },
    where: { id: { in: scope.plans.map(({ id }) => id) } },
  });

  return { plans: plans.map(({ id, inputVersion, version }) => ({ id, inputVersion, version })) };
}

describe("question-bank plan invalidation", () => {
  it("invalidates every dependent plan and each owner once", async () => {
    const scope = await contentScope();
    const before = await readVersions(scope);
    const result = await createItems(scope.input);

    expect(result.rejected).toStrictEqual([]);
    expect(result.created).toHaveLength(2);

    const after = await readVersions(scope);
    const affectedIds = new Set(scope.affected.map(({ id }) => id));

    expect(after).toStrictEqual({
      plans: before.plans.map((plan) => ({
        ...plan,
        inputVersion: plan.inputVersion + Number(affectedIds.has(plan.id)),
      })),
    });
  });

  it("does not invalidate again when a workflow retries its already-stored batch", async () => {
    const scope = await contentScope();
    const first = await createItems(scope.input);
    const before = await readVersions(scope);
    const retry = await createItems(scope.input);

    expect(retry.created.map(({ id }) => id).toSorted()).toStrictEqual(
      first.created.map(({ id }) => id).toSorted(),
    );

    await expect(readVersions(scope)).resolves.toStrictEqual(before);

    await expect(
      prisma.item.count({ where: { runId: scope.input.provenance.runId } }),
    ).resolves.toBe(2);
  });

  it("rolls back plan versions when the real item insert fails", async () => {
    const scope = await contentScope();
    const before = await readVersions(scope);

    // A genuinely absent source fails the FK after invalidation; no persistence API is mocked.
    await expect(createItems({ ...scope.input, sourceId: randomUUID() })).rejects.toMatchObject({
      code: "P2003",
    });

    await expect(readVersions(scope)).resolves.toStrictEqual(before);

    await expect(
      prisma.item.count({ where: { runId: scope.input.provenance.runId } }),
    ).resolves.toBe(0);
  });
});
