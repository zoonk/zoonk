import { randomUUID } from "node:crypto";
import { type Goal, prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import {
  chapterSkillFixture,
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
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
  sourceSkillIds = [],
  userId,
}: {
  goal?: Partial<Pick<Goal, "examBlueprintId" | "primaryCourseId">>;
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

/** Both initialized pre-cut dependencies and the references retained by older plans. */
async function contentScope() {
  const [skill, unrelatedSkill, first, second, untouched, course, exam, lesson] = await Promise.all(
    [
      skillFixture(),
      skillFixture(),
      userFixture(),
      userFixture(),
      userFixture(),
      courseFixture(),
      examBlueprintFixture(),
      libraryLessonFixture(),
    ],
  );

  const [alias, chapter] = await Promise.all([
    skillFixture({ mergedIntoId: skill.id }),
    libraryChapterFixture({ homeCourseId: course.id }),
  ]);

  await Promise.all([
    lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
    chapterSkillFixture({ chapterId: chapter.id, skillId: skill.id }),
    courseChapterFixture({ chapterId: chapter.id, courseId: course.id, position: 0 }),
  ]);

  const affected = await Promise.all([
    // A cut skill remains a dependency even when neither the selected graph nor items include it.
    makePlan({ skillIds: [unrelatedSkill.id], sourceSkillIds: [skill.id], userId: first.id }),
    makePlan({ skillIds: [skill.id], userId: first.id }),
    makePlan({ skillIds: [alias.id], userId: second.id }),
    makePlan({ userId: second.id }),
    makePlan({ goal: { primaryCourseId: course.id }, userId: second.id }),
    makePlan({ goal: { examBlueprintId: exam.id }, userId: second.id }),
  ]);

  await Promise.all([
    planItemFixture({ planId: affected[1]!.id, skillId: skill.id }),
    planItemFixture({ lessonId: lesson.id, planId: affected[3]!.id }),
  ]);

  const unaffected = await makePlan({
    skillIds: [unrelatedSkill.id],
    sourceSkillIds: [unrelatedSkill.id],
    userId: untouched.id,
  });

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
  const [plans, users] = await Promise.all([
    prisma.plan.findMany({
      orderBy: { id: "asc" },
      where: { id: { in: scope.plans.map(({ id }) => id) } },
    }),
    prisma.user.findMany({
      orderBy: { id: "asc" },
      where: { id: { in: scope.users.map(({ id }) => id) } },
    }),
  ]);

  return {
    plans: plans.map(({ id, inputVersion, version }) => ({ id, inputVersion, version })),
    users: users.map(({ id, learnerRevision }) => ({ id, learnerRevision })),
  };
}

describe("question-bank plan invalidation", () => {
  it("invalidates every dependent plan and each owner once, including legacy references", async () => {
    const scope = await contentScope();
    const before = await readVersions(scope);
    const result = await createItems(scope.input);

    expect(result.rejected).toStrictEqual([]);
    expect(result.created).toHaveLength(2);

    const after = await readVersions(scope);
    const affectedIds = new Set(scope.affected.map(({ id }) => id));
    const affectedUsers = new Set(scope.users.slice(0, 2).map(({ id }) => id));

    expect(after).toStrictEqual({
      plans: before.plans.map((plan) => ({
        ...plan,
        inputVersion: plan.inputVersion + Number(affectedIds.has(plan.id)),
      })),
      users: before.users.map((user) => ({
        ...user,
        learnerRevision: user.learnerRevision + BigInt(affectedUsers.has(user.id)),
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

  it("rolls back plan versions and owner revisions when the real item insert fails", async () => {
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
