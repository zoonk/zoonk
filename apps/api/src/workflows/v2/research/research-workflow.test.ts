import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { decideLibraryIdentity } from "@zoonk/ai/tasks/v2/identity/decision";
import { generateSearchTerms } from "@zoonk/ai/tasks/v2/identity/search-terms";
import { detectChangingFacts } from "@zoonk/ai/tasks/v2/research/changing-facts";
import { checkCitedFacts } from "@zoonk/ai/tasks/v2/research/check-cited-facts";
import { decideExamIdentity } from "@zoonk/ai/tasks/v2/research/exam-identity-decision";
import {
  type BlueprintExtraction,
  extractExamBlueprint,
} from "@zoonk/ai/tasks/v2/research/extract-exam-blueprint";
import { EXAM_BLUEPRINT_PROMPT_VERSION } from "@zoonk/ai/tasks/v2/research/extract-exam-blueprint-version";
import { extractQuestionFormats } from "@zoonk/ai/tasks/v2/research/extract-question-formats";
import { findChoiceOptions } from "@zoonk/ai/tasks/v2/research/find-choice-options";
import { findOfficialSources } from "@zoonk/ai/tasks/v2/research/find-official-sources";
import { findSubjectQuestions } from "@zoonk/ai/tasks/v2/research/find-subject-questions";
import { findTargetCutoff } from "@zoonk/ai/tasks/v2/research/find-target-cutoff";
import { findTopicFrequency } from "@zoonk/ai/tasks/v2/research/find-topic-frequency";
import { type ResearchPlan, generateResearchPlan } from "@zoonk/ai/tasks/v2/research/plan";
import { generateSourceChangeNotice } from "@zoonk/ai/tasks/v2/research/source-change-notice";
import { examStructureSchema } from "@zoonk/core/library/exams/blueprint-contract";
import { buildExamIdentityKey } from "@zoonk/core/library/exams/identity";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  examBlueprintFixture,
  learnerSourceFixture,
  sourceFixture,
} from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sleep } from "workflow";
import { getRun, start } from "workflow/api";
import { mockHookConflict } from "../../../../mocks/workflow";
import { mockLastRunEvent } from "../../../../mocks/workflow-runtime";
import { goalContentWorkflow } from "../goals/goal-content-workflow";
import { researchWorkflow } from "./research-workflow";

vi.mock("workflow/api", () => ({
  getRun: vi.fn(),
  start: vi.fn(() => Promise.resolve({ runId: "started-run" })),
}));

/** The run holding a token, as a joining run reads it: how it ended, or that it's still going. */
function otherRun(status: "completed" | "failed" | "running") {
  const cancel = vi.fn(() => Promise.resolve());

  vi.mocked(getRun).mockReturnValue({
    cancel,
    exists: Promise.resolve(true),
    status: Promise.resolve(status),
  } as unknown as ReturnType<typeof getRun>);

  return { cancel };
}

// Model and search calls are external: tests replay what they returned for the real TCDF 2026 notice.
vi.mock("@zoonk/ai/tasks/v2/research/changing-facts", () => ({ detectChangingFacts: vi.fn() }));
vi.mock("@zoonk/ai/tasks/v2/research/plan", () => ({ generateResearchPlan: vi.fn() }));

