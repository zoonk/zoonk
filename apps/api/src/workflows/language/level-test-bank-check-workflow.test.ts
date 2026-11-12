import { checkLevelTestQuestions } from "@zoonk/ai/tasks/language/check-level-test-questions";
import { LEVEL_TEST_LEVELS } from "@zoonk/ai/tasks/language/level-test-levels";
import { prisma } from "@zoonk/db";
import { describe, expect, it, vi } from "vitest";
import { checkLikeTheKeys, writtenLevel } from "../_test-utils/level-test-bank";
import { levelTestBankCheckWorkflow } from "./level-test-bank-check-workflow";

async function storeUncheckedBank(passage: string) {
  const pair = { language: `x${crypto.randomUUID().slice(0, 8)}`, targetLanguage: "es" };
  const levels = LEVEL_TEST_LEVELS.map((level) => writtenLevel({ level, passage }).data);

  const questions = levels.flatMap((level) =>
    level.questions.map((question, index) => ({
      ...question,
      id: `${question.skill}-${question.level}-${index % 2}`,
    })),
  );

  await prisma.languageLevelTest.create({
    data: {
      ...pair,
      content: { questions, speaking: levels.map((level) => level.speaking) },
      model: "test",
      promptVersion: "test",
      runId: crypto.randomUUID(),
    },
  });

  return { pair, questions };
}

describe(levelTestBankCheckWorkflow, () => {
  it("checks each level of a bank stored before questions were checked once, removing the ones that fail", async () => {
    const { pair, questions } = await storeUncheckedBank(crypto.randomUUID());

    vi.mocked(checkLevelTestQuestions).mockImplementation(async (params) => {
      const result = await checkLikeTheKeys(params);
      const [first, ...rest] = result.data.checks;

      return params.questions[0]?.passage.endsWith("C1") && first
        ? { ...result, data: { checks: [{ ...first, picks: [1] }, ...rest] } }
        : result;
    });

    await expect(levelTestBankCheckWorkflow({ pair })).resolves.toStrictEqual({ removed: 1 });

    expect(
      vi
        .mocked(checkLevelTestQuestions)
        .mock.calls.map(([input]) => [input.questions.length, input.serviceTier]),
    ).toStrictEqual(LEVEL_TEST_LEVELS.map(() => [4, "flex"]));

    const row = await prisma.languageLevelTest.findUniqueOrThrow({ where: { languagePair: pair } });

    expect(row.checkedAt).toStrictEqual(expect.any(Date));

    expect(JSON.stringify(row.content)).not.toContain('"reading-C1-0"');
    expect(JSON.stringify(row.content)).toContain('"reading-C1-1"');
    expect(questions).toHaveLength(4 * LEVEL_TEST_LEVELS.length);

    vi.mocked(checkLevelTestQuestions).mockClear();
    await expect(levelTestBankCheckWorkflow({ pair })).resolves.toStrictEqual({ removed: 0 });
    expect(checkLevelTestQuestions).not.toHaveBeenCalled();
  });
});
