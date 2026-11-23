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
import lineFixtures from "./_test-utils/writing-lines.json";
import { loadEssayDrafts } from "./_utils/essay-drafts";
import { gradeWriting, recordEssayGrade } from "./_utils/grade-essay-answer";
import { getWritingAttemptId } from "./_utils/writing-attempt-id";
import {
  applyWritingArithmetic,
  buildWritingFeedback,
  createWritingQuoteLookup,
} from "./_utils/writing-feedback";
import { passedWritingEvaluations } from "./_utils/writing-rubric-evaluations";
import {
  getWritingRubricFingerprint,
  getWritingTaskBasis,
  matchesWritingTaskBasis,
} from "./_utils/writing-task-basis";
import { MAX_ESSAY_CHARACTERS, MAX_WRITING_MS, essaySubmissionInputSchema } from "./essay-contract";
import { getWritingAttempt } from "./get-writing-attempt";
import {
  type WritingConditions,
  type WritingResult,
  writtenAnswerSchema,
  writtenItemSchema,
} from "./writing-contract";
import { WRITING_CHARACTERS_PER_LINE, countWritingLines } from "./writing-lines";
import {
  type WritingArithmetic,
  getWritingArithmetic,
  isNumericWritingRubric,
} from "./writing-rubric-policy";

vi.mock(import("@zoonk/ai/tasks/grading/grade-essay"), async (importOriginal) => ({
  ...(await importOriginal()),
  gradeWritingEvidence: vi.fn(),
}));

vi.mock("./_utils/writing-rubric-evaluations", () => ({ passedWritingEvaluations: {} }));
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
    ignoredFrom = eligible.length,
  }: {
    context?: string | null;
    rubric?: typeof basis;
    text?: string;
    gate?: typeof arithmetic | null;
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
  it.each([null, arithmetic])(
    "uses the line limit when there is no higher-value instruction",
    (gate) => {
      const text = "A claim and its explanation.";

      const full: WritingEvidence = {
        ...evidence,
        aspects: [
          { aspectIndex: 0, criterionId: "claim", earned: true, quote: "A claim" },
          { aspectIndex: 1, criterionId: "claim", earned: true, quote: "its explanation" },
        ],
        criteria: [{ ...evidence.criteria[0]!, level: gate ? "strong" : "complete" }],
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

    expect(createWritingQuoteLookup(text)(quote)).toStrictEqual({
      end: prefix.length + written.length,
      start: prefix.length,
    });

    const result = assess(
      {
        ...evidence,
        aspects: [{ aspectIndex: 0, criterionId: "claim", earned: true, quote }],
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
    { quote: "existe uma interação", text: "existindo uma interação" },
    { quote: "haveram problemas", text: "houveram problemas" },
    { quote: "em areas rurais", text: "em áreas rurais" },
    { quote: "áreas rurais", text: "rurais áreas" },
  ])("rejects the unsupported passage $quote in $text", ({ quote, text }) => {
    const result = assess(
      {
        ...evidence,
        aspects: [{ aspectIndex: 0, criterionId: "claim", earned: true, quote }],
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
      nextStep: { kind: "zero", title: null },
      total: { high: 0, low: 0 },
      zeroKind: kind,
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
      content: { high: 840, low: 720 },
      deduction: { high: 0, low: 0 },
      kind: "points",
      max: 1000,
      rows: [
        { earned: 160, id: "c1", max: 200, range: { high: 200, low: 160 } },
        { earned: 40, id: "c2", max: 200, range: { high: 160, low: 40 } },
        { earned: 160, id: "c3", max: 200, range: { high: 200, low: 160 } },
        { earned: 160, id: "c4", max: 200, range: { high: 200, low: 160 } },
        { earned: 40, id: "c5", max: 200, range: { high: 80, low: 40 } },
      ],
      total: { high: 840, low: 720 },
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
        kind: "oab" as const,
        language: null,
        rounding: null,
      },
      points: max,
    };

    expect(getWritingArithmetic(rubric)).toBeNull();
    expect(assess(evidence, { gate: null, rubric })).toMatchObject({ kind: "levels" });

    expect(assess(evidence, { gate: { ...arithmetic, rounding: null }, rubric })).toMatchObject({
      decimals,
      deduction: { high: 0, low: 0 },
      kind: "points",
      max,
      rows: [{ decimals, earned, id: "claim", max }],
      total: { high: earned, low: earned },
    });
  });

  it("uses the active evaluated grader and withholds points after a provider fallback", async () => {
    const grader = getWritingGrader("points");

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
    const fingerprint = getWritingRubricFingerprint(writing);

    const input = {
      content: { ...content, writing },
      language: "en",
      previousNextSteps: [],
      text: original,
    };

    Object.assign(passedWritingEvaluations, {
      [fingerprint]: {
        arithmetic: { rounding: null, zeroRules: [] },
        corpus: "fixture",
        kind: "points",
        model: grader.model,
        promptRevision: grader.promptVersion,
      },
    });

    try {
      const provider = vi.mocked(gradeWritingEvidence, { partial: true });

      provider.mockResolvedValueOnce({ data: evidence, provenance });
      await expect(gradeWriting(input)).resolves.toMatchObject({ decimals: 2, kind: "points" });

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
      Reflect.deleteProperty(passedWritingEvaluations, fingerprint);
    }
  });

  it("reads a saved recommendation without requiring an instruction title", () => {
    const grade = assess(evidence, { gate: null, ignoredFrom: null });

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

const rounded = (passage: string) =>
  getWritingRubricFingerprint({
    ...basis,
    grading: {
      ...basis.grading,
      rounding: { citation: { passage, sourceId: "notice" }, text: "Scoring precision" },
    },
  });

describe(getWritingRubricFingerprint, () => {
  it("keeps cosmetic changes out of the rubric and task compatibility keys", () => {
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
    expect(getWritingRubricFingerprint(revised)).toBe(getWritingRubricFingerprint(basis));

    expect(getWritingRubricFingerprint({ ...revised, points: 10 })).not.toBe(
      getWritingRubricFingerprint(basis),
    );

    expect(getWritingArithmetic(revised)).toBeNull();
  });

  it("fingerprints the verified rounding rule independently of its wording", () => {
    expect(rounded("Round to two places.")).toBe(rounded("Rounded to 2 decimal places."));
    expect(rounded("Round down to 2 decimals.")).not.toBe(rounded("Round to 2 decimals."));
    expect(rounded("Round to 3 decimals.")).not.toBe(rounded("Round to 2 decimals."));
  });
});

describe(countWritingLines, () => {
  // CACD 2024 Portuguese essay, 69.5/70 on 70 handwritten lines, guide pp. 34–36:
  // https://guiasirbr.wordpress.com/wp-content/uploads/2025/06/guia_da_sarue_malabarista.pdf
  it("keeps a full 70-line answer that the board graded in full", () => {
    expect(
      countWritingLines({
        charactersPerLine: WRITING_CHARACTERS_PER_LINE,
        limit: 70,
        text: cacd2024Essay,
      }).ignoredFrom,
    ).toBeNull();

    expect(
      countWritingLines({ charactersPerLine: 55, limit: 70, text: cacd2024Essay }).ignoredFrom,
    ).toBeGreaterThan(0);
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
