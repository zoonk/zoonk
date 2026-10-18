import { generateItems } from "@zoonk/ai/tasks/v2/items/generate";
import { type ExamFormatPick } from "@zoonk/core/lookahead/exam-format-skills";
import { prisma } from "@zoonk/db";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { describe, expect, it, vi } from "vitest";
import { taskResult } from "../../_test-utils/recorded-outputs";
import { prepareExamFormatItemsStep } from "./exam-format-items-step";

async function pickFor(answerFormat: ExamFormatPick["answerFormat"]): Promise<ExamFormatPick> {
  const skill = await skillFixture({ name: `History ${crypto.randomUUID()}` });

  return {
    answerFormat,
    skill: {
      description: skill.description,
      exam: null,
      id: skill.id,
      language: skill.language,
      level: null,
      name: skill.name,
      ownerId: null,
      targetLanguage: null,
      usedSituations: [],
    },
  };
}

describe(prepareExamFormatItemsStep, () => {
  it("remembers a skill the writer found no number to work out in, and only for numbers", async () => {
    vi.mocked(generateItems).mockResolvedValue(taskResult({ items: [] }));

    const [numeric, severalPicks] = await Promise.all([
      pickFor({ entry: { kind: "integer", places: null }, format: "numeric", select: null }),
      pickFor({ entry: null, format: "multipleChoice", select: "all" }),
    ]);

    await Promise.all(
      [numeric, severalPicks].map((pick) =>
        prepareExamFormatItemsStep({ pick, workflowRunId: crypto.randomUUID() }),
      ),
    );

    const skills = await prisma.skill.findMany({
      where: { id: { in: [numeric.skill.id, severalPicks.skill.id] } },
    });

    expect(skills.find((skill) => skill.id === numeric.skill.id)?.isQuantitative).toBe(false);
    expect(skills.find((skill) => skill.id === severalPicks.skill.id)?.isQuantitative).toBeNull();
  });
});
