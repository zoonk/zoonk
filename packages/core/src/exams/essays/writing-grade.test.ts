import { randomUUID } from "node:crypto";
import { type WritingEvidence, gradeWritingEvidence } from "@zoonk/ai/tasks/grading/grade-essay";
import { prisma } from "@zoonk/db";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { creditWrittenSkills } from "../../learner/written-evidence";
import { loadEssayDrafts } from "./_utils/essay-drafts";
import { gradeWriting, recordEssayGrade } from "./_utils/grade-essay-answer";
import { getWritingAttemptId } from "./_utils/writing-attempt-id";
import { applyWritingArithmetic, buildWritingFeedback } from "./_utils/writing-feedback";
import {
  MAX_ESSAY_CHARACTERS,
  MAX_WRITING_MS,
  essayAnswerSchema,
  essaySubmissionInputSchema,
} from "./essay-contract";
import { getWritingAttempt } from "./get-writing-attempt";
import { type WritingConditions, type WritingResult, writtenItemSchema } from "./writing-contract";
import { countWritingLines } from "./writing-lines";
import { getWritingArithmetic, isNumericWritingRubric } from "./writing-rubric-policy";

vi.mock("@zoonk/ai/tasks/grading/grade-essay");
vi.mock("../../learner/written-evidence", () => ({ creditWrittenSkills: vi.fn() }));

const citation = { passage: "Official grading rules", sourceId: "notice" };

const conditions: WritingConditions = {
  admissionId: "1c156931-a336-4da6-9164-17f4d80ea169",
  estimatedLines: 3,
  origin: "block",
  timed: false,
  version: "firstDraft",
};

const basis = writtenItemSchema.parse({
  aspects: [
    { criterionId: "claim", description: "Make a clear claim", points: 0.3 },
    { criterionId: "claim", description: "Explain the claim", points: 0.45 },
  ],
  assessedSkillIds: ["6d0ef67d-2dc8-4cca-b355-9924a7549387"],
  charactersPerLine: 24,
  criteria: [{ id: "claim", name: "Claim", points: 0.75 }],
  grading: {
    criteria: [{ citation, id: "claim", points: 0.75, text: "Claim" }],
    kind: "points",
    language: {
      citation,
      factor: 0.25,
      formula: "0.25 × errors ÷ lines",
      method: "errorsPerLine",
      text: "Deduction",
    },
    rounding: { citation, text: "Round to two places" },
    zeroing: [{ citation, text: "Off topic" }],
  },
  keySource: "practiceKey",
  lines: 2,
  minimumWords: 2,
  points: 0.75,
  taskKey: "question-a",
  title: "A question",
  unit: "answer",
});

const evidence: WritingEvidence = {
  aspects: [
    { aspectIndex: 0, criterionId: "claim", earned: true, quote: "A claim" },
    { aspectIndex: 1, criterionId: "claim", earned: true, quote: "ignored" },
  ],
  criteria: [
    { comment: "Good claim", example: null, id: "claim", level: "strong", quote: "A claim" },
  ],
  errors: [
    { correction: "error", kind: "spelling", quote: "eror" },
    { correction: "error", kind: "spelling", quote: "eror" },
    { correction: "right", kind: "grammar", quote: "repeat" },
    { correction: "verified", kind: "grammar", quote: "invented" },
    { correction: "eligible", kind: "grammar", quote: "ignored" },
  ],
  nextStep: null,
  zeroRuleIndex: null,
};

const original = "🙂 A claim, eror\r\nrepeat repeat\r\nignored";
const eligible = "🙂 A claim, eror\r\nrepeat repeat\r\n";

const content = {
  context: null,
  keyPoints: ["State the main claim."],
  question: "Make a claim.",
  rubric: [],
  sampleOutline: "Make a claim.",
  writing: basis,
};

const arithmetic = { rounding: { mode: "nearest" as const, places: 2 }, zeroRules: [0] };

function mockEvidence() {
  vi.mocked(gradeWritingEvidence, { partial: true }).mockResolvedValue({ data: evidence });
}

function assess(assessment: WritingEvidence) {
  const feedback = buildWritingFeedback({
    basis,
    eligible,
    evidence: assessment,
    ignoredFrom: eligible.length,
    previousNextSteps: ["claim"],
  });

  return applyWritingArithmetic({
    arithmetic,
    basis,
    eligible,
    estimatedLines: 3,
    evidence: assessment,
    feedback,
  });
}

