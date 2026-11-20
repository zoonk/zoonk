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
import { MAX_ESSAY_CHARACTERS, MAX_WRITING_MS, essaySubmissionInputSchema } from "./essay-contract";
import { getWritingAttempt } from "./get-writing-attempt";
import { type WritingConditions, type WritingResult, writtenItemSchema } from "./writing-contract";
import { countWritingLines } from "./writing-lines";
import {
  type WritingArithmetic,
  getWritingArithmetic,
  isNumericWritingRubric,
} from "./writing-rubric-policy";

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
    zeroing: [{ citation, kinds: ["offTopic"], text: "Off topic" }],
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
  onTopicQuote: null,
  zeroKind: null,
  zeroQuote: null,
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

const arithmetic: WritingArithmetic = {
  rounding: { mode: "nearest" as const, places: 2 },
  zeroRules: [0],
};

function mockEvidence() {
  vi.mocked(gradeWritingEvidence, { partial: true }).mockResolvedValue({ data: evidence });
}

function assess(
  assessment: WritingEvidence,
  {
    context = null,
    rubric = basis,
    text = eligible,
    gate = arithmetic,
  }: {
    context?: string | null;
    rubric?: typeof basis;
    text?: string;
    gate?: typeof arithmetic | null;
  } = {},
) {
  const feedback = buildWritingFeedback({
    basis: rubric,
    eligible: text,
    evidence: assessment,
    ignoredFrom: eligible.length,
    previousNextSteps: ["claim"],
  });

  return applyWritingArithmetic({
    arithmetic: gate,
    basis: rubric,
    context,
    eligible: text,
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

  it.each([
    { kind: "blank", no: { text: "An answer." }, yes: { text: "  \n" } },
    { kind: "tooFewLines", no: { text: "One line.\nTwo lines." }, yes: { text: "One line." } },
    {
      kind: "copiedSupport",
      no: {
        context: "The support passage is copied word for word.",
        quote: "The support passage is copied word for word.",
        text: "The support passage is copied word for word.\nOne line.\nTwo lines.",
      },
      yes: {
        context: "The support passage is copied word for word.",
        quote: "The support passage is copied word for word.",
        text: "The support passage is copied word for word.\nOne line.",
      },
    },
    {
      kind: "identification",
      no: { quote: "Assinatura: Nome Completo", text: "Uma resposta.\nAssinatura: Nome Completo" },
      yes: { quote: "Assinatura: Maria Silva", text: "Uma resposta.\nAssinatura: Maria Silva" },
    },
    {
      kind: "offTopic",
      no: { quote: "A recipe for soup", text: "A study of public accounting" },
      yes: { quote: "A recipe for soup", text: "A recipe for soup" },
    },
    {
      kind: "wrongForm",
      no: { quote: "Dear Sir,", text: "The evidence supports a different interpretation." },
      yes: { quote: "Dear Sir,", text: "Dear Sir,\nI write to you." },
    },
  ] as const)("requires independent evidence for $kind", ({ kind, yes, no }) => {
    const rubric = {
      ...basis,
      grading: {
        ...basis.grading,
        zeroing: [{ citation, kinds: [kind], maxLines: 1, text: kind }],
      },
    };

    const result = (example: { text: string; context?: string; quote?: string }) =>
      assess(
        {
          ...evidence,
          aspects: [],
          zeroKind: kind === "blank" || kind === "tooFewLines" ? null : kind,
          zeroQuote: example.quote ?? null,
          zeroRuleIndex: example.quote ? 0 : null,
        },
        { context: example.context, rubric, text: example.text },
      );

    expect(result(yes)).toMatchObject({
      kind: "points",
      total: { high: 0, low: 0 },
      zeroReason: kind,
    });

    expect(result(no)).toMatchObject({ kind: "points", zeroReason: null });
  });

  it("does not zero an off-topic nomination when the answer quotes relevant material", () => {
    expect(
      assess({
        ...evidence,
        onTopicQuote: "A claim",
        zeroKind: "offTopic",
        zeroQuote: "repeat repeat",
        zeroRuleIndex: 0,
      }),
    ).toMatchObject({ total: { high: 0.18, low: 0.05 }, zeroReason: null });
  });

  it("gates Enem's five competence ranges and caps a conditional proposal in code", () => {
    const criteria = ["c1", "c2", "c3", "c4", "c5"].map((id) => ({ id, name: id, points: 200 }));

    const rubric = {
      ...basis,
      criteria,
      grading: { criteria: [], kind: "enem" as const, language: null, rounding: null, zeroing: [] },
      points: 1000,
    };

    const graded: WritingEvidence = {
      ...evidence,
      criteria: criteria.map(({ id }) => ({
        comment: "",
        example: null,
        id,
        level: id === "c2" ? "partial" : "complete",
        quote: "A claim",
      })),
      interventionElements: { action: true, agent: true, detail: true, effect: true, means: true },
      proposalLimit: "conditional",
    };

    expect(getWritingArithmetic(rubric)).toBeNull();
    expect(assess(graded, { gate: null, rubric })).toMatchObject({ kind: "levels" });

    expect(assess(graded, { gate: { ...arithmetic, rounding: null }, rubric })).toMatchObject({
      content: { high: 800, low: 760 },
      deduction: { high: 0, low: 0 },
      kind: "points",
      max: 1000,
      rows: [
        { earned: 200, id: "c1", max: 200, range: { high: 200, low: 200 } },
        { earned: 80, id: "c2", max: 200, range: { high: 120, low: 80 } },
        { earned: 200, id: "c3", max: 200, range: { high: 200, low: 200 } },
        { earned: 200, id: "c4", max: 200, range: { high: 200, low: 200 } },
        { earned: 80, id: "c5", max: 200, range: { high: 80, low: 80 } },
      ],
      total: { high: 800, low: 760 },
    });

    const zero = {
      ...rubric,
      grading: {
        ...rubric.grading,
        zeroing: [{ citation, kinds: ["blank" as const], text: "Blank essay" }],
      },
    };

    expect(
      assess(graded, { gate: { ...arithmetic, rounding: null }, rubric: zero, text: " " }),
    ).toMatchObject({ kind: "points", total: { high: 0, low: 0 }, zeroReason: "Blank essay" });
  });

  it.each([5, 1.25])("gates OAB's verified aspect points out of %s", (max) => {
    const rubric = {
      ...basis,
      aspects: [
        { ...basis.aspects[0]!, points: max * 0.4 },
        { ...basis.aspects[1]!, points: max * 0.6 },
      ],
      grading: {
        ...basis.grading,
        criteria: [{ ...basis.grading.criteria[0]!, points: max }],
        kind: "oab" as const,
        language: null,
        rounding: null,
      },
      points: max,
    };

    expect(getWritingArithmetic(rubric)).toBeNull();
    expect(assess(evidence, { gate: null, rubric })).toMatchObject({ kind: "levels" });

    expect(assess(evidence, { gate: { ...arithmetic, rounding: null }, rubric })).toMatchObject({
      deduction: { high: 0, low: 0 },
      kind: "points",
      max,
      rows: [{ earned: max * 0.4, id: "claim", max }],
      total: { high: max * 0.4, low: max * 0.4 },
    });
  });

  it("grades the issued snapshot at levels only and keeps history outside the evidence request", async () => {
    mockEvidence();

    const grade = await gradeWriting({
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

    await gradeWriting({ content, language: "en", previousNextSteps: [], text: "Claim" });

    expect(gradeWritingEvidence).not.toHaveBeenCalled();

    const drill = { ...content, writing: { ...basis, minimumWords: 1, unit: "drill" as const } };

    await gradeWriting({ content: drill, language: "en", previousNextSteps: [], text: "Claim" });

    expect(gradeWritingEvidence).toHaveBeenCalledOnce();
  });

  it("requires an admission and accepts long submissions without trimming", () => {
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

    expect(essaySubmissionInputSchema.safeParse({ durationMs: 0, text }).success).toBe(false);
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
      loadEssayDrafts({ itemId: item.id, sessionId: session.id, userId: owner.id }),
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