vi.mock("@zoonk/ai/tasks/v2/research/find-official-sources", () => ({
  findOfficialSources: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/v2/research/extract-exam-blueprint", () => ({
  extractExamBlueprint: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/v2/research/check-cited-facts", () => ({ checkCitedFacts: vi.fn() }));

// The first pass over a new notice reads its question formats only; each test says what it read.
vi.mock("@zoonk/ai/tasks/v2/research/extract-question-formats", () => ({
  extractQuestionFormats: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/v2/research/find-subject-questions", () => ({
  findSubjectQuestions: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/v2/research/find-choice-options", () => ({ findChoiceOptions: vi.fn() }));

vi.mock("@zoonk/ai/tasks/v2/research/find-target-cutoff", () => ({ findTargetCutoff: vi.fn() }));

vi.mock("@zoonk/ai/tasks/v2/research/find-topic-frequency", () => ({
  findTopicFrequency: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/v2/research/source-change-notice", () => ({
  generateSourceChangeNotice: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/v2/research/exam-identity-decision", () => ({
  decideExamIdentity: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/v2/identity/decision", () => ({
  LIBRARY_IDENTITY_MIN_PROBABILITY: 0.6,
  decideLibraryIdentity: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/v2/identity/search-terms", () => ({ generateSearchTerms: vi.fn() }));

const PROVENANCE = {
  costUsd: 0,
  generatedAt: "2026-09-26T12:00:00.000Z",
  latencyMs: 1,
  model: "google/gemini-3.8-flash",
  promptVersion: "v1",
  provider: "google",
  requestedModel: "google/gemini-3.8-flash",
  runId: "recorded",
  usage: {},
};

const TASK_RESULT = {
  provenance: PROVENANCE,
  systemPrompt: "",
  usage: {} as never,
  userPrompt: "",
};

type RecordedSearch = Awaited<ReturnType<typeof findOfficialSources>>["data"];

async function readFixture(name: string) {
  return readFile(new URL(`_test-fixtures/${name}`, import.meta.url), "utf8");
}

async function readJsonFixture<T>(name: string): Promise<T> {
  return JSON.parse(await readFixture(name)) as T;
}

/**
 * Replays the recorded plan, search and extraction for TCDF 2026. The exam's
 * name gets a unique suffix so tests sharing the database never share a
 * blueprint, and the search's addresses are made unique for the same reason.
 */
async function replayTcdfResearch() {
  const [plan, search, extraction, notice] = await Promise.all([
    readJsonFixture<ResearchPlan>("tcdf-2026-plan.json"),
    readJsonFixture<RecordedSearch>("tcdf-2026-search.json"),
    readJsonFixture<BlueprintExtraction>("tcdf-2026-extraction.json"),
    readFixture("tcdf-2026-notice.txt"),
  ]);

  const suffix = randomUUID();
  const uniquePlan = { ...plan, name: `${plan.name} ${suffix}` };

  const documents = search.documents.map((document) => ({
    ...document,
    url: `${document.url}?test=${suffix}`,
  }));

  vi.mocked(generateResearchPlan).mockResolvedValue({ ...TASK_RESULT, data: uniquePlan });

  vi.mocked(findOfficialSources).mockResolvedValue({
    ...TASK_RESULT,
    data: { ...search, documents },
  });

  vi.mocked(extractExamBlueprint).mockResolvedValue({ ...TASK_RESULT, data: extraction });

  // The first pass finds the notice's formats, and one the notice doesn't state.
  vi.mocked(extractQuestionFormats).mockResolvedValue({
    ...TASK_RESULT,
    data: [
      ...extraction.formats,
      {
        description: "Questões de múltipla escolha.",
        document: 1,
        kind: "multipleChoice",
        options: 5,
        passage: "As questões terão cinco alternativas.",
      },
    ],
  });

  // The notice PDF is served as its recorded text; the other pages as pages built with
  // JavaScript, which store no more than a line.
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      Promise.resolve(
        url.includes("132841120D")
          ? new Response(notice, { headers: { "content-type": "text/plain" } })
          : new Response(`<p>${url}</p>`, { headers: { "content-type": "text/html" } }),
      ),
    ),
  );

  return { extraction, plan: uniquePlan };
}

/** A recorded date ten years on, so a test's exam days stay ahead. */
function inTenYears(date: string): string {
  return date.replace("2026", "2036").replace("2027", "2037");
}

function supportAll() {
  vi.mocked(checkCitedFacts).mockImplementation(async ({ facts }) => ({
    ...TASK_RESULT,
    data: { supportedIds: facts.map((fact) => fact.id) },
  }));
}

/** Search finds only a blog's summary of the notice: nothing research can read the exam from. */
function findNothingOfficial() {
  vi.mocked(findOfficialSources).mockResolvedValue({
    ...TASK_RESULT,
    data: {
      documents: [
        {
          documentType: "other",
          kind: "secondary",
          publisher: "Blog",
          reason: "A summary",
          title: "Resumo do edital",
          url: `https://blog.example.com/${randomUUID()}`,
        },
      ],
      officialFound: false,
      searchCalls: 2,
    },
  });
}

async function examGoal() {
  const user = await userFixture();

  const goal = await goalFixture({
    kind: "exam",
    prompt: "passar no concurso do TCDF 2026",
    userId: user.id,
  });

  return { goal, user };
}

describe(researchWorkflow, () => {
  beforeEach(() => {
    supportAll();
    vi.mocked(decideExamIdentity).mockResolvedValue(null);

    // No stored copy of the notice exists under another address: every document is fetched.
    vi.mocked(generateSearchTerms).mockImplementation(
      async ({ subjects }) =>
        ({
          ...TASK_RESULT,
          data: { subjects: subjects.map(() => ({ terms: [`zq${randomUUID().slice(0, 8)}`] })) },
        }) as never,
    );

    vi.mocked(decideLibraryIdentity).mockResolvedValue({ match: null, verdicts: [] });

    // No source gives the subjects' counts or the options unless a test says one does.
    vi.mocked(findSubjectQuestions).mockResolvedValue({
      ...TASK_RESULT,
      data: { edition: null, questions: [], source: null, status: "unknown" },
    });

    vi.mocked(findChoiceOptions).mockResolvedValue({
      ...TASK_RESULT,
      data: { edition: null, options: null, source: null, status: "unknown" },
    });

    vi.mocked(findTopicFrequency).mockResolvedValue({ ...TASK_RESULT, data: { subjects: [] } });

    vi.mocked(findTargetCutoff).mockResolvedValue({
      ...TASK_RESULT,
      data: { edition: null, quota: null, score: null, source: null, status: "unknown" },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // A test that says how another run stands leaves the next one the default.
    vi.mocked(getRun).mockReset();
  });

  it("does nothing for a goal that doesn't depend on changing facts", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ prompt: "calculus from scratch", userId: user.id });
    vi.mocked(detectChangingFacts).mockResolvedValue("none");

    await expect(researchWorkflow({ goalId: goal.id })).resolves.toStrictEqual({
      status: "notNeeded",
    });

    expect(generateResearchPlan).not.toHaveBeenCalled();
  });

  it("builds the blueprint from official sources, keeps every fact's passage and links the goal", async () => {
    const { goal } = await examGoal();
    const { extraction, plan } = await replayTcdfResearch();

    const result = await researchWorkflow({ goalId: goal.id });

    expect(result).toMatchObject({ sourceIds: [], status: "ready" });
    expect(detectChangingFacts).not.toHaveBeenCalled();

    const blueprint = await prisma.examBlueprint.findUniqueOrThrow({
      include: { source: true },
      where: {
        languageIdentity: {
          identityKey: buildExamIdentityKey({ name: plan.name, ownerId: null, role: plan.role }),
          language: "pt",
        },
      },
    });

    expect(result).toMatchObject({ examBlueprintId: blueprint.id });

    // A learner's plan waits on reading a published notice every learner of the exam reuses, so
    // it and its check run at the priority tier; the check reads its claims in batches at once.
    expect(vi.mocked(extractExamBlueprint).mock.calls[0]?.[0].serviceTier).toBe("priority");

    const checkCalls = vi.mocked(checkCitedFacts).mock.calls.map(([input]) => input);
    const checkedBatches = checkCalls.map((input) => input.facts);

    expect(checkCalls.every((input) => input.serviceTier === "priority")).toBe(true);
    expect(checkedBatches.length).toBeGreaterThan(1);
    expect(checkedBatches.every((facts) => facts.length <= 16)).toBe(true);

    expect(blueprint.examDate).toStrictEqual(new Date("2026-11-22T00:00:00.000Z"));
    expect(blueprint.registrationEndsAt).toStrictEqual(new Date("2026-09-17T00:00:00.000Z"));
    expect(blueprint.source).toMatchObject({ kind: "official", publisher: "Cebraspe" });
    expect(blueprint.source?.reusePolicy).toMatchObject({ pastQuestions: "allowedWithCitation" });

    const structure = examStructureSchema.parse(blueprint.structure);

    expect(structure.subjects).toHaveLength(extraction.subjects.length);
    expect(structure.formats.map((format) => format.kind)).toStrictEqual(["trueFalse", "essay"]);

    expect(structure.subjects[0]?.citation.passage).toBe(
      extraction.subjects[0]?.passages[0]?.passage,
    );

    expect(structure.subjects[0]?.topics).toStrictEqual(extraction.subjects[0]?.topics);

    // A first pass read its formats beside the reading, for placement's first questions: only
    // the ones whose passage is in the notice.
    expect(vi.mocked(extractQuestionFormats).mock.calls[0]?.[0]).toMatchObject({
      exam: `${plan.name}, ${plan.role}`,
      serviceTier: "priority",
    });

    const linked = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });

    expect(linked).toMatchObject({
      details: {
        noticeFormats: [
          { citation: { sourceId: blueprint.sourceId }, kind: "trueFalse" },
          { kind: "essay" },
        ],
      },
      examBlueprintId: blueprint.id,
    });

    // The notice is checked from the next daily sweep on.
    expect(blueprint.nextCheckAt).not.toBeNull();
  });

  it("looks up how many questions each subject got in the latest edition when the notice names none", async () => {
    const { goal } = await examGoal();
    const { extraction } = await replayTcdfResearch();
    const counts = extraction.subjects.map((_, index) => index + 1);

    vi.mocked(findSubjectQuestions).mockResolvedValue({
      ...TASK_RESULT,
      data: {
        edition: "TCDF 2023",
        questions: counts,
        source: { title: "Distribuição de itens", url: "https://example.com/tcdf" },
        status: "found",
      },
    });

    const result = await researchWorkflow({ goalId: goal.id });
    const examBlueprintId = result.status === "ready" ? result.examBlueprintId : null;

    expect(vi.mocked(findSubjectQuestions).mock.calls[0]?.[0]).toMatchObject({
      subjects: extraction.subjects.map((subject) => subject.name),
    });

    const blueprint = await prisma.examBlueprint.findUniqueOrThrow({
      where: { id: examBlueprintId ?? "" },
    });

    expect(examStructureSchema.parse(blueprint.structure).pastQuestions).toMatchObject({
      edition: "TCDF 2023",
      subjects: extraction.subjects.map((subject, index) => ({
        name: subject.name,
        questions: counts[index],
      })),
    });
  });

  it("looks up how often the past papers asked the topics of the subjects nothing rates", async () => {
    const { goal } = await examGoal();
    const { extraction } = await replayTcdfResearch();
    const [portuguese] = extraction.subjects;

    vi.mocked(findTopicFrequency).mockImplementation(async ({ subjects }) => ({
      ...TASK_RESULT,
      data: {
        subjects: subjects
          .filter((subject) => subject.name === portuguese?.name)
          .map((subject) => ({
            basis: "questões de 2019 a 2025",
            name: subject.name,
            source: { title: "Assuntos que mais caem", url: "https://example.com/cebraspe" },
            topics: [{ appearances: 12, level: "high" as const, topic: subject.topics[0] ?? "" }],
          })),
      },
    }));

    const result = await researchWorkflow({ goalId: goal.id });
    const examBlueprintId = result.status === "ready" ? result.examBlueprintId : null;

    const asked = vi
      .mocked(findTopicFrequency)
      .mock.calls.map(([input]) => input.subjects.map((subject) => subject.name));

    // Each subject with several topics is looked up on its own: the others aren't worth ranking.
    expect(asked).toStrictEqual(
      extraction.subjects
        .filter((subject) => subject.topics.length >= 4)
        .map((subject) => [subject.name]),
    );

    const blueprint = await prisma.examBlueprint.findUniqueOrThrow({
      where: { id: examBlueprintId ?? "" },
    });

    expect(examStructureSchema.parse(blueprint.structure).pastTopicFrequency).toMatchObject({
      subjects: [
        { name: portuguese?.name, topics: [{ level: "high", topic: portuguese?.topics[0] }] },
      ],
    });
  });

  it("reads the notice when official pages that store no text come before it", async () => {
    const { goal } = await examGoal();
    const { plan } = await replayTcdfResearch();
    const recorded = await readJsonFixture<RecordedSearch>("tcdf-2026-search.json");
    const suffix = randomUUID();

    const scriptPages = Array.from({ length: 4 }, (_, index) => ({
      documentType: "officialPage" as const,
      kind: "official" as const,
      publisher: "Cebraspe",
      reason: "The exam's page",
      title: `Concurso TCDF ${index}`,
      url: `https://www.cebraspe.org.br/concursos/tc_df_26_${index}?test=${suffix}`,
    }));

    const notice = recorded.documents.map((document) => ({
      ...document,
      url: `${document.url}?test=${suffix}`,
    }));

    vi.mocked(findOfficialSources).mockResolvedValue({
      ...TASK_RESULT,
      data: { ...recorded, documents: [...scriptPages, ...notice] },
    });

    const result = await researchWorkflow({ goalId: goal.id });

    expect(result).toMatchObject({ examBlueprintId: expect.any(String), status: "ready" });

    // Only documents a model can read were read, the notice first, whose hash the blueprint keeps.
    const [reading] = vi.mocked(extractExamBlueprint).mock.calls.map(([input]) => input);
    const texts = reading?.documents.map((document) => document.text?.length ?? 0) ?? [];

    expect(texts.length).toBeGreaterThan(0);
    expect(texts.every((length) => length >= 200)).toBe(true);

    const blueprint = await prisma.examBlueprint.findUniqueOrThrow({
      include: { source: true },
      where: {
        languageIdentity: {
          identityKey: buildExamIdentityKey({ name: plan.name, ownerId: null, role: plan.role }),
          language: "pt",
        },
      },
    });

    expect(blueprint.source?.url).toContain("132841120D");
  });

  it("reuses a current blueprint without searching again", async () => {
    const { goal } = await examGoal();
    const { plan } = await replayTcdfResearch();

    const blueprint = await examBlueprintFixture({
      examDate: new Date(Date.now() + 30 * 86_400_000),
      identityKey: buildExamIdentityKey({ name: plan.name, ownerId: null, role: plan.role }),
      language: "pt",
      name: plan.name,
      promptVersion: EXAM_BLUEPRINT_PROMPT_VERSION,
      role: plan.role,
    });

    await expect(researchWorkflow({ goalId: goal.id })).resolves.toStrictEqual({
      examBlueprintId: blueprint.id,
      sourceIds: [],
      status: "ready",
    });

    expect(findOfficialSources).not.toHaveBeenCalled();
    expect(extractExamBlueprint).not.toHaveBeenCalled();
  });

  it("looks up the position's last cut-off once a year for everyone aiming at it", async () => {
    const [first, second] = await Promise.all([examGoal(), examGoal()]);
    const { plan } = await replayTcdfResearch();

    // Both learners named the position, each in their own words.
    await prisma.goal.updateMany({
      data: { details: { targetPosition: "auditor de controle externo" } },
      where: { id: { in: [first.goal.id, second.goal.id] } },
    });

    const blueprint = await examBlueprintFixture({
      examDate: new Date(Date.now() + 30 * 86_400_000),
      identityKey: buildExamIdentityKey({ name: plan.name, ownerId: null, role: plan.role }),
      language: "pt",
      name: plan.name,
      promptVersion: EXAM_BLUEPRINT_PROMPT_VERSION,
      role: plan.role,
    });

    const source = { title: "Resultado final", url: `https://www.cebraspe.org.br/${randomUUID()}` };

    vi.mocked(findTargetCutoff).mockResolvedValue({
      ...TASK_RESULT,
      data: {
        edition: "TCDF 2021",
        quota: "ampla concorrência",
        score: 78.5,
        source,
        status: "found",
      },
    });

    await researchWorkflow({ goalId: first.goal.id });
    await researchWorkflow({ goalId: second.goal.id });

    expect(findTargetCutoff).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ course: null, position: plan.role }),
    );

    await expect(
      prisma.targetCutoff.findMany({ where: { examBlueprintId: blueprint.id } }),
    ).resolves.toMatchObject([
      { edition: "TCDF 2021", score: 78.5, sourceUrl: source.url, status: "found" },
    ]);
  });

  it("looks up how many options the questions have when the notice says only that they're multiple choice", async () => {
    const { goal } = await examGoal();
    const { plan } = await replayTcdfResearch();
    const citation = { passage: "180 questões objetivas", sourceId: "notice" };

    const blueprint = await examBlueprintFixture({
      examDate: new Date(Date.now() + 30 * 86_400_000),
      identityKey: buildExamIdentityKey({ name: plan.name, ownerId: null, role: plan.role }),
      language: "pt",
      name: plan.name,
      promptVersion: EXAM_BLUEPRINT_PROMPT_VERSION,
      role: plan.role,
      structure: {
        formats: [{ citation, description: "Objetivas", kind: "multipleChoice", options: null }],
        mock: null,
        rules: [],
        subjects: [],
      },
    });

    vi.mocked(findChoiceOptions).mockResolvedValue({
      ...TASK_RESULT,
      data: {
        edition: "2025",
        options: 5,
        source: { title: "Provas anteriores", url: "https://example.com/provas" },
        status: "found",
      },
    });

    await researchWorkflow({ goalId: goal.id });

    const stored = await prisma.examBlueprint.findUniqueOrThrow({ where: { id: blueprint.id } });

    expect(examStructureSchema.parse(stored.structure).pastOptions).toMatchObject({
      options: 5,
      source: { url: "https://example.com/provas" },
    });

    // Found once: the next learner's research doesn't look it up again.
    const next = await examGoal();
    await researchWorkflow({ goalId: next.goal.id });
    expect(findChoiceOptions).toHaveBeenCalledOnce();
  });

  it("reads a current notice again when older instructions read it, so it gains what they missed", async () => {
    const { goal } = await examGoal();
    const { plan } = await replayTcdfResearch();

    const blueprint = await examBlueprintFixture({
      examDate: new Date(Date.now() + 30 * 86_400_000),
      identityKey: buildExamIdentityKey({ name: plan.name, ownerId: null, role: plan.role }),
      language: "pt",
      name: plan.name,
      promptVersion: "older-instructions",
      role: plan.role,
    });

    vi.mocked(generateSourceChangeNotice).mockResolvedValue({
      ...TASK_RESULT,
      data: { message: "O edital foi lido de novo." },
    });

    await expect(researchWorkflow({ goalId: goal.id })).resolves.toMatchObject({
      examBlueprintId: blueprint.id,
      status: "ready",
    });

    expect(extractExamBlueprint).toHaveBeenCalledOnce();

    const stored = await prisma.examBlueprint.findUniqueOrThrow({ where: { id: blueprint.id } });
    expect(examStructureSchema.parse(stored.structure).subjects.length).toBeGreaterThan(0);

    // The exam didn't change, only how well it's read: learners get no "the notice changed".
    expect(generateSourceChangeNotice).not.toHaveBeenCalled();

    await expect(
      prisma.sourceChangeNotice.count({ where: { examBlueprintId: blueprint.id } }),
    ).resolves.toBe(0);
  });

  it("tells the exam's other learners nothing when newer instructions read the same exam day", async () => {
    const { goal } = await examGoal();
    const { extraction, plan } = await replayTcdfResearch();

    // The newer reading finds the notice's registration and result days around the same exam day.
    vi.mocked(extractExamBlueprint).mockResolvedValue({
      ...TASK_RESULT,
      data: {
        ...extraction,
        dates: extraction.dates.map((date) => ({ ...date, date: inTenYears(date.date) })),
      },
    });

    // Older instructions read the exam's day and nothing else of the schedule.
    const blueprint = await examBlueprintFixture({
      edition: {
        citations: [],
        dates: [
          {
            citation: { passage: "Aplicação das provas 22/11", sourceId: "older" },
            date: "2036-11-22",
            kind: "exam",
            label: "Aplicação das provas",
          },
        ],
        noticeUrl: null,
        questionCount: null,
        sourceHash: null,
        year: 2036,
      },
      examDate: new Date(Date.now() + 30 * 86_400_000),
      identityKey: buildExamIdentityKey({ name: plan.name, ownerId: null, role: plan.role }),
      language: "pt",
      name: plan.name,
      promptVersion: "older-instructions",
      role: plan.role,
    });

    // Another learner prepares for the same exam with a date of their own.
    const [other, skill] = await Promise.all([userFixture(), skillFixture()]);

    const otherGoal = await goalFixture({
      examBlueprintId: blueprint.id,
      kind: "exam",
      targetDate: new Date("2036-11-29T00:00:00.000Z"),
      userId: other.id,
    });

    await planFixture({
      goalId: otherGoal.id,
      graph: {
        phases: [{ milestone: null, name: "Basics" }],
        skills: [{ lessons: 2, name: skill.name, phase: 0, skillId: skill.id }],
      },
      phases: [],
    });

    await researchWorkflow({ goalId: goal.id });

    expect(extractExamBlueprint).toHaveBeenCalledOnce();
    expect(generateSourceChangeNotice).not.toHaveBeenCalled();

    // The exam's day didn't move: nothing reaches the other learner's Today.
    await expect(
      prisma.planChange.count({ where: { plan: { goalId: otherGoal.id } } }),
    ).resolves.toBe(0);
  });

  it("joins another learner's research for the same exam instead of paying twice", async () => {
    const { goal } = await examGoal();
    await replayTcdfResearch();
    const blueprint = await examBlueprintFixture();
    otherRun("completed");

    mockHookConflict(
      {
        returnValue: Promise.resolve({
          examBlueprintId: blueprint.id,
          sourceIds: [],
          status: "ready",
        }),
        runId: "other-learner",
      },
      { tokens: /^research:/u },
    );

    await expect(researchWorkflow({ goalId: goal.id })).resolves.toMatchObject({
      examBlueprintId: blueprint.id,
    });

    expect(findOfficialSources).not.toHaveBeenCalled();

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      examBlueprintId: blueprint.id,
    });
  });

  it("follows the goal's research already running instead of paying for it again", async () => {
    const { goal } = await examGoal();
    const result = { reason: "noOfficialSource", status: "needsUpload" } as const;
    otherRun("completed");

    mockHookConflict(
      { returnValue: Promise.resolve(result), runId: "first-request" },
      { tokens: new RegExp(`^research-goal:${goal.id}$`, "u") },
    );

    await expect(researchWorkflow({ goalId: goal.id })).resolves.toStrictEqual(result);
    expect(generateResearchPlan).not.toHaveBeenCalled();
    expect(findOfficialSources).not.toHaveBeenCalled();
  });

  it("researches the exam itself when the run it joined fails, instead of failing with it", async () => {
    const { goal } = await examGoal();
    await replayTcdfResearch();
    otherRun("failed");

    // Its result is never read: the run reads how it ended first.
    mockHookConflict(
      { returnValue: new Promise(() => {}), runId: "other-learner" },
      { tokens: /^research:/u },
    );

    await expect(researchWorkflow({ goalId: goal.id })).resolves.toMatchObject({ status: "ready" });

    expect(findOfficialSources).toHaveBeenCalledOnce();
  });

  it("researches the goal itself when its earlier run stalled, and stops that run", async () => {
    const { goal } = await examGoal();
    await replayTcdfResearch();
    const { cancel } = otherRun("running");

    // A server restart lost the earlier run in the middle of a step, an hour ago.
    mockLastRunEvent("first-request", {
      createdAt: new Date(Date.now() - 60 * 60 * 1000),
      eventType: "step_started",
    });

    mockHookConflict(
      { returnValue: new Promise(() => {}), runId: "first-request" },
      { tokens: new RegExp(`^research-goal:${goal.id}$`, "u") },
    );

    await expect(researchWorkflow({ goalId: goal.id })).resolves.toMatchObject({ status: "ready" });

    expect(cancel).toHaveBeenCalledWith({ cancelReason: expect.any(String) });
  });

  it("remembers its run on the goal, so asking again follows it", async () => {
    const { goal } = await examGoal();
    await replayTcdfResearch();
    findNothingOfficial();

    await researchWorkflow({ goalId: goal.id });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      researchRunId: expect.any(String),
    });
  });

  it("asks for the notice instead of guessing when search finds nothing official", async () => {
    const { goal } = await examGoal();
    await replayTcdfResearch();

    findNothingOfficial();

    await expect(researchWorkflow({ goalId: goal.id })).resolves.toStrictEqual({
      reason: "noOfficialSource",
      status: "needsUpload",
    });

    expect(extractExamBlueprint).not.toHaveBeenCalled();

    // The ask stays on the goal, so Plan and Today show it until the learner answers.
    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      examBlueprintId: null,
      researchUploadReason: "noOfficialSource",
    });
  });

  it("keeps studying from the last edition's blueprint while the new notice isn't online", async () => {
    const { goal } = await examGoal();
    const { plan } = await replayTcdfResearch();

    const lastEdition = await examBlueprintFixture({
      examDate: new Date(Date.now() - 30 * 86_400_000),
      identityKey: buildExamIdentityKey({ name: plan.name, ownerId: null, role: plan.role }),
      language: "pt",
      name: plan.name,
      role: plan.role,
    });

    findNothingOfficial();

    await expect(researchWorkflow({ goalId: goal.id })).resolves.toStrictEqual({
      examBlueprintId: lastEdition.id,
      sourceIds: [],
      status: "ready",
    });

    // The exam passed, so research looked for a new notice before settling for the last one.
    expect(findOfficialSources).toHaveBeenCalledOnce();

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      examBlueprintId: lastEdition.id,
      researchUploadReason: null,
    });
  });

  it("reads a passed edition's notice again without telling its learners about that old edition", async () => {
    const { goal } = await examGoal();
    const { extraction, plan } = await replayTcdfResearch();

    const lastEdition = await examBlueprintFixture({
      examDate: new Date(Date.now() - 300 * 86_400_000),
      identityKey: buildExamIdentityKey({ name: plan.name, ownerId: null, role: plan.role }),
      language: "pt",
      name: plan.name,
      role: plan.role,
    });

    // The only notice online is the one of the edition that already happened.
    vi.mocked(extractExamBlueprint).mockResolvedValue({
      ...TASK_RESULT,
      data: {
        ...extraction,
        dates: extraction.dates.map((date) => ({
          ...date,
          date: date.date.replace("2026", "2024"),
        })),
      },
    });

    await expect(researchWorkflow({ goalId: goal.id })).resolves.toMatchObject({
      examBlueprintId: lastEdition.id,
      status: "ready",
    });

    expect(extractExamBlueprint).toHaveBeenCalledOnce();
    expect(generateSourceChangeNotice).not.toHaveBeenCalled();

    await expect(
      prisma.sourceChangeNotice.count({ where: { examBlueprintId: lastEdition.id } }),
    ).resolves.toBe(0);
  });

  it("keeps the exam's subjects and scoring when the check rejects every detail their passages don't state", async () => {
    const { goal } = await examGoal();
    const { extraction, plan } = await replayTcdfResearch();

    // Like the real check on this notice: a subject's passage names it, but its questions,
    // weight or a description written by the model may come from elsewhere or say more.
    vi.mocked(checkCitedFacts).mockImplementation(async ({ facts }) => ({
      ...TASK_RESULT,
      data: {
        supportedIds: facts
          .map((fact) => fact.id)
          .filter((id) => !/\.(?:day|description|minutes|questions|weight)$/u.test(id)),
      },
    }));

    await expect(researchWorkflow({ goalId: goal.id })).resolves.toMatchObject({ status: "ready" });

    const blueprint = await prisma.examBlueprint.findUniqueOrThrow({
      where: {
        languageIdentity: {
          identityKey: buildExamIdentityKey({ name: plan.name, ownerId: null, role: plan.role }),
          language: "pt",
        },
      },
    });

    const structure = examStructureSchema.parse(blueprint.structure);

    expect(structure.subjects.map((subject) => subject.name)).toStrictEqual(
      extraction.subjects.map((subject) => subject.name),
    );

    // Topics are checked by code: the one the model merged from two items isn't in the notice.
    expect(structure.subjects.flatMap((subject) => subject.topics)).not.toContain(
      "Lei de Acesso à Informação e LGPD",
    );

    expect(structure.formats.map((format) => format.kind)).toStrictEqual(["trueFalse", "essay"]);
    expect(structure.mock?.scoring).toStrictEqual({ description: "", method: "wrongCancelsRight" });
  });

  it("asks for the notice when no fact survives the citation check", async () => {
    const { goal } = await examGoal();
    await replayTcdfResearch();
    vi.mocked(checkCitedFacts).mockResolvedValue({ ...TASK_RESULT, data: { supportedIds: [] } });

    await expect(researchWorkflow({ goalId: goal.id })).resolves.toStrictEqual({
      reason: "unverified",
      status: "needsUpload",
    });

    expect(start).not.toHaveBeenCalled();

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      researchUploadReason: "unverified",
    });
  });

  it("answers the ask with the learner's upload and rebuilds the goal's curriculum from it", async () => {
    const { goal, user } = await examGoal();
    await replayTcdfResearch();
    const notice = await readFixture("tcdf-2026-notice.txt");
    const contentHash = `hash-${randomUUID()}`;

    await prisma.goal.update({
      data: { researchUploadReason: "noOfficialSource" },
      where: { id: goal.id },
    });

    const upload = await sourceFixture({
      contentHash,
      extractedText: notice,
      identityKey: `private:${user.id}:upload:${contentHash}`,
      kind: "upload",
      language: "pt",
      mimeType: "text/plain",
      ownerId: user.id,
      url: null,
      visibility: "private",
    });

    const result = await researchWorkflow({ goalId: goal.id, sourceIds: [upload.id] });

    expect(result).toMatchObject({ status: "ready" });
    expect(findOfficialSources).not.toHaveBeenCalled();
    expect(start).toHaveBeenCalledWith(goalContentWorkflow, [{ goalId: goal.id, rebuild: true }]);

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      examBlueprintId: expect.any(String),
      researchUploadReason: null,
    });
  });

  it("never searches the web or shares a blueprint for a teacher's test", async () => {
    const { goal } = await examGoal();
    const { plan } = await replayTcdfResearch();

    // Onboarding matched the test's name ("Prova de biologia") to a public notice of that name.
    const notice = await examBlueprintFixture({ language: "pt", name: "Prova de Biologia" });

    await prisma.goal.update({ data: { examBlueprintId: notice.id }, where: { id: goal.id } });

    vi.mocked(generateResearchPlan).mockResolvedValue({
      ...TASK_RESULT,
      data: { ...plan, classTest: true },
    });

    await expect(researchWorkflow({ goalId: goal.id })).resolves.toStrictEqual({
      reason: "classMaterial",
      status: "needsUpload",
    });

    expect(findOfficialSources).not.toHaveBeenCalled();
    expect(extractExamBlueprint).not.toHaveBeenCalled();

    // Plan and Today ask for the class's material instead of following a public notice.
    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      examBlueprintId: null,
      researchUploadReason: "classMaterial",
    });
  });

  it("never builds a shared notice from a curriculum that only lists what to study", async () => {
    const { goal } = await examGoal();
    const { extraction, plan } = await replayTcdfResearch();

    // What the BNCC gives for a school subject: subjects and topics, nothing about an exam.
    vi.mocked(extractExamBlueprint).mockResolvedValue({
      ...TASK_RESULT,
      data: {
        ...extraction,
        dates: [],
        edition: { ...extraction.edition, questionCount: null },
        formats: [],
        mock: null,
        rules: [],
        subjects: extraction.subjects.map((subject) => ({
          ...subject,
          questions: null,
          weight: null,
        })),
      },
    });

    await expect(researchWorkflow({ goalId: goal.id })).resolves.toStrictEqual({
      reason: "unverified",
      status: "needsUpload",
    });

    await expect(
      prisma.examBlueprint.findUnique({
        where: {
          languageIdentity: {
            identityKey: buildExamIdentityKey({ name: plan.name, ownerId: null, role: plan.role }),
            language: "pt",
          },
        },
      }),
    ).resolves.toBeNull();
  });

  it("reads the material a learner gave at onboarding instead of asking for it again", async () => {
    const { goal, user } = await examGoal();
    const { plan } = await replayTcdfResearch();
    const material = await readFixture("tcdf-2026-notice.txt");
    const contentHash = `hash-${randomUUID()}`;

    vi.mocked(generateResearchPlan).mockResolvedValue({
      ...TASK_RESULT,
      data: { ...plan, classTest: true },
    });

    const notes = await sourceFixture({
      contentHash,
      extractedText: material,
      identityKey: `private:${user.id}:upload:${contentHash}`,
      kind: "upload",
      language: "pt",
      mimeType: "text/plain",
      ownerId: user.id,
      url: null,
      visibility: "private",
    });

    await learnerSourceFixture({ goalId: goal.id, sourceId: notes.id, userId: user.id });

    // The web app starts research with no upload to answer: an empty list, not a missing one.
    const result = await researchWorkflow({ goalId: goal.id, sourceIds: [] });

    expect(result).toMatchObject({ status: "ready" });
    expect(findOfficialSources).not.toHaveBeenCalled();

    // The learner's own notes serve only them: no premium for the reading they wait on.
    expect(vi.mocked(extractExamBlueprint).mock.calls[0]?.[0].serviceTier).toBeUndefined();

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      researchUploadReason: null,
    });
  });

  it("keeps a blueprint read from the learner's private upload in their own key space", async () => {
    const { goal, user } = await examGoal();
    const { plan } = await replayTcdfResearch();
    const notice = await readFixture("tcdf-2026-notice.txt");
    const contentHash = `hash-${randomUUID()}`;

    const upload = await sourceFixture({
      contentHash,
      extractedText: notice,
      identityKey: `private:${user.id}:upload:${contentHash}`,
      kind: "upload",
      language: "pt",
      mimeType: "text/plain",
      ownerId: user.id,
      url: null,
      visibility: "private",
    });

    await learnerSourceFixture({ goalId: goal.id, sourceId: upload.id, userId: user.id });

    // The material uploaded with the goal is read without being passed again.
    const result = await researchWorkflow({ goalId: goal.id });

    expect(result).toMatchObject({ status: "ready" });
    expect(findOfficialSources).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();

    await expect(
      prisma.examBlueprint.findUnique({
        where: {
          languageIdentity: {
            identityKey: buildExamIdentityKey({
              name: plan.name,
              ownerId: user.id,
              role: plan.role,
            }),
            language: "pt",
          },
        },
      }),
    ).resolves.toMatchObject({
      // A private upload never changes, so it's never checked for freshness.
      nextCheckAt: null,
      ownerId: user.id,
      sourceId: upload.id,
      visibility: "private",
    });
  });
});

