import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { after } from "next/server";
import { describe, expect, it } from "vitest";
import {
  LEARNER_LOCK,
  holdLearnerLock,
  waitForBlockedStatement,
} from "../../_test-utils/learner-lock";
import {
  recordLanguageSkillEvidence,
  recordLanguageStepEvidence,
} from "./record-language-evidence";

const ENGLISH_BEGINNER = { level: "beginner" as const, targetLanguage: "en" };

async function learner() {
  const user = await userFixture();

  await goalFixture({
    details: { level: "A2", skillLevels: { listening: "B1" } },
    kind: "language",
    language: "pt",
    targetLanguage: "en",
    userId: user.id,
  });

  return user;
}

describe(recordLanguageStepEvidence, () => {
  it("starts each skill at the level test's level and counts the answer", async () => {
    const user = await learner();

    await recordLanguageStepEvidence({
      isCorrect: true,
      lesson: ENGLISH_BEGINNER,
      step: { kind: "listening", wordId: null },
      userId: user.id,
    });

    const listening = await prisma.languageSkillLevel.findUniqueOrThrow({
      where: { userLanguageSkill: { language: "en", skill: "listening", userId: user.id } },
    });

    expect(listening).toMatchObject({
      score: 2,
      startScore: 2,
      windowCeiling: 1.5,
      windowCorrect: 1,
      windowTotal: 1,
    });
  });

  it("remembers a word learned once, and looks for a pattern after a wrong answer", async () => {
    const user = await learner();
    const org = await organizationFixture();
    const word = await wordFixture({ organizationId: org.id, targetLanguage: "en" });
    const vocabulary = { kind: "vocabulary" as const, wordId: word.id };

    await recordLanguageStepEvidence({
      isCorrect: true,
      lesson: ENGLISH_BEGINNER,
      step: vocabulary,
      userId: user.id,
    });

    await recordLanguageStepEvidence({
      isCorrect: true,
      lesson: ENGLISH_BEGINNER,
      step: vocabulary,
      userId: user.id,
    });

    expect(after).not.toHaveBeenCalled();

    await recordLanguageStepEvidence({
      isCorrect: false,
      lesson: ENGLISH_BEGINNER,
      step: vocabulary,
      userId: user.id,
    });

    await expect(prisma.learnerWord.count({ where: { userId: user.id } })).resolves.toBe(1);
    expect(after).toHaveBeenCalledOnce();
    // One level change per answer; the word list has no screen, so it adds none.
  });

  it("counts every answer given at the same moment, even before the skill has a level", async () => {
    const user = await learner();
    const org = await organizationFixture();
    const word = await wordFixture({ organizationId: org.id, targetLanguage: "en" });
    const answers = 5;

    await Promise.all(
      Array.from({ length: answers }, () =>
        recordLanguageStepEvidence({
          isCorrect: true,
          lesson: ENGLISH_BEGINNER,
          step: { kind: "vocabulary", wordId: word.id },
          userId: user.id,
        }),
      ),
    );

    const levels = await prisma.languageSkillLevel.findMany({ where: { userId: user.id } });

    expect(levels).toMatchObject([{ windowCorrect: answers, windowTotal: answers }]);
    await expect(prisma.learnerWord.count({ where: { userId: user.id } })).resolves.toBe(1);
  });

  it("changes nothing for lessons of other subjects", async () => {
    const user = await learner();

    await recordLanguageStepEvidence({
      isCorrect: true,
      lesson: { level: "beginner", targetLanguage: null },
      step: { kind: "typedAnswer", wordId: null },
      userId: user.id,
    });

    await expect(prisma.languageSkillLevel.count({ where: { userId: user.id } })).resolves.toBe(0);
  });
});