describe("writing grades", () => {
  it("verifies quoted aspects and errors before calculating decimal points and rounding", () => {
    expect(assess(evidence)).toMatchObject({
      content: { high: 0.3, low: 0.3 },
      deduction: { high: 0.25, low: 0.125 },
      errors: [{ quote: "eror", start: original.indexOf("eror") }],
      kind: "points",
      max: 0.75,
      progress: { fixed: ["claim"], persists: [] },
      rows: [{ earned: 0.3, id: "claim", max: 0.75 }],
      total: { high: 0.18, low: 0.05 },
    });
  });

  it("applies an evaluated zero rule with evidence and rejects an unsupported zero", () => {
    const failed = [{ ...evidence.criteria[0]!, level: "missing" as const }];

    expect(assess({ ...evidence, criteria: failed, zeroRuleIndex: 0 })).toMatchObject({
      total: { high: 0, low: 0 },
      zeroReason: "Off topic",
    });

    expect(assess({ ...evidence, zeroRuleIndex: 0 })).toMatchObject({
      total: { high: 0.18, low: 0.05 },
      zeroReason: null,
    });
  });

  it("grades the issued snapshot at levels only and keeps history outside the evidence request", async () => {
    mockEvidence();

    const grade = await gradeWriting({
      conditions,
      content,
      language: "en",
      previousNextSteps: ["claim"],
      text: original,
    });

    expect(grade).toMatchObject({
      ignoredFrom: eligible.length,
      kind: "levels",
      progress: { fixed: ["claim"] },
    });

    expect(grade).not.toHaveProperty("total");
    expect(getWritingArithmetic(basis)).toBeNull();
    expect(isNumericWritingRubric(basis)).toBe(false);

    const [request] = vi.mocked(gradeWritingEvidence).mock.lastCall ?? [];
    expect(request).toMatchObject({ scoringBasis: { points: 0.75 }, text: eligible });
    expect(request).not.toHaveProperty("previousNextSteps");
  });

  it("honors the issued drill's shorter word floor", async () => {
    mockEvidence();
    vi.mocked(gradeWritingEvidence).mockClear();

    await gradeWriting({
      conditions,
      content,
      language: "en",
      previousNextSteps: [],
      text: "Claim",
    });

    expect(gradeWritingEvidence).not.toHaveBeenCalled();

    const drill = { ...content, writing: { ...basis, minimumWords: 1, unit: "drill" as const } };

    await gradeWriting({
      conditions,
      content: drill,
      language: "en",
      previousNextSteps: [],
      text: "Claim",
    });

    expect(gradeWritingEvidence).toHaveBeenCalledOnce();
  });

  it("preserves old numeric drafts and accepts long submissions without trimming", () => {
    const text = `  ${"A legal argument. ".repeat(1000)}\n`;
    const input = { admissionId: conditions.admissionId, durationMs: 210 * 60 * 1000, text };

    expect(essaySubmissionInputSchema.parse(input).text).toBe(text);

    expect(
      essaySubmissionInputSchema.safeParse({ ...input, durationMs: MAX_WRITING_MS + 1 }).success,
    ).toBe(false);

    expect(
      essaySubmissionInputSchema.safeParse({ ...input, text: "a".repeat(MAX_ESSAY_CHARACTERS + 1) })
        .success,
    ).toBe(false);

    expect(
      essayAnswerSchema.parse({
        grade: {
          criteria: [],
          enemInterventionElements: null,
          nextStep: null,
          range: { high: 7, low: 5 },
          total: { maxScore: 10, score: 6 },
          zeroReason: null,
        },
        text,
      }).grade.total.score,
    ).toBe(6);
  });
});

describe(countWritingLines, () => {
  it("counts graphemes, preserves UTF-16 offsets and counts blank lines", () => {
    const text = "e\u0301🙂\r\n\r\nnext";

    expect(countWritingLines({ charactersPerLine: 2, limit: 2, text })).toStrictEqual({
      estimatedLines: 4,
      ignoredFrom: text.indexOf("next"),
    });
  });
});

describe(recordEssayGrade, () => {
  it("rechecks the issued receipt, records levels once and reads feedback only for its owner", async () => {
    const [owner, intruder, skill] = await Promise.all([
      userFixture(),
      userFixture(),
      skillFixture(),
    ]);

    const [session, item] = await Promise.all([
      studySessionFixture({ userId: owner.id }),
      itemFixture({
        content: { ...content, rubric: [{ criterion: "Claim", description: "Make a claim" }] },
        format: "essay",
        skillId: skill.id,
      }),
    ]);

    const admissionId = randomUUID();

    await prisma.writingAdmission.create({
      data: {
        extra: false,
        id: admissionId,
        itemIds: [item.id],
        localDate: session.localDate,
        userId: owner.id,
      },
    });

    const block = await studySessionBlockFixture({
      kind: "produce",
      payload: {
        itemIds: [item.id],
        writing: { admissionId, draft: null, taskKey: basis.taskKey, unit: basis.unit },
      },
      sessionId: session.id,
      status: "active",
    });

    const grade: WritingResult = {
      criteria: [],
      errors: [],
      ignoredFrom: null,
      kind: "levels",
      nextStep: null,
      progress: null,
    };

    const answer = {
      activeBlockId: block.id,
      conditions: { ...conditions, admissionId },
      durationMs: 210 * 60 * 1000,
      grade,
      item,
      studySessionId: session.id,
      text: original,
      timeZone: "UTC",
      userId: owner.id,
    };

    await expect(
      recordEssayGrade({
        ...answer,
        conditions: { ...answer.conditions, admissionId: randomUUID() },
      }),
    ).resolves.toMatchObject({ status: "refused" });

    const recorded = await recordEssayGrade(answer);
    const attemptId = getWritingAttemptId({ admissionId, itemId: item.id });

    expect(recorded).toMatchObject({
      recorded: { attempt: { answer: { grade, text: original }, id: attemptId, score: null } },
      status: "recorded",
    });

    await expect(
      recordEssayGrade({ ...answer, text: "This retry had different content." }),
    ).resolves.toMatchObject({ saved: { answer: { text: original } }, status: "saved" });

    expect(creditWrittenSkills).toHaveBeenCalledOnce();

    await expect(
      loadEssayDrafts({
        format: "writing",
        itemId: item.id,
        sessionId: session.id,
        userId: owner.id,
      }),
    ).resolves.toMatchObject([{ attemptId, grade, text: original }]);

    mockSession(intruder.id);
    await expect(getWritingAttempt(attemptId)).resolves.toStrictEqual({ status: "notFound" });
    mockSession(owner.id);
    const result = await getWritingAttempt(attemptId);

    expect(result).toMatchObject({
      attempt: { attemptId, grade, text: original, writing: { taskKey: basis.taskKey } },
      status: "ready",
    });

    expect(result).not.toHaveProperty("attempt.writing.aspects");
    expect(result).not.toHaveProperty("attempt.writing.assessedSkillIds");
  });
});
