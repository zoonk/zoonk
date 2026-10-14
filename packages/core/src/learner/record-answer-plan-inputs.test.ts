import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { startLibraryLesson } from "../lesson-player/start-library-lesson";
import { type LearnerAnswer, recordLearnerAnswer } from "./record-learner-answer";

async function setup() {
  const [user, other, skill] = await Promise.all([userFixture(), userFixture(), skillFixture()]);

  const [item, first, second, unrelated] = await Promise.all([
    itemFixture({ content: choiceItemContent(), skillId: skill.id }),
    goalFixture({ userId: user.id }),
    goalFixture({ userId: user.id }),
    goalFixture({ userId: other.id }),
  ]);

  const plans = await Promise.all(
    [first, second, unrelated].map((goal) => planFixture({ goalId: goal.id })),
  );

  const input: LearnerAnswer = {
    answer: { selectedIndex: 0 },
    graded: { durationMs: 15_000, isCorrect: true },
    itemId: item.id,
    language: "en",
    purpose: "learning",
    skillId: skill.id,
    timeZone: "UTC",
    userId: user.id,
  };

  return { input, other, plans, skill, user };
}

async function versions(userIds: string[]) {
  const [users, plans] = await Promise.all([
    prisma.user.findMany({
      orderBy: { id: "asc" },
      select: { id: true, learnerRevision: true },
      where: { id: { in: userIds } },
    }),
    prisma.plan.findMany({
      orderBy: { id: "asc" },
      select: { goal: { select: { userId: true } }, id: true, inputVersion: true },
      where: { goal: { userId: { in: userIds } } },
    }),
  ]);

  return { plans, users };
}

describe("answer input freshness", () => {
  it("invalidates only the answering learner's plans in the answer transaction", async () => {
    const { input, other, plans, user } = await setup();
    const before = await versions([user.id, other.id]);

    const recorded = await recordLearnerAnswer(input);
    const after = await versions([user.id, other.id]);

    expect(recorded.attempt.userId).toBe(user.id);
    expect(after.plans).toHaveLength(plans.length);

    for (const plan of after.plans) {
      const old = before.plans.find((row) => row.id === plan.id)!;
      expect(plan.inputVersion).toBe(old.inputVersion + (plan.goal.userId === user.id ? 1 : 0));
    }

    expect(after.users).toStrictEqual(
      before.users.map((row) => ({
        ...row,
        learnerRevision: row.learnerRevision + (row.id === user.id ? 1n : 0n),
      })),
    );
  });

  it("counts each concurrent answer once without losing its skill or plan update", async () => {
    const { input, other, skill, user } = await setup();
    const before = await versions([user.id, other.id]);

    const answers = await Promise.all(Array.from({ length: 3 }, () => recordLearnerAnswer(input)));
    const after = await versions([user.id, other.id]);

    expect(new Set(answers.map(({ attempt }) => attempt.id)).size).toBe(3);

    for (const plan of after.plans) {
      const old = before.plans.find((row) => row.id === plan.id)!;
      expect(plan.inputVersion).toBe(old.inputVersion + (plan.goal.userId === user.id ? 3 : 0));
    }

    expect(after.users).toStrictEqual(
      before.users.map((row) => ({
        ...row,
        learnerRevision: row.learnerRevision + (row.id === user.id ? 3n : 0n),
      })),
    );

    await expect(
      prisma.learnerSkill.findUniqueOrThrow({
        where: { userSkill: { skillId: skill.id, userId: user.id } },
      }),
    ).resolves.toMatchObject({ reps: 3 });
  });

  it("rolls back input and learner revisions when the answer's real item FK fails", async () => {
    const { input, other, user } = await setup();
    const before = await versions([user.id, other.id]);

    await expect(recordLearnerAnswer({ ...input, itemId: randomUUID() })).rejects.toMatchObject({
      code: "P2003",
    });

    await expect(versions([user.id, other.id])).resolves.toStrictEqual(before);
    await expect(prisma.attempt.count({ where: { userId: user.id } })).resolves.toBe(0);
    await expect(prisma.learnerSkill.count({ where: { userId: user.id } })).resolves.toBe(0);
  });

  it("serializes answers with racing lesson starts without deadlock or duplicate revisions", async () => {
    const { input, other, user } = await setup();
    const lessons = await Promise.all(Array.from({ length: 3 }, () => playableLessonFixture()));
    const before = await versions([user.id, other.id]);
    mockSession(user.id);

    for (const { lesson } of lessons) {
      const start = () => startLibraryLesson({ input: { timeZone: "UTC" }, lessonId: lesson.id });
      // Repeat three real mixed-writer races; each lesson has exactly one successful new run.
      // oxlint-disable-next-line eslint/no-await-in-loop -- Each completed race is the next race's baseline.
      const [recorded, first, second] = await Promise.all([
        recordLearnerAnswer(input),
        start(),
        start(),
      ]);

      expect(recorded.attempt.userId).toBe(user.id);
      expect(first.status).toBe("started");
      expect(second.status).toBe("started");

      expect(first.status === "started" && first.run.runId).toBe(
        second.status === "started" && second.run.runId,
      );
    }

    const after = await versions([user.id, other.id]);

    for (const plan of after.plans) {
      const old = before.plans.find((row) => row.id === plan.id)!;
      expect(plan.inputVersion).toBe(old.inputVersion + (plan.goal.userId === user.id ? 6 : 0));
    }

    expect(after.users).toStrictEqual(
      before.users.map((row) => ({
        ...row,
        learnerRevision: row.learnerRevision + (row.id === user.id ? 6n : 0n),
      })),
    );

    await expect(prisma.learningEvent.count({ where: { userId: user.id } })).resolves.toBe(3);
    await expect(prisma.attempt.count({ where: { userId: user.id } })).resolves.toBe(3);
  });
});
