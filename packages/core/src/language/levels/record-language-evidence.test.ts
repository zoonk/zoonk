import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { after } from "next/server";
import { describe, expect, it } from "vitest";
import { recordLanguageStepEvidence } from "./record-language-evidence";

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