describe("language evidence selection admission", () => {
  it.each([
    { expectedInputs: 1, language: "ja", skill: "reading" as const },
    { expectedInputs: 0, language: "en", skill: "reading" as const },
    { expectedInputs: 0, language: "ja", skill: "listening" as const },
  ])(
    "classifies $language $skill by the builder's actual score read",
    async ({ language, skill, expectedInputs }) => {
      const user = await userFixture();

      const goal = await goalFixture({
        details: { level: "A2" },
        kind: "language",
        targetLanguage: language,
        userId: user.id,
      });

      const plan = await planFixture({ goalId: goal.id });

      await recordLanguageSkillEvidence({
        evidence: { ceiling: 2, correct: 1, total: 1 },
        language,
        skill,
        userId: user.id,
      });

      await expect(
        prisma.plan.findUniqueOrThrow({ where: { id: plan.id } }),
      ).resolves.toMatchObject({ inputVersion: plan.inputVersion + expectedInputs });
    },
  );

  it("bumps inputs only when the reading score changes", async () => {
    const user = await userFixture();

    const goal = await goalFixture({
      details: { level: "A1" },
      kind: "language",
      targetLanguage: "ja",
      userId: user.id,
    });

    const plan = await planFixture({ goalId: goal.id });

    const row = await prisma.languageSkillLevel.create({
      data: {
        language: "ja",
        score: 0.5,
        skill: "reading",
        startScore: 0.5,
        userId: user.id,
        windowCeiling: 1.5,
        windowCorrect: 18,
        windowTotal: 18,
      },
    });

    const input = {
      isCorrect: true,
      lesson: { level: "beginner" as const, targetLanguage: "ja" },
      step: { kind: "reading" as const, wordId: null },
      userId: user.id,
    };

    await recordLanguageStepEvidence(input);

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      inputVersion: plan.inputVersion,
    });

    await recordLanguageStepEvidence(input);

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      inputVersion: plan.inputVersion + 1,
    });

    await expect(
      prisma.languageSkillLevel.findUniqueOrThrow({ where: { id: row.id } }),
    ).resolves.toMatchObject({ score: 1, windowTotal: 0 });
  });

  it("rechecks the input classification after admission without taking plan locks after the learner", async () => {
    const user = await userFixture();

    const goal = await goalFixture({
      details: { level: "A1" },
      kind: "language",
      targetLanguage: "ja",
      userId: user.id,
    });

    const plan = await planFixture({ goalId: goal.id });

    const row = await prisma.languageSkillLevel.create({
      data: {
        language: "ja",
        score: 0.5,
        skill: "reading",
        startScore: 0.5,
        userId: user.id,
        windowCeiling: 1.5,
        windowCorrect: 18,
        windowTotal: 18,
      },
    });

    const holder = holdLearnerLock({
      beforeCommit: async (tx) =>
        tx.languageSkillLevel.update({
          data: { windowCorrect: 19, windowTotal: 19 },
          where: { id: row.id },
        }),
      userId: user.id,
    });

    const pid = await holder.pid;

    const evidence = recordLanguageSkillEvidence({
      evidence: { ceiling: 1.5, correct: 1, total: 1 },
      language: "ja",
      skill: "reading",
      userId: user.id,
    });

    try {
      await waitForBlockedStatement(pid, LEARNER_LOCK);
    } finally {
      holder.release();
      await Promise.all([holder.done, evidence]);
    }

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      inputVersion: plan.inputVersion + 1,
    });

    await expect(
      prisma.languageSkillLevel.findUniqueOrThrow({ where: { id: row.id } }),
    ).resolves.toMatchObject({ score: 1, windowTotal: 0 });
  });

  it("rolls an unnecessary input mark back when another answer already closed the window", async () => {
    const user = await userFixture();

    const goal = await goalFixture({
      details: { level: "A1" },
      kind: "language",
      targetLanguage: "ja",
      userId: user.id,
    });

    const plan = await planFixture({ goalId: goal.id });

    const row = await prisma.languageSkillLevel.create({
      data: {
        language: "ja",
        score: 0.5,
        skill: "reading",
        startScore: 0.5,
        userId: user.id,
        windowCeiling: 1.5,
        windowCorrect: 19,
        windowTotal: 19,
      },
    });

    const holder = holdLearnerLock({
      beforeCommit: async (tx) =>
        tx.languageSkillLevel.update({
          data: { windowCeiling: null, windowCorrect: 0, windowTotal: 0 },
          where: { id: row.id },
        }),
      userId: user.id,
    });

    const pid = await holder.pid;

    const evidence = recordLanguageSkillEvidence({
      evidence: { ceiling: 1.5, correct: 1, total: 1 },
      language: "ja",
      skill: "reading",
      userId: user.id,
    });

    try {
      await waitForBlockedStatement(pid, LEARNER_LOCK);
    } finally {
      holder.release();
      await Promise.all([holder.done, evidence]);
    }

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      inputVersion: plan.inputVersion,
    });

    await expect(
      prisma.languageSkillLevel.findUniqueOrThrow({ where: { id: row.id } }),
    ).resolves.toMatchObject({ score: 0.5, windowTotal: 1 });
  });

  it("counts simultaneous first reading answers but marks the newly selected score only once", async () => {
    const user = await userFixture();

    const goal = await goalFixture({
      details: { level: "A2" },
      kind: "language",
      targetLanguage: "ja",
      userId: user.id,
    });

    const plan = await planFixture({ goalId: goal.id });
    const answers = 5;

    await Promise.all(
      Array.from({ length: answers }, () =>
        recordLanguageSkillEvidence({
          evidence: { ceiling: 1.5, correct: 1, total: 1 },
          language: "ja",
          skill: "reading",
          userId: user.id,
        }),
      ),
    );

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      inputVersion: plan.inputVersion + 1,
    });

    await expect(
      prisma.languageSkillLevel.findUniqueOrThrow({
        where: { userLanguageSkill: { language: "ja", skill: "reading", userId: user.id } },
      }),
    ).resolves.toMatchObject({ score: 1, windowCorrect: answers, windowTotal: answers });
  });
});