const DAY_MS = 86_400_000;

function syllabusPlan(word: string, queries = ["quantum mechanics course syllabus topics"]) {
  return {
    board: null,
    classTest: false,
    country: "ZZ",
    edition: null,
    language: "en",
    name: `Quantum Mechanics ${word}`,
    officialDomains: ["ocw.mit.edu"],
    queries,
    role: null,
    searchTerms: [`quantum mechanics ${word}`],
  };
}

function syllabusDocument(word: string, institution: string) {
  return {
    documentType: "syllabus" as const,
    kind: "official" as const,
    publisher: institution,
    reason: "The course's current topic list",
    title: `Quantum Mechanics ${word} syllabus`,
    url: `https://${institution.toLowerCase()}.example.edu/${randomUUID()}`,
  };
}

async function learnGoal(details: Record<string, unknown>) {
  const user = await userFixture();

  return goalFixture({
    details,
    kind: "learn",
    prompt: "understand quantum mechanics properly",
    userId: user.id,
  });
}

describe("research for goals that aren't exams", () => {
  beforeEach(() => {
    vi.mocked(decideLibraryIdentity).mockResolvedValue({ match: null, verdicts: [] });

    vi.mocked(generateSearchTerms).mockImplementation(
      async ({ subjects }) =>
        ({
          ...TASK_RESULT,
          data: { subjects: subjects.map(() => ({ terms: [`zq${randomUUID().slice(0, 8)}`] })) },
        }) as never,
    );

    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(
          new Response(
            `<h1>Syllabus</h1><p>${url}</p><ol><li>Wave functions and the Schrödinger equation</li><li>Operators, observables and measurement</li><li>The harmonic oscillator</li><li>Angular momentum and spin</li><li>The hydrogen atom</li></ol>`,
            { headers: { "content-type": "text/html" } },
          ),
        ),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads a deep learn goal's reference syllabi and links them without freshness checks", async () => {
    const word = `zq${randomUUID().slice(0, 8)}`;
    const goal = await learnGoal({ purpose: "deep" });
    vi.mocked(detectChangingFacts).mockResolvedValue("none");
    vi.mocked(generateResearchPlan).mockResolvedValue({ ...TASK_RESULT, data: syllabusPlan(word) });

    vi.mocked(findOfficialSources).mockResolvedValue({
      ...TASK_RESULT,
      data: {
        documents: [syllabusDocument(word, "MIT"), syllabusDocument(word, "Stanford")],
        officialFound: true,
        searchCalls: 2,
      },
    });

    const result = await researchWorkflow({ goalId: goal.id });

    expect(result).toMatchObject({ examBlueprintId: null, status: "ready" });
    expect(result.status === "ready" && result.sourceIds).toHaveLength(2);
    expect(vi.mocked(generateResearchPlan).mock.calls[0]?.[0]).toMatchObject({ topic: "syllabus" });
    expect(vi.mocked(findOfficialSources).mock.calls[0]?.[0]).toMatchObject({ topic: "syllabus" });

    const links = await prisma.learnerSource.findMany({
      include: { source: true },
      where: { goalId: goal.id },
    });

    expect(links).toHaveLength(2);
    expect(links.every((link) => link.origin === "research")).toBe(true);

    for (const { source } of links) {
      expect(source.structure).toMatchObject({ topic: "syllabus" });
      expect(source.validUntil?.getTime()).toBeGreaterThan(Date.now() + 360 * DAY_MS);
      // Syllabi are reused for a year and never checked for freshness.
      expect(source.nextCheckAt).toBeNull();
    }
  });

  it("waits for the purpose onboarding is about to ask, and plans nothing for an overview", async () => {
    const onboardingId = randomUUID();
    const goal = await learnGoal({ onboardingId });
    vi.mocked(detectChangingFacts).mockResolvedValue("none");

    vi.mocked(sleep).mockImplementationOnce(async () => {
      await prisma.goal.update({
        data: { details: { answered: ["purpose"], onboardingId, purpose: "overview" } },
        where: { id: goal.id },
      });
    });

    await expect(researchWorkflow({ goalId: goal.id })).resolves.toStrictEqual({
      status: "notNeeded",
    });

    expect(vi.mocked(sleep)).toHaveBeenCalledWith("3s");
    expect(generateResearchPlan).not.toHaveBeenCalled();
  });

  it("searches nothing for a subject no university course teaches", async () => {
    const goal = await learnGoal({ purpose: "careerChange" });
    vi.mocked(detectChangingFacts).mockResolvedValue("none");

    vi.mocked(generateResearchPlan).mockResolvedValue({
      ...TASK_RESULT,
      data: syllabusPlan(`zq${randomUUID().slice(0, 8)}`, []),
    });

    await expect(researchWorkflow({ goalId: goal.id })).resolves.toStrictEqual({
      examBlueprintId: null,
      sourceIds: [],
      status: "ready",
    });

    expect(findOfficialSources).not.toHaveBeenCalled();
  });

  it("reuses a law's official text another learner's research stored instead of searching", async () => {
    const word = `zq${randomUUID().slice(0, 8)}`;
    const goal = await learnGoal({});
    vi.mocked(detectChangingFacts).mockResolvedValue("regulation");

    const stored = await sourceFixture({
      extractedText: `Lei ${word}. Art. 1º Esta Lei dispõe sobre o tratamento de dados pessoais, inclusive nos meios digitais, por pessoa natural ou por pessoa jurídica de direito público ou privado, com o objetivo de proteger os direitos fundamentais de liberdade e de privacidade.`,
      language: "pt",
      mimeType: "text/html",
      publisher: "Presidência da República",
      structure: { images: 0, pages: 1, topic: "regulation" },
      title: `Lei Geral de Proteção de Dados ${word}`,
      validUntil: new Date(Date.now() + 10 * DAY_MS),
    });

    vi.mocked(generateResearchPlan).mockResolvedValue({
      ...TASK_RESULT,
      data: {
        board: null,
        classTest: false,
        country: "BR",
        edition: null,
        language: "pt",
        name: `LGPD ${word}`,
        officialDomains: ["planalto.gov.br"],
        queries: ["lei 13.709 texto compilado"],
        role: null,
        searchTerms: [`Proteção de Dados ${word}`],
      },
    });

    // Only the stored law text passes the reuse decision.
    vi.mocked(decideLibraryIdentity).mockImplementation(async ({ candidates }) => {
      const verdicts = candidates.map((candidate) => ({
        id: candidate.id,
        model: "test/jev",
        probability: candidate.id === stored.id ? 0.9 : 0.1,
      }));

      return { match: verdicts.find((verdict) => verdict.id === stored.id) ?? null, verdicts };
    });

    await expect(researchWorkflow({ goalId: goal.id })).resolves.toStrictEqual({
      examBlueprintId: null,
      sourceIds: [stored.id],
      status: "ready",
    });

    expect(findOfficialSources).not.toHaveBeenCalled();

    await expect(
      prisma.learnerSource.findFirst({ where: { goalId: goal.id, sourceId: stored.id } }),
    ).resolves.toMatchObject({ origin: "research" });

    // The law is checked again from the next daily sweep on.
    await expect(
      prisma.source.findUniqueOrThrow({ where: { id: stored.id } }),
    ).resolves.toMatchObject({ nextCheckAt: expect.any(Date) });
  });
});
