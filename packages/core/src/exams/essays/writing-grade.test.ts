import { randomUUID } from "node:crypto";
import {
  type WritingEvidence,
  getWritingGrader,
  gradeWritingEvidence,
} from "@zoonk/ai/tasks/grading/grade-essay";
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
import cacd2024Essay from "./_test-utils/cacd-2024-essay.json";
import cacd2025HistoryQ4 from "./_test-utils/cacd-2025-history-q4.json";
import { calibrationFixture, rowCalibrationFixture } from "./_test-utils/writing-calibration";
import lineFixtures from "./_test-utils/writing-lines.json";
import { loadEssayDrafts } from "./_utils/essay-drafts";
import { gradeWriting, recordEssayGrade } from "./_utils/grade-essay-answer";
import { getWritingAttemptId } from "./_utils/writing-attempt-id";
import { type WritingCalibration, writingCalibrationSchema } from "./_utils/writing-calibration";
import savedCalibration from "./_utils/writing-calibration-data.json";
import { applyWritingArithmetic, buildWritingFeedback } from "./_utils/writing-feedback";
import { createWritingQuoteLookup } from "./_utils/writing-quotes";
import { getWritingTaskBasis, matchesWritingTaskBasis } from "./_utils/writing-task-basis";
import { MAX_ESSAY_CHARACTERS, MAX_WRITING_MS, essaySubmissionInputSchema } from "./essay-contract";
import { getWritingAttempt } from "./get-writing-attempt";
import {
  type WritingConditions,
  type WritingResult,
  readWritingPrompt,
  writtenAnswerSchema,
  writtenItemSchema,
} from "./writing-contract";
import {
  WRITING_CHARACTERS_PER_LINE,
  WRITING_MAX_CHARACTERS_PER_LINE,
  countWritingLines,
} from "./writing-lines";
import { isNumericWritingRubric } from "./writing-rubric-policy";

vi.mock(import("@zoonk/ai/tasks/grading/grade-essay"), async (importOriginal) => ({
  ...(await importOriginal()),
  gradeWritingEvidence: vi.fn(),
}));

const calibration = vi.hoisted(() => ({ current: null as WritingCalibration | null }));

