import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { lockPlanInputWrite, lockPlanSourceWrite, writePlanInputs } from "./plan-input-write";

async function dependentPlan(attrs: Omit<Parameters<typeof planFixture>[0], "goalId"> = {}) {
  const user = await userFixture();
  const goal = await goalFixture({ userId: user.id });
  return planFixture({ ...attrs, goalId: goal.id });
}

function readPlans(planIds: readonly string[]) {
  return Promise.all(
    planIds.map((id) =>
      prisma.plan.findUniqueOrThrow({
        select: { inputVersion: true, sourceVersion: true },
        where: { id },
      }),
    ),
  );
}

describe(lockPlanInputWrite, () => {
  it("marks every dependent plan changed, and no other", async () => {
    const [first, second, unrelated] = await Promise.all([
      dependentPlan(),
      dependentPlan(),
      dependentPlan(),
    ]);

    await writePlanInputs((tx) =>
      lockPlanInputWrite({
        loadPlanIds: async () => [first.id, second.id],
        lockSources: async () => {},
        tx,
      }),
    );

    await expect(readPlans([first.id, second.id, unrelated.id])).resolves.toStrictEqual([
      { inputVersion: first.inputVersion, sourceVersion: first.sourceVersion + 1 },
      { inputVersion: second.inputVersion, sourceVersion: second.sourceVersion + 1 },
      { inputVersion: unrelated.inputVersion, sourceVersion: unrelated.sourceVersion },
    ]);
  });

  it("rolls the first marks back when a dependent appears while sources lock, then marks the whole union once", async () => {
    const [first, joined] = await Promise.all([dependentPlan(), dependentPlan()]);
    let loads = 0;

    await writePlanInputs((tx) =>
      lockPlanInputWrite({
        loadPlanIds: async () => {
          loads += 1;
          return loads === 1 ? [first.id] : [first.id, joined.id];
        },
        lockSources: async () => {},
        tx,
      }),
    );

    expect(loads).toBe(4);

    await expect(readPlans([first.id, joined.id])).resolves.toStrictEqual([
      { inputVersion: first.inputVersion, sourceVersion: first.sourceVersion + 1 },
      { inputVersion: joined.inputVersion, sourceVersion: joined.sourceVersion + 1 },
    ]);
  });

  it("allows a learner's session insert while a source publication holds its plan", async () => {
    const [user, skill, lesson] = await Promise.all([
      userFixture(),
      skillFixture(),
      libraryLessonFixture(),
    ]);

    const goal = await goalFixture({ userId: user.id });
    const plan = await planFixture({ goalId: goal.id, sourceSkillIds: [skill.id] });
    await lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id });
    const locked = Promise.withResolvers<null>();
    const release = Promise.withResolvers<null>();

    const publication = writePlanInputs(async (tx) => {
      await lockPlanSourceWrite(tx, { lessonIds: [lesson.id] });
      locked.resolve(null);
      await release.promise;
      await tx.lesson.update({ data: { estimatedMinutes: 4 }, where: { id: lesson.id } });
    });

    await locked.promise;

    try {
      const inserting = prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL lock_timeout = '200ms'`;

        return tx.studySession.create({
          data: {
            goalId: goal.id,
            localDate: new Date(),
            missions: { picks: [], version: 1 },
            plannedMinutes: 20,
            userId: user.id,
          },
        });
      });

      await expect(inserting).resolves.toMatchObject({ goalId: goal.id, userId: user.id });
    } finally {
      release.resolve(null);
      await publication;
    }

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      inputVersion: plan.inputVersion,
      sourceVersion: plan.sourceVersion + 1,
    });
  });
});
