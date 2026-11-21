import { checkRecallOverlap } from "@zoonk/ai/tasks/items/check-recall-overlap";
import { generateItems } from "@zoonk/ai/tasks/items/generate";
import { type GeneratedItem } from "@zoonk/ai/tasks/items/schemas";
import { type ExamFormatPick } from "@zoonk/core/lookahead/exam-format-skills";
import { prisma } from "@zoonk/db";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { describe, expect, it, vi } from "vitest";
import { taskResult } from "../../_test-utils/recorded-outputs";
import { prepareSkillExamFormatItems } from "./exam-format-items-step";

async function pickFor(answerFormat: ExamFormatPick["answerFormat"]): Promise<ExamFormatPick> {
  const skill = await skillFixture({ name: `History ${crypto.randomUUID()}` });

  return {
    answerFormat,
    skill: {
      country: null,
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
    style: null,
  };
}

describe(prepareSkillExamFormatItems, () => {
  it("remembers a skill the writer found no number to work out in, and only for numbers", async () => {
    vi.mocked(generateItems).mockResolvedValue(taskResult({ items: [] }));

    const [numeric, severalPicks] = await Promise.all([
      pickFor({
        entry: { kind: "integer", places: null },
        format: "numeric",
        options: null,
        select: null,
      }),
      pickFor({ entry: null, format: "multipleChoice", options: null, select: "all" }),
    ]);

    await Promise.all(
      [numeric, severalPicks].map((pick) =>
        prepareSkillExamFormatItems({ pick, workflowRunId: crypto.randomUUID() }),
      ),
    );

    const skills = await prisma.skill.findMany({
      where: { id: { in: [numeric.skill.id, severalPicks.skill.id] } },
    });

    expect(skills.find((skill) => skill.id === numeric.skill.id)?.isQuantitative).toBe(false);
    expect(skills.find((skill) => skill.id === severalPicks.skill.id)?.isQuantitative).toBeNull();
  });

  it("tells the writer the cases the skill's questions already use", async () => {
    vi.mocked(generateItems).mockResolvedValue(taskResult({ items: [] }));

    const pick = await pickFor({ entry: null, format: "multipleChoice", options: null, select: 1 });
    const usedSituations = ["Hector restocks at 80 units a week."];

    await prepareSkillExamFormatItems({
      pick: { ...pick, skill: { ...pick.skill, usedSituations } },
      workflowRunId: crypto.randomUUID(),
    });

    expect(generateItems).toHaveBeenCalledWith(expect.objectContaining({ usedSituations }));
  });

  it("stores only new mock questions after blind solving and checking recall against the full earlier question", async () => {
    const [pick, blueprint] = await Promise.all([
      pickFor({ entry: null, format: "multipleChoice", options: 2, select: 1 }),
      examBlueprintFixture(),
    ]);

    const earlier = [{ answer: "true", question: "The original claim." }];

    const mock = {
      ...pick.skill,
      earlier,
      exam: {
        blueprintId: blueprint.id,
        name: "Audit — Cebraspe",
        optionCount: null,
        pastQuestions: ["A released question."],
        style: "Judge each claim under the official rules.",
      },
      wrongPenalty: 1,
    };

    const statements = [
      "The original CLAIM!",
      "A rewording of the original claim.",
      "The accounts balance after reversal.",
    ];

    const items = statements.map((statement): GeneratedItem => ({
      context: null,
      difficulty: "medium",
      format: "trueFalse",
      image: null,
      isTrue: true,
      misconception: null,
      reason: "The reversal offsets the debit.",
      statement,
      visual: null,
    }));

    vi.mocked(generateItems).mockResolvedValue(taskResult({ items }));

    vi.mocked(checkRecallOverlap).mockResolvedValue(
      taskResult({ repeats: [{ candidate: 0, earlier: 0, reason: "The same assertion." }] }),
    );

    const written = await prepareSkillExamFormatItems({
      mock,
      pick: {
        answerFormat: { entry: null, format: "trueFalse", options: null, select: null },
        skill: mock,
        style: "True or false",
      },
      workflowRunId: crypto.randomUUID(),
    });

    expect(generateItems).toHaveBeenCalledWith(
      expect.objectContaining({
        examFormat: expect.objectContaining({
          name: mock.exam.name,
          pastQuestions: mock.exam.pastQuestions,
          style: expect.stringContaining(mock.exam.style),
          wrongPenalty: 1,
        }),
        purpose: "mock",
      }),
    );

    expect(checkRecallOverlap).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ candidates: items.slice(1), earlier }),
    );

    expect(written).toBe(1);

    await expect(
      prisma.item.findMany({
        select: { content: true, mockOnly: true },
        where: { skillId: mock.id },
      }),
    ).resolves.toStrictEqual([
      { content: expect.objectContaining({ statement: statements[2] }), mockOnly: true },
    ]);
  });

  it("reserves a short answer only when the mock can mark it without a model", async () => {
    const pick = await pickFor({ entry: null, format: "multipleChoice", options: 2, select: 1 });

    const typed = {
      acceptedAnswers: ["chloride"],
      context: null,
      difficulty: "medium",
      format: "typed",
      image: null,
      keyPoints: ["Names chloride."],
      question: "Which ion has charge -1?",
      sampleAnswer: "Chloride",
      visual: null,
    } satisfies GeneratedItem;

    vi.mocked(generateItems).mockResolvedValue(
      taskResult({
        items: [
          typed,
          {
            ...typed,
            acceptedAnswers: ["sodium"],
            keyPoints: ["Names sodium."],
            question: "Which ion has charge +1?",
            sampleAnswer: "Sodium",
          },
          { ...typed, acceptedAnswers: [], question: "Explain how ions form." },
        ],
      }),
    );

    const written = await prepareSkillExamFormatItems({
      mock: { ...pick.skill, earlier: [], wrongPenalty: 0 },
      pick: {
        ...pick,
        answerFormat: { entry: null, format: "typed", options: null, select: null },
      },
      workflowRunId: crypto.randomUUID(),
    });

    expect(written).toBe(2);
    expect(checkRecallOverlap).not.toHaveBeenCalled();

    await expect(
      prisma.item.findMany({
        orderBy: { id: "asc" },
        select: { content: true, mockOnly: true },
        where: { skillId: pick.skill.id },
      }),
    ).resolves.toStrictEqual([
      { content: expect.objectContaining({ acceptedAnswers: ["chloride"] }), mockOnly: true },
      { content: expect.objectContaining({ acceptedAnswers: ["sodium"] }), mockOnly: true },
    ]);
  });
});