vi.mock(import("./_utils/writing-calibration"), async (importOriginal) => ({
  ...(await importOriginal()),
  get writingCalibration() {
    return calibration.current;
  },
}));

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
  criteria: [{ id: "claim", name: "Claim", points: 0.75 }],
  grading: {
    criteria: [{ citation, id: "claim", points: 0.75, text: "Claim" }],
    language: {
      citation,
      factor: 0.25,
      formula: "0.25 × errors ÷ lines",
      method: "errorsPerLine",
      text: "Deduction",
    },
    rounding: {
      citation,
      mode: "nearest",
      stage: "total",
      step: 0.01,
      text: "Round to two places",
    },
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
  awards: [
    { award: 1, quote: "A claim", row: 0 },
    { award: 1, quote: "ignored", row: 1 },
  ],
  criteria: [{ comment: "Good claim", example: null, id: "claim", quote: "A claim" }],
  elements: [],
  errors: [
    { correction: "error", kind: "spelling", quote: "eror" },
    { correction: "error", kind: "spelling", quote: "eror" },
    { correction: "right", kind: "grammar", quote: "repeat" },
    { correction: "verified", kind: "grammar", quote: "invented" },
    { correction: "eligible", kind: "grammar", quote: "ignored" },
  ],
  limits: [],
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

function mockEvidence() {
  vi.mocked(gradeWritingEvidence, { partial: true }).mockResolvedValue({ data: evidence });
}

function assess(
  assessment: WritingEvidence,
  {
    context = null,
    rubric = basis,
    text = eligible,
    gate = true,
    ignoredFrom = eligible.length,
  }: {
    context?: string | null;
    rubric?: typeof basis;
    text?: string;
    gate?: boolean;
    ignoredFrom?: number | null;
  } = {},
) {
  const feedback = buildWritingFeedback({
    basis: rubric,
    eligible: text,
    evidence: assessment,
    ignoredFrom,
    previousNextSteps: ["claim"],
  });

  return applyWritingArithmetic({
    basis: rubric,
    context,
    eligible: text,
    estimatedLines: 3,
    evidence: assessment,
    feedback,
    numeric: gate,
  });
}

describe("writing grades", () => {
  it.each([false, true])(
    "uses the line limit when there is no higher-value instruction",
    (gate) => {
      const text = "A claim and its explanation.";

      const full: WritingEvidence = {
        ...evidence,
        awards: [
          { award: 1, quote: "A claim", row: 0 },
          { award: 1, quote: "its explanation", row: 1 },
        ],
        errors: [],
        nextStep: {
          criterionId: "claim",
          example: null,
          quote: "its explanation",
          text: "Finish the explanation.",
          title: "Finish your explanation",
        },
      };

      expect(assess(full, { gate, text })).toMatchObject({
        nextStep: { kind: "limit", title: null },
      });

      expect(assess(full, { gate, ignoredFrom: null, text }).nextStep).toBeNull();
      expect(assess(evidence, { gate })).toMatchObject({ nextStep: { kind: "limit" } });

      expect(assess(evidence, { gate, ignoredFrom: null })).toMatchObject({
        nextStep: { criterionId: "claim", kind: "criterion" },
      });
    },
  );

  it.each([
    { quote: "Em ÁREAS rurais", written: "em áreas rurais" },
    { quote: "A clear claim", written: "A clear\nclaim" },
    { quote: "A clear claim", written: "A clear\r\n\r\nclaim" },
    { quote: "A clear claim", written: "A\tclear\u00A0  claim" },
    { quote: "\"Um caso\" - de 'teste'", written: "“Um caso” — de ‘teste’" },
  ])("credits $quote and returns the learner's own passage", ({ quote, written }) => {
    const prefix = "🙂 e\u0301:\t  ";
    const text = `${prefix}${written}.`;

    expect(createWritingQuoteLookup(text).locateUnique(quote)).toStrictEqual({
      end: prefix.length + written.length,
      start: prefix.length,
    });

    const result = assess(
      {
        ...evidence,
        awards: [{ award: 1, quote, row: 0 }],
        criteria: [{ ...evidence.criteria[0]!, quote }],
        nextStep: {
          criterionId: "claim",
          example: null,
          quote,
          text: "Explain the evidence.",
          title: "Explain the evidence",
        },
      },
      { text },
    );

    expect(result).toMatchObject({
      criteria: [{ quote: written }],
      nextStep: { kind: "criterion", quote: written, title: "Explain the evidence" },
      rows: [{ earned: 0.3 }],
    });
  });

  it.each([
    { quote: "em áreas rurais", text: "Em áreas rurais e em áreas rurais." },
    { quote: "A a", text: "A a A" },
  ])("credits $quote, which $text repeats, and highlights neither passage", ({ quote, text }) => {
    const result = assess(
      {
        ...evidence,
        awards: [{ award: 1, quote, row: 0 }],
        criteria: [{ ...evidence.criteria[0]!, quote }],
      },
      { text },
    );

    expect(result).toMatchObject({ criteria: [{ quote: null }], rows: [{ earned: 0.3 }] });
  });

  it.each([
    { quote: "existe uma interação", text: "existindo uma interação" },
    { quote: "haveram problemas", text: "houveram problemas" },
    { quote: "em areas rurais", text: "em áreas rurais" },
    { quote: "áreas rurais", text: "rurais áreas" },
  ])("rejects the unsupported passage $quote in $text", ({ quote, text }) => {
    const result = assess(
      {
        ...evidence,
        awards: [{ award: 1, quote, row: 0 }],
        criteria: [{ ...evidence.criteria[0]!, quote }],
        nextStep: {
          criterionId: "claim",
          example: null,
          quote,
          text: "Explain the evidence.",
          title: "Explain the evidence",
        },
      },
      { text },
    );

    expect(result).toMatchObject({
      criteria: [{ quote: null }],
      nextStep: { quote: null },
      rows: [{ earned: 0 }],
    });
  });

  it("requires literal language errors and keeps their UTF-16 offsets", () => {
    const text = "🙂 e\u0301: brasil tem areas e houveram\r\nproblemas com “aspas”.";

    const result = assess(
      {
        ...evidence,
        errors: [
          { correction: "Brasil", kind: "capitalization", quote: "brasil" },
          { correction: "áreas", kind: "spelling", quote: "areas" },
          { correction: "Brasil tem", kind: "capitalization", quote: "BRASIL tem" },
          { correction: "nas áreas", kind: "spelling", quote: "tem áreas" },
          { correction: "houve problemas", kind: "grammar", quote: "haveram" },
          { correction: "houve problemas", kind: "grammar", quote: "houveram problemas" },
          { correction: "aspas", kind: "punctuation", quote: '"aspas"' },
          { correction: "houve\r\nproblemas", kind: "grammar", quote: "houveram\r\nproblemas" },
        ],
      },
      { text },
    );

    expect(result.errors.map(({ quote, start }) => ({ quote, start }))).toStrictEqual([
      { quote: "brasil", start: 7 },
      { quote: "areas", start: 18 },
      { quote: "houveram\r\nproblemas", start: 26 },
    ]);
  });

  it("verifies quoted aspects and errors before calculating decimal points and rounding", () => {
    expect(assess(evidence)).toMatchObject({
      content: { high: 0.3, low: 0.3 },
      deduction: { high: 0.25, low: 0.125 },
      errors: [{ quote: "eror", start: original.indexOf("eror") }],
      kind: "points",
      max: 0.75,
      progress: { fixed: [], persists: ["claim"] },
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
          awards: [],
          zeroKind: kind === "blank" || kind === "tooFewLines" ? null : kind,
          zeroQuote: example.quote ?? null,
          zeroRuleIndex: example.quote ? 7 : null,
        },
        { context: example.context, rubric, text: example.text },
      );

    expect(result(yes)).toMatchObject({
      kind: "points",
      nextStep: { kind: "zero", title: null },
      total: { high: 0, low: 0 },
      zeroKind: kind,
      zeroReason: kind,
    });

    expect(result(no)).toMatchObject({ kind: "points", zeroReason: null });
  });

  it("returns zero and the exam's line rule on a measured sheet", async () => {
    calibration.current = writingCalibrationSchema.parse(savedCalibration);

    try {
      const rule = "Answers of one line or fewer score zero.";

      const writing = {
        ...basis,
        grading: {
          ...basis.grading,
          zeroing: [{ citation, kinds: ["tooFewLines" as const], maxLines: 1, text: rule }],
        },
      };

      await expect(
        gradeWriting({
          content: { ...content, writing },
          language: "en",
          previousNextSteps: [],
          text: "Claim",
        }),
      ).resolves.toMatchObject({
        kind: "points",
        nextStep: { kind: "zero" },
        total: { high: 0, low: 0 },
        zeroKind: "tooFewLines",
        zeroReason: rule,
      });
    } finally {
      calibration.current = null;
    }
  });

  it("gives a blank answer the blank rule when a line-count rule comes first", () => {
    const rubric = {
      ...basis,
      grading: {
        ...basis.grading,
        zeroing: [
          { citation, kinds: ["tooFewLines" as const], maxLines: 7, text: "At most 7 lines" },
          { citation, kinds: ["blank" as const], text: "Blank" },
        ],
      },
    };

    expect(
      assess({ ...evidence, awards: [], zeroKind: null }, { rubric, text: " \n" }),
    ).toMatchObject({ zeroKind: "blank", zeroReason: "Blank" });
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

  it.each([
    [5, 0, 2],
    [1.25, 2, 0.5],
    [9.5, 1, 3.8],
    [30, 0, 12],
    [70, 0, 28],
  ])("returns unrounded points out of %s with %s places for display", (max, decimals, earned) => {
    const rubric = {
      ...basis,
      aspects: [
        { ...basis.aspects[0]!, points: earned },
        { ...basis.aspects[1]!, points: max - earned },
      ],
      grading: {
        ...basis.grading,
        criteria: [{ ...basis.grading.criteria[0]!, points: max }],
        language: null,
        rounding: null,
      },
      points: max,
    };

    expect(isNumericWritingRubric(rubric)).toBe(false);
    expect(assess(evidence, { gate: false, rubric })).toMatchObject({ kind: "levels" });

    expect(assess(evidence, { rubric })).toMatchObject({
      decimals,
      deduction: { high: 0, low: 0 },
      kind: "points",
      max,
      rows: [{ decimals, earned, id: "claim", max }],
      total: { high: earned, low: earned },
    });
  });

  it("uses the active evaluated grader and withholds points after a provider fallback", async () => {
    const grader = getWritingGrader();

    const provenance = {
      ...grader,
      generatedAt: "2026-11-21T00:00:00.000Z",
      latencyMs: 0,
      provider: "meta",
      requestedModel: grader.model,
      runId: "fixture",
      usage: {},
    };

    const writing = { ...basis, grading: { ...basis.grading, rounding: null } };

    const input = {
      content: { ...content, writing },
      language: "en",
      previousNextSteps: [],
      text: original,
    };

    const provider = vi.mocked(gradeWritingEvidence, { partial: true });
    provider.mockResolvedValueOnce({ data: evidence, provenance });
    await expect(gradeWriting(input)).resolves.toMatchObject({ kind: "levels" });

    calibration.current = calibrationFixture({
      grader,
      rows: { definitePoint: rowCalibrationFixture(), judgedScale: rowCalibrationFixture() },
    });

    try {
      const unseen = {
        ...input,
        content: {
          ...input.content,
          writing: {
            ...writing,
            aspects: writing.aspects.map((aspect) => ({ ...aspect, points: 5 })),
            grading: {
              ...writing.grading,
              criteria: writing.grading.criteria.map((criterion) => ({ ...criterion, points: 10 })),
            },
            points: 10,
            taskKey: "unseen-exam-board",
          },
        },
      };

      provider.mockResolvedValueOnce({ data: evidence, provenance });

      await expect(gradeWriting(unseen)).resolves.toMatchObject({
        decimals: 0,
        kind: "points",
        max: 10,
      });

      provider.mockResolvedValueOnce({ data: evidence, provenance });

      const mixed = {
        ...writing,
        aspects: writing.aspects.map((aspect, index) =>
          index === 0 ? { ...aspect, kind: "judgedScale" as const } : aspect,
        ),
      };

      await expect(
        gradeWriting({ ...input, content: { ...content, writing: mixed } }),
      ).resolves.toMatchObject({ kind: "points" });

      calibration.current = calibrationFixture({ grader });
      provider.mockResolvedValueOnce({ data: evidence, provenance });

      await expect(
        gradeWriting({ ...input, content: { ...content, writing: mixed } }),
      ).resolves.toMatchObject({ kind: "levels" });

      expect(isNumericWritingRubric(basis)).toBe(true);
      expect(isNumericWritingRubric({ ...basis, points: 1 })).toBe(false);

      expect(
        isNumericWritingRubric({
          ...basis,
          grading: { ...basis.grading, rounding: { citation, text: "Precision" } },
        }),
      ).toBe(false);

      provider.mockResolvedValueOnce({
        data: evidence,
        provenance: { ...provenance, model: "fallback" },
      });

      await expect(gradeWriting(input)).resolves.toMatchObject({ kind: "levels" });

      provider.mockResolvedValueOnce({
        data: evidence,
        provenance: { ...provenance, promptVersion: "old" },
      });

      await expect(gradeWriting(input)).resolves.toMatchObject({ kind: "levels" });
    } finally {
      calibration.current = null;
    }
  });

  it("reads a saved recommendation without requiring an instruction title", () => {
    const grade = assess(evidence, { gate: false, ignoredFrom: null });

    const nextStep = {
      criterionId: "claim",
      example: null,
      quote: null,
      text: "Explain the claim.",
    };

    const saved = writtenAnswerSchema.parse({
      conditions,
      examBlueprintId: null,
      grade: { ...grade, nextStep },
      itemId: randomUUID(),
      text: original,
      writing: { ...basis, part: null },
    });

    expect(saved.grade.nextStep).toStrictEqual({ ...nextStep, kind: "criterion" });

    const overLimit = writtenAnswerSchema.parse({
      ...saved,
      grade: { ...grade, ignoredFrom: eligible.length, nextStep: null },
    });

    expect(overLimit.grade.nextStep).toMatchObject({ kind: "limit", title: null });
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
      progress: { persists: ["claim"] },
    });

    expect(grade).not.toHaveProperty("total");
    expect(isNumericWritingRubric(basis)).toBe(false);

    const [request] = vi.mocked(gradeWritingEvidence).mock.lastCall ?? [];

    expect(request).toMatchObject({
      rows: [
        { awards: [{ points: 0 }, { points: 0.3 }], criterionId: "claim" },
        { awards: [{ points: 0 }, { points: 0.45 }], criterionId: "claim" },
      ],
      text: eligible,
    });

    expect(request?.rows[0]).not.toHaveProperty("kind");
    expect(request).not.toHaveProperty("previousNextSteps");
  });

  it("honors the issued drill's shorter word floor", async () => {
    mockEvidence();
    vi.mocked(gradeWritingEvidence).mockClear();

    await expect(
      gradeWriting({ content, language: "pt", previousNextSteps: [], text: "Claim" }),
    ).resolves.toMatchObject({ nextStep: { kind: "short", text: "", title: null } });

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

const rounded = (rounding: { mode: "down" | "nearest"; step: number; text: string }) =>
  getWritingTaskBasis({
    ...basis,
    grading: { ...basis.grading, rounding: { citation, stage: "total", ...rounding } },
  });

const mean = (weights: readonly number[]) => ({
  ...basis,
  grading: {
    ...basis.grading,
    combination: { citation, method: "mean" as const, step: null, text: "The mean" },
    criteria: weights.map((weight, index) => ({
      citation,
      id: `criterion-${index}`,
      points: 10,
      text: "A criterion",
      weight,
    })),
    language: null,
    rounding: null,
    zeroing: [],
  },
  lines: 30,
  points: 10,
});

// The basis a weighted mean's drill was issued with before its weights were part of it.
const ISSUED_MEAN_BASIS =
  '[30,10,{"criteria":[10,10],"language":null,"rounding":null,"zeroing":[],"combination":{"method":"mean","step":null}}]';

describe(getWritingTaskBasis, () => {
  it("keeps cosmetic changes out of the task compatibility key", () => {
    const revised = {
      ...basis,
      grading: {
        ...basis.grading,
        criteria: basis.grading.criteria.map((criterion) => ({
          ...criterion,
          citation: { passage: "Shorter quotation", sourceId: "reread" },
          id: "thesis",
          text: "State the main point",
        })),
      },
      minimumWords: basis.minimumWords + 10,
    };

    const prompt = { ...basis, taskBasis: getWritingTaskBasis(basis) };

    expect(matchesWritingTaskBasis({ prompt, task: revised })).toBe(true);
    expect(matchesWritingTaskBasis({ prompt, task: { ...revised, lines: 40 } })).toBe(false);

    expect(getWritingTaskBasis({ ...revised, points: 10 })).not.toBe(getWritingTaskBasis(basis));

    expect(isNumericWritingRubric(revised)).toBe(false);
  });

  it("tells apart a weighted mean's weights, which move its marks", () => {
    expect(getWritingTaskBasis(mean([1, 3]))).not.toBe(getWritingTaskBasis(mean([1, 1])));
    expect(getWritingTaskBasis(mean([1, 1]))).toBe(ISSUED_MEAN_BASIS);
  });

  it("tells apart two criteria swapping their weights", () => {
    expect(getWritingTaskBasis(mean([1, 3]))).not.toBe(getWritingTaskBasis(mean([3, 1])));
  });

  it("keeps matching a basis stored in today's shape", () => {
    const prompt = { ...mean([1, 1]), taskBasis: ISSUED_MEAN_BASIS };

    expect(matchesWritingTaskBasis({ prompt, task: mean([1, 1]) })).toBe(true);
    expect(matchesWritingTaskBasis({ prompt, task: mean([1, 3]) })).toBe(false);
  });

  it("reads an earlier drill's weights from the sheet it was issued with", () => {
    const prompt = { ...mean([1, 3]), taskBasis: ISSUED_MEAN_BASIS };

    expect(matchesWritingTaskBasis({ prompt, task: mean([1, 3]) })).toBe(true);
    expect(matchesWritingTaskBasis({ prompt, task: mean([1, 1]) })).toBe(false);
  });

  it("fingerprints the rounding rule by its numbers, not its wording", () => {
    const two = { mode: "nearest", step: 0.01, text: "Round to two places." } as const;

    expect(rounded(two)).toBe(rounded({ ...two, text: "Rounded to 2 decimal places." }));
    expect(rounded({ ...two, mode: "down" })).not.toBe(rounded(two));
    expect(rounded({ ...two, step: 0.001 })).not.toBe(rounded(two));
  });
});

function count(text: string, limit: number) {
  return countWritingLines({
    charactersPerLine: WRITING_CHARACTERS_PER_LINE,
    limit,
    maxCharactersPerLine: WRITING_MAX_CHARACTERS_PER_LINE,
    text,
  });
}

describe(countWritingLines, () => {
  // CACD 2024 Portuguese essay, 69.5/70 on 70 handwritten lines, guide pp. 34–36:
  // https://guiasirbr.wordpress.com/wp-content/uploads/2025/06/guia_da_sarue_malabarista.pdf
  it("keeps a full 70-line answer that the board graded in full", () => {
    expect(count(cacd2024Essay, 70)).toStrictEqual({ estimatedLines: 55, ignoredFrom: null });
  });

  // CACD 2025 history Q4, 20/20 on 40 handwritten lines, the densest hand in the guides:
  // https://drive.google.com/file/d/1iyvblAfecpqH2SSnKNP1NzOc2vntNiWK/view
  it("grades in full an answer a dense hand fit, though a typical hand would run over", () => {
    const { estimatedLines, ignoredFrom } = count(cacd2025HistoryQ4, 40);

    expect(estimatedLines).toBeGreaterThan(40);
    expect(ignoredFrom).toBeNull();
  });

  it("stops reading where no published hand could fit the text", () => {
    const { ignoredFrom } = count(`${cacd2025HistoryQ4}\n${cacd2025HistoryQ4}`, 40);

    expect(ignoredFrom).toBeGreaterThan(cacd2025HistoryQ4.length);
    expect(ignoredFrom).toBeLessThan(cacd2025HistoryQ4.length * 2);
  });

  it.each([55, 70])("reads a task saved at %i characters a line at today's widths", (width) => {
    expect(readWritingPrompt({ ...basis, charactersPerLine: width })).toMatchObject({
      charactersPerLine: WRITING_CHARACTERS_PER_LINE,
      maxCharactersPerLine: WRITING_MAX_CHARACTERS_PER_LINE,
    });
  });

  it("grades a dense answer in full whatever width its task was saved with", async () => {
    mockEvidence();
    const writing = writtenItemSchema.parse({ ...basis, charactersPerLine: 55, lines: 40 });

    const grade = await gradeWriting({
      content: { ...content, writing },
      language: "pt",
      previousNextSteps: [],
      text: cacd2025HistoryQ4,
    });

    expect(grade.ignoredFrom).toBeNull();
    expect(vi.mocked(gradeWritingEvidence).mock.lastCall?.[0].text).toBe(cacd2025HistoryQ4);
  });

  it.each(lineFixtures)(
    "counts lines and retains UTF-16 cutoff offsets for $text",
    ({ estimatedLines, ignoredFrom, ...input }) => {
      expect(countWritingLines(input)).toStrictEqual({ estimatedLines, ignoredFrom });
    },
  );
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

    const grade: WritingResult & { estimatedLines: number } = {
      criteria: [],
      errors: [],
      estimatedLines: 4,
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
