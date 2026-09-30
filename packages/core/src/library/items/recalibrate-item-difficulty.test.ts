import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { recalibrateItemDifficulties } from "./recalibrate-item-difficulty";

const HOUR_MS = 3_600_000;

/**
 * A day far from other tests' answers: the sweep only reads items answered in the day before
 * `now`, so it sees this test's items alone.
 */
function isolatedNow(): Date {
  return new Date(Date.UTC(2090, 0, 1) + Math.floor(Math.random() * 1_000_000) * HOUR_MS * 24);
}

/** One new learner per result, each answering the item once, an hour before `now`. */
async function answerByLearners({
  itemId,
  now,
  results,
}: {
  itemId: string;
  now: Date;
  results: boolean[];
}) {
  const users = await Promise.all(results.map(() => userFixture()));
  const answeredAt = new Date(now.getTime() - HOUR_MS);

  await Promise.all(
    users.map((user, index) =>
      attemptFixture({ answeredAt, isCorrect: results[index], itemId, userId: user.id }),
    ),
  );

  return users;
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

    // Generated as hard, but almost everyone got it right: it reads as easy now.
    expect(easy.difficulty).toBeCloseTo(-1, 1);
    // Generated as medium, but almost nobody typed it right, and typing leaves no lucky guess.
    expect(hard.difficulty).toBeCloseTo(1.09, 1);
  });

  it("counts only each learner's first answer, since reviews make every item look easier", async () => {
    const now = isolatedNow();
    const skill = await skillFixture();
    const item = await itemFixture({ content: FOUR_OPTIONS, difficulty: 0, skillId: skill.id });

    const users = await answerByLearners({
      itemId: item.id,
      now,
      results: repeat({ correct: 2, wrong: 18 }),
    });

    // Every learner got it right on later reviews: none of that counts.
    await Promise.all(
      users.map((user) =>
        attemptFixture({
          answeredAt: new Date(now.getTime() - HOUR_MS / 2),
          isCorrect: true,
          itemId: item.id,
          userId: user.id,
        }),
      ),
    );

    await recalibrateItemDifficulties({ now });

    const updated = await prisma.item.findUniqueOrThrow({ where: { id: item.id } });

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
