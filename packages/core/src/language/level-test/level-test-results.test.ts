import { prisma } from "@zoonk/db";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { CEFR_LEVELS } from "@zoonk/utils/cefr";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { updateGoal } from "../../goals/update-goal";
import { finishLanguageLevelTest } from "./finish-language-level-test";
import { type LevelTestBank } from "./level-test-contract";

const TEST_LEVELS = CEFR_LEVELS.slice(0, 5);

const BANK: LevelTestBank = {
  questions: TEST_LEVELS.flatMap((level) =>
    (["reading", "listening"] as const).flatMap((skill) =>
      [0, 1].map((index) => ({
        answerIndex: 1,
        id: `${skill}-${level}-${index}`,
        level,
        options: ["a", "b", "c", "d"],
        passage: `${skill} passage ${level}`,
        question: "O que diz a mensagem?",
        skill,
      })),
    ),
  ),
  speaking: TEST_LEVELS.map((level) => ({ level, sentence: `Say ${level}`, translation: "Diga" })),
};

type StoredAnswer = { answerIndex: number; id: string };

function answers(skill: "listening" | "reading"): StoredAnswer[] {
  return ["A2", "B1", "B2"].map((level, index) => ({
    answerIndex: 1,
    id: `${skill}-${level}-${index % 2}`,
  }));
}

async function testTaker(levelAnswers: StoredAnswer[]) {
  await prisma.languageLevelTest.upsert({
    create: {
      content: BANK,
      language: "pt",
      model: "test",
      promptVersion: "test",
      runId: "test",
      targetLanguage: "en",
    },
    update: { content: BANK },
    where: { languagePair: { language: "pt", targetLanguage: "en" } },
  });

  const { goal, user } = await languageGoalFixture();

  await prisma.goal.update({
    data: {
      details: {
        ...(goal.details as object),
        levelTest: { answers: levelAnswers, speaking: null },
      },
    },
    where: { id: goal.id },
  });

  mockSession(user.id);
  return { goal, user };
}

describe("the level test", () => {
  it("keeps the stored test and its result when a learner sends their own", async () => {
    const { goal } = await testTaker([]);
    const forged = [...answers("reading"), ...answers("listening")];

    await updateGoal({
      goalId: goal.id,
      input: {
        details: {
          levelTest: { answers: forged, speaking: null },
          skillLevels: { listening: "C1", reading: "C1" },
        },
      },
    });

    const stored = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });

    expect(stored.details).toMatchObject({ levelTest: { answers: [] } });
    expect(stored.details).not.toHaveProperty("skillLevels");
  });

  it("leaves skills lessons raised as they were when another goal's test finishes", async () => {
    const { goal, user } = await testTaker([]);

    await prisma.languageSkillLevel.create({
      data: {
        language: "en",
        raisedAt: new Date(),
        score: 0.5,
        skill: "reading",
        startScore: 0,
        userId: user.id,
      },
    });

    await prisma.goal.update({
      data: { details: { ...(goal.details as object), level: "B1" } },
      where: { id: goal.id },
    });

    await finishLanguageLevelTest(goal.id);

    await expect(
      prisma.languageSkillLevel.findMany({ orderBy: { skill: "asc" }, where: { userId: user.id } }),
    ).resolves.toMatchObject([
      { score: 0.5, skill: "reading", startScore: 0 },
      { score: 2, skill: "listening", startScore: 2 },
    ]);
  });
});
