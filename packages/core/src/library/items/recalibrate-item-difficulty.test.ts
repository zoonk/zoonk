import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { anonymizeLearnerRecords } from "@zoonk/db/anonymous-records";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { toUTCMidnight } from "@zoonk/utils/date";
import { describe, expect, it } from "vitest";
import { recalibrateItemDifficulties } from "./recalibrate-item-difficulty";

const HOUR_MS = 3_600_000;

function isolatedNow(): Date {
  return new Date(Date.UTC(2090, 0, 1) + Math.floor(Math.random() * 1_000_000) * HOUR_MS * 24);
}

function attemptRows({
  answeredAt,
  itemId,
  results,
  userIds,
}: {
  answeredAt: Date;
  itemId: string;
  results: readonly boolean[];
  userIds: readonly string[];
}) {
  return userIds.map((userId, index) => ({
    answer: { selectedIndex: 0 },
    answeredAt,
    durationMs: 5000,
    hour: answeredAt.getUTCHours(),
    isCorrect: results[index] ?? false,
    itemId,
    localDate: toUTCMidnight(answeredAt),
    userId,
    weekday: answeredAt.getUTCDay(),
  }));
}

async function answerByLearners({
  itemId,
  now,
  results,
}: {
  itemId: string;
  now: Date;
  results: boolean[];
}) {
  const users = await prisma.user.createManyAndReturn({
    data: results.map(() => ({ email: `learner-${randomUUID()}@example.test`, name: "Learner" })),
  });

  const userIds = users.map((user) => user.id);
  const answeredAt = new Date(now.getTime() - HOUR_MS);

  await prisma.attempt.createMany({ data: attemptRows({ answeredAt, itemId, results, userIds }) });

  return userIds;
}

function repeat({ correct, wrong }: { correct: number; wrong: number }): boolean[] {
  return [
    ...Array.from({ length: correct }, () => true),
    ...Array.from({ length: wrong }, () => false),
  ];
}

const FOUR_OPTIONS = {
  options: [
    { isCorrect: true, text: "Right answer" },
    { isCorrect: false, reason: "Misconception one", text: "Wrong one" },
    { isCorrect: false, reason: "Misconception two", text: "Wrong two" },
    { isCorrect: false, reason: "Misconception three", text: "Wrong three" },
  ],
  question: "Test question?",
};

describe(recalibrateItemDifficulties, () => {
  it.each(["legacy step", "deleted step", "anonymous"])(
    "drops a learner who first met the item in a lesson (%s)",
    async (history) => {
      const now = isolatedNow();

      const [skill, learner, { steps }] = await Promise.all([
        skillFixture(),
        userFixture(),
        playableLessonFixture({ steps: ["check"] }),
      ]);

      const [step] = steps;

      if (!step) {
        throw new Error("Expected the lesson's check");
      }

      const item = await itemFixture({ content: FOUR_OPTIONS, difficulty: 0, skillId: skill.id });
      const answeredAt = new Date(now.getTime() - HOUR_MS);

      await attemptFixture({
        answeredAt,
        fromLesson: history !== "legacy step",
        itemId: item.id,
        stepId: step.id,
        userId: learner.id,
      });

      await Promise.all([
        attemptFixture({ answeredAt, itemId: item.id, userId: learner.id }),
        answerByLearners({ itemId: item.id, now, results: repeat({ correct: 19, wrong: 0 }) }),
      ]);

      if (history === "deleted step") {
        await prisma.step.delete({ where: { id: step.id } });
      }

      if (history === "anonymous") {
        await prisma.$transaction((transaction) =>
          anonymizeLearnerRecords({ emails: [], transaction, userIds: [learner.id] }),
        );
      }

      await recalibrateItemDifficulties({ now });

      await expect(
        prisma.item.findUniqueOrThrow({ where: { id: item.id } }),
      ).resolves.toMatchObject({ difficulty: 0 });
    },
  );

  it("moves each item to the difficulty its learners' answers show, taking lucky guesses out", async () => {
    const now = isolatedNow();
    const skill = await skillFixture();

    const [easyForLearners, hardForLearners] = await Promise.all([
      itemFixture({ content: FOUR_OPTIONS, difficulty: 1, skillId: skill.id }),
      itemFixture({
        content: { acceptedAnswers: ["42"], keyPoints: ["The answer is 42"], question: "Test?" },
        difficulty: 0,
        format: "typed",
        skillId: skill.id,
      }),
    ]);

    await Promise.all([
      answerByLearners({
        itemId: easyForLearners.id,
        now,
        results: repeat({ correct: 22, wrong: 2 }),
      }),
      answerByLearners({
        itemId: hardForLearners.id,
        now,
        results: repeat({ correct: 2, wrong: 18 }),
      }),
    ]);

    const result = await recalibrateItemDifficulties({ now });

    expect(result.recalibrated).toBe(2);

    const [easy, hard] = await Promise.all([
      prisma.item.findUniqueOrThrow({ where: { id: easyForLearners.id } }),
      prisma.item.findUniqueOrThrow({ where: { id: hardForLearners.id } }),
    ]);

    expect(easy.difficulty).toBeCloseTo(-1, 1);
    expect(hard.difficulty).toBeCloseTo(1.09, 1);
  });

  it("counts only each learner's first answer, since reviews make every item look easier", async () => {
    const now = isolatedNow();
    const skill = await skillFixture();
    const item = await itemFixture({ content: FOUR_OPTIONS, difficulty: 0, skillId: skill.id });

    const userIds = await answerByLearners({
      itemId: item.id,
      now,
      results: repeat({ correct: 2, wrong: 18 }),
    });

    await prisma.attempt.createMany({
      data: attemptRows({
        answeredAt: new Date(now.getTime() - HOUR_MS / 2),
        itemId: item.id,
        results: userIds.map(() => true),
        userIds,
      }),
    });

    await recalibrateItemDifficulties({ now });

    const updated = await prisma.item.findUniqueOrThrow({ where: { id: item.id } });

    expect(updated.difficulty).toBeGreaterThan(1);
  });

  it("counts the first answers of learners who deleted their accounts, kept without them", async () => {
    const now = isolatedNow();
    const skill = await skillFixture();
    const item = await itemFixture({ content: FOUR_OPTIONS, difficulty: 0, skillId: skill.id });

    await Promise.all([
      answerByLearners({ itemId: item.id, now, results: repeat({ correct: 0, wrong: 10 }) }),
      prisma.anonymousFirstAnswer.createMany({
        data: repeat({ correct: 0, wrong: 10 }).map((isCorrect) => ({
          isCorrect,
          itemId: item.id,
        })),
      }),
    ]);

    const result = await recalibrateItemDifficulties({ now });
    const updated = await prisma.item.findUniqueOrThrow({ where: { id: item.id } });

    expect(result.recalibrated).toBe(1);
    expect(updated.difficulty).toBeGreaterThan(1);
  });

  it("keeps the generated difficulty until enough learners answered", async () => {
    const now = isolatedNow();
    const skill = await skillFixture();
    const item = await itemFixture({ content: FOUR_OPTIONS, difficulty: 1, skillId: skill.id });

    await answerByLearners({ itemId: item.id, now, results: repeat({ correct: 10, wrong: 0 }) });

    const result = await recalibrateItemDifficulties({ now });
    const unchanged = await prisma.item.findUniqueOrThrow({ where: { id: item.id } });

    expect(result.recalibrated).toBe(0);
    expect(unchanged.difficulty).toBe(1);
  });
});
