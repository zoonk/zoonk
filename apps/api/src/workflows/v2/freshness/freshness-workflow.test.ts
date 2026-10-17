import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { decideLibraryIdentity } from "@zoonk/ai/tasks/v2/identity/decision";
import { generateSearchTerms } from "@zoonk/ai/tasks/v2/identity/search-terms";
import { checkCitedFacts } from "@zoonk/ai/tasks/v2/research/check-cited-facts";
import { checkExamReading } from "@zoonk/ai/tasks/v2/research/check-exam-reading";
import {
  type BlueprintExtraction,
  extractExamBlueprint,
} from "@zoonk/ai/tasks/v2/research/extract-exam-blueprint";
import { findOfficialSources } from "@zoonk/ai/tasks/v2/research/find-official-sources";
import { type ExamResearchPlan, generateExamResearchPlan } from "@zoonk/ai/tasks/v2/research/plan";
import { generateSourceChangeNotice } from "@zoonk/ai/tasks/v2/research/source-change-notice";
import { toBlueprintContent } from "@zoonk/core/library/exams/blueprint-content";
import { listBlueprintFacts } from "@zoonk/core/library/exams/blueprint-facts";
import { saveExamBlueprint } from "@zoonk/core/library/exams/save";
import { storeWebSource } from "@zoonk/core/library/sources/web";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture, learnerSourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { freshnessWorkflow } from "./freshness-workflow";
import { readNoticeAgainWorkflow } from "./read-notice-again-workflow";

const DAY_MS = 86_400_000;

/** A model call's result around its data, as the tasks return it. */
const TASK = {
  provenance: {
    costUsd: 0,
    generatedAt: "2026-09-26T12:00:00.000Z",
    latencyMs: 1,
    model: "google/gemini-3.8-flash",
    promptVersion: "v1",
    provider: "google",
    requestedModel: "google/gemini-3.8-flash",
    runId: "r1",
    usage: {},
  },
  systemPrompt: "",
  usage: {} as never,
  userPrompt: "",
};

/** A reading as `extractExamBlueprint` returns it, without the formats' own read beside it. */
const READING = { ...TASK, formatsProvenance: null };

const PROVENANCE = {
  generatedAt: "2026-09-26T12:00:00.000Z",
  model: "google/gemini-3.8-flash",
  promptVersion: "v1",
  runId: "r1",
};

const OLD_DATE_LINE = "Aplicação das provas objetivas e da prova discursiva 22/11/2026";
const NEW_DATE_LINE = "Aplicação das provas objetivas e da prova discursiva 29/11/2026";
const NEXT_EDITION_LINE = "Aplicação das provas objetivas e da prova discursiva 21/11/2027";

/** The search's plan for the next notice: what a learner's research would plan for the exam. */
const NEXT_NOTICE_PLAN: ExamResearchPlan = {
  board: "Cebraspe",
  classTest: false,
  country: "BR",
  edition: null,
  language: "pt",
  name: "Concurso TCDF",
  officialDomains: ["cebraspe.org.br"],
  queries: ["edital concurso TCDF analista"],
  role: "Analista Administrativo de Controle Externo",
  searchTerms: ["TCDF"],
};

async function readFixture(name: string) {
  return readFile(new URL(`../research/_test-fixtures/${name}`, import.meta.url), "utf8");
}

async function readRecordedExtraction(): Promise<BlueprintExtraction> {
  return JSON.parse(await readFixture("tcdf-2026-extraction.json")) as BlueprintExtraction;
}

/** The board's site, served from memory: the recorded notice, with the exam day as the test wants it. */
function serveNotice(notice: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(new Response(notice, { headers: { "content-type": "text/plain" } })),
    ),
  );
}

function withExamDate({
  extraction,
  line,
}: {
  extraction: BlueprintExtraction;
  line: string;
}): BlueprintExtraction {
  return {
    ...extraction,
    dates: extraction.dates.map((date) =>
      date.kind === "exam"
        ? {
            ...date,
            date: line.endsWith("29/11/2026") ? "2026-11-29" : "2026-11-22",
            passage: line,
          }
        : date,
    ),
  };
}

/**
 * An exam with one active learner, read from the recorded notice with every fact kept. An
 * `erratum` ends the stored notice with a line its reading missed.
 */
async function examWithLearner({ erratum }: { erratum?: string } = {}) {
  const [notice, extraction] = await Promise.all([
    readFixture("tcdf-2026-notice.txt"),
    readRecordedExtraction(),
  ]);

  const current = withExamDate({ extraction, line: OLD_DATE_LINE });
  const text = [notice, OLD_DATE_LINE, erratum].filter(Boolean).join("\n");
  serveNotice(text);

  const source = await storeWebSource({
    kind: "official",
    language: "pt",
    publisher: "Cebraspe",
    title: "Edital nº 1 – TCDF/ANACE",
    topic: "exam",
    url: `https://cdn.cebraspe.org.br/concursos/tc_df_26_analista/${randomUUID()}.txt`,
  });

  const documents = [{ sourceId: source.id, text }];
  const facts = listBlueprintFacts({ documents, extraction: current });

  const read = toBlueprintContent({
    documents,
    extraction: current,
    facts,
    noticeUrl: source.url,
    sourceHash: source.contentHash,
    supportedIds: facts.map((fact) => fact.id),
  });

  // Research stores a shared reading with its check, which found nothing left out.
  const check = { checkedAt: new Date().toISOString(), problems: [], readings: 1 };

  const saved = await saveExamBlueprint({
    content: { ...read, edition: { ...read.edition, check } },
    identity: {
      board: "Cebraspe",
      country: "BR",
      language: "pt",
      name: `Concurso TCDF ${randomUUID()}`,
      ownerId: null,
      role: "Analista Administrativo de Controle Externo",
    },
    provenance: PROVENANCE,
    sourceId: source.id,
  });

  const user = await userFixture();
  await goalFixture({ examBlueprintId: saved.blueprint.id, kind: "exam", userId: user.id });

  return { blueprint: saved.blueprint, extraction, notice, source };
}

/** A law stored as its page read today, which one active learner's research relies on. */
async function lawWithLearner(text: string) {
  serveNotice(text);

  const source = await storeWebSource({
    kind: "official",
    language: "pt",
    publisher: "Presidência da República",
    title: "Lei nº 99.999/2026",
    topic: "regulation",
    url: `https://www.planalto.gov.br/${randomUUID()}`,
  });

  const user = await userFixture();
  const goal = await goalFixture({ userId: user.id });

  await learnerSourceFixture({
    goalId: goal.id,
    origin: "research",
    sourceId: source.id,
    userId: user.id,
  });

  return source;
}

describe(freshnessWorkflow, () => {
  beforeEach(() => {
    // No stored copy of a notice exists under another address: every document is fetched.
    vi.mocked(generateSearchTerms).mockImplementation(
      async ({ subjects }) =>
        ({
          ...TASK,
          data: { subjects: subjects.map(() => ({ terms: [`zq${randomUUID().slice(0, 8)}`] })) },
        }) as never,
    );

    vi.mocked(decideLibraryIdentity).mockResolvedValue({ match: null, verdicts: [] });

    // Readings leave nothing out unless a test says so.
    vi.mocked(checkExamReading).mockResolvedValue({
      ...TASK,
      data: { missingSubjects: [], statedCounts: [] },
    });

    vi.mocked(checkCitedFacts).mockImplementation(async ({ facts }) => ({
      data: { supportedIds: facts.map((fact) => fact.id) },
      provenance: {
        ...PROVENANCE,
        costUsd: 0,
        latencyMs: 1,
        provider: "google",
        requestedModel: PROVENANCE.model,
        usage: {},
      },
      systemPrompt: "",
      usage: {} as never,
      userPrompt: "",
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("updates only what a corrected notice changed and records the learner notice", async () => {
    const { blueprint, extraction, notice } = await examWithLearner();
    serveNotice(`${notice}\n${NEW_DATE_LINE}`);

    vi.mocked(extractExamBlueprint).mockResolvedValue({
      data: withExamDate({ extraction, line: NEW_DATE_LINE }),
      formatsProvenance: null,
      provenance: {
        ...PROVENANCE,
        costUsd: 0,
        latencyMs: 1,
        provider: "google",
        requestedModel: PROVENANCE.model,
        runId: "r2",
        usage: {},
      },
      systemPrompt: "",
      usage: {} as never,
      userPrompt: "",
    });

    vi.mocked(generateSourceChangeNotice).mockResolvedValue({
      data: { message: "O edital mudou: a prova agora é em 29 de novembro de 2026." },
      provenance: {
        ...PROVENANCE,
        costUsd: 0,
        latencyMs: 1,
        provider: "openai",
        requestedModel: "openai/gpt-6-luna",
        runId: "r3",
        usage: {},
      },
      systemPrompt: "",
      usage: {} as never,
      userPrompt: "",
    });

    await freshnessWorkflow({ examBlueprintId: blueprint.id, kind: "exam" });

    const [stored, notices] = await Promise.all([
      prisma.examBlueprint.findUniqueOrThrow({ where: { id: blueprint.id } }),
      prisma.sourceChangeNotice.findMany({ where: { examBlueprintId: blueprint.id } }),
    ]);

    expect(stored.examDate).toStrictEqual(new Date("2026-11-29T00:00:00.000Z"));
    expect(stored.structure).toStrictEqual(blueprint.structure);

    // Nobody waits on a freshness check: it reads at the flex tier, about half the price.
    expect(vi.mocked(extractExamBlueprint).mock.calls[0]?.[0].serviceTier).toBe("flex");

    expect(notices).toMatchObject([
      {
        fields: ["edition.dates"],
        message: "O edital mudou: a prova agora é em 29 de novembro de 2026.",
        runId: "r3",
      },
    ]);

    expect(vi.mocked(generateSourceChangeNotice).mock.calls[0]?.[0].changes).toContain(
      "2026-11-29",
    );
  });

  it("reads a corrected notice that keeps the exam day, and leaves learners' dates alone", async () => {
    const { blueprint, extraction, notice } = await examWithLearner();
    const extended = "Período de solicitação de inscrição prorrogado até 24/9/2026";
    serveNotice(`${notice}\n${OLD_DATE_LINE}\n${extended}`);

    // Another learner prepares for the same exam with a date of their own.
    const [user, skill] = await Promise.all([userFixture(), skillFixture()]);

    const goal = await goalFixture({
      examBlueprintId: blueprint.id,
      kind: "exam",
      targetDate: new Date("2026-11-29T00:00:00.000Z"),
      userId: user.id,
    });

    await planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "Basics" }],
        skills: [{ lessons: 2, name: skill.name, phase: 0, skillId: skill.id }],
      },
      phases: [],
    });

    const current = withExamDate({ extraction, line: OLD_DATE_LINE });

    vi.mocked(extractExamBlueprint).mockResolvedValue({
      ...READING,
      data: {
        ...current,
        dates: current.dates.map((date) =>
          date.kind === "registrationEnd"
            ? { ...date, date: "2026-09-24", passage: extended }
            : date,
        ),
      },
    });

    vi.mocked(generateSourceChangeNotice).mockResolvedValue({
      ...TASK,
      data: { message: "As inscrições foram prorrogadas até 24 de setembro." },
    });

    await freshnessWorkflow({ examBlueprintId: blueprint.id, kind: "exam" });

    expect(extractExamBlueprint).toHaveBeenCalledOnce();

    const [stored, changes, kept] = await Promise.all([
      prisma.examBlueprint.findUniqueOrThrow({ where: { id: blueprint.id } }),
      prisma.planChange.count({ where: { plan: { goalId: goal.id } } }),
      prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
    ]);

    expect(stored.examDate).toStrictEqual(new Date("2026-11-22T00:00:00.000Z"));
    expect(stored.registrationEndsAt).toStrictEqual(new Date("2026-09-24T00:00:00.000Z"));

    // Only the exam's own days reach learners' dates: nothing reaches this learner's Today.
    expect(changes).toBe(0);
    expect(kept.targetDate).toStrictEqual(new Date("2026-11-29T00:00:00.000Z"));
  });

  it("searches for the next notice once the stored edition passed, and proposes its exam day to the learners preparing for it", async () => {
    const { blueprint, extraction, notice } = await examWithLearner();
    const nextUrl = `https://cdn.cebraspe.org.br/concursos/tc_df_27_analista/${randomUUID()}.txt`;

    // The 2026 exam is behind; a learner's plan counts down to the estimated 2027 one.
    await prisma.examBlueprint.update({
      data: { examDate: new Date(Date.now() - 30 * DAY_MS) },
      where: { id: blueprint.id },
    });

    const [user, skill] = await Promise.all([userFixture(), skillFixture()]);

    const goal = await goalFixture({
      examBlueprintId: blueprint.id,
      kind: "exam",
      targetDate: new Date("2027-11-28T00:00:00.000Z"),
      userId: user.id,
    });

    await planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "Basics" }],
        skills: [{ lessons: 2, name: skill.name, phase: 0, skillId: skill.id }],
      },
      phases: [],
    });

    serveNotice(`${notice}\n${NEXT_EDITION_LINE}`);
    vi.mocked(generateExamResearchPlan).mockResolvedValue({ ...TASK, data: NEXT_NOTICE_PLAN });

    vi.mocked(findOfficialSources).mockResolvedValue({
      ...TASK,
      data: {
        documents: [
          {
            documentType: "notice",
            kind: "official",
            publisher: "Cebraspe",
            reason: "The 2027 opening notice",
            title: "Edital nº 1 – TCDF 2027",
            url: nextUrl,
          },
        ],
        officialFound: true,
        searchCalls: 1,
      },
    });

    vi.mocked(extractExamBlueprint).mockResolvedValue({
      ...READING,
      data: {
        ...extraction,
        dates: extraction.dates.map((date) =>
          date.kind === "exam" ? { ...date, date: "2027-11-21", passage: NEXT_EDITION_LINE } : date,
        ),
      },
    });

    vi.mocked(generateSourceChangeNotice).mockResolvedValue({
      ...TASK,
      data: { message: "Saiu o edital de 2027: a prova é em 21 de novembro de 2027." },
    });

    const result = await freshnessWorkflow({ examBlueprintId: blueprint.id, kind: "exam" });

    expect(result).toMatchObject({ status: "checked" });

    expect(Date.parse(result.status === "checked" ? result.nextCheckAt : "")).toBeGreaterThan(
      Date.now() + 6 * DAY_MS,
    );

    const [stored, proposals, kept] = await Promise.all([
      prisma.examBlueprint.findUniqueOrThrow({ where: { id: blueprint.id } }),
      prisma.planChange.findMany({ where: { plan: { goalId: goal.id }, status: "proposed" } }),
      prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
    ]);

    expect(stored.examDate).toStrictEqual(new Date("2027-11-21T00:00:00.000Z"));

    // The learner's date waits for their tap; the change carries the notice's own sentence.
    expect(kept.targetDate).toStrictEqual(new Date("2027-11-28T00:00:00.000Z"));

    expect(proposals).toMatchObject([
      {
        payload: {
          operations: [{ estimated: false, kind: "setNoticeDate", targetDate: "2027-11-21" }],
          source: "notice",
        },
        reason: "Saiu o edital de 2027: a prova é em 21 de novembro de 2027.",
      },
    ]);
  });

  it("doesn't read the stored notice again when the search finds it with nothing new, whatever instructions read it", async () => {
    const { blueprint, source } = await examWithLearner();

    // The stored reading's instructions (`PROVENANCE`) are older than today's: only a changed
    // document is read again.
    await prisma.examBlueprint.update({
      data: { examDate: new Date(Date.now() - 30 * DAY_MS) },
      where: { id: blueprint.id },
    });

    const user = await userFixture();

    await goalFixture({
      examBlueprintId: blueprint.id,
      kind: "exam",
      targetDate: new Date("2027-11-28T00:00:00.000Z"),
      userId: user.id,
    });

    vi.mocked(generateExamResearchPlan).mockResolvedValue({ ...TASK, data: NEXT_NOTICE_PLAN });

    vi.mocked(findOfficialSources).mockResolvedValue({
      ...TASK,
      data: {
        documents: [
          {
            documentType: "notice",
            kind: "official",
            publisher: "Cebraspe",
            reason: "The opening notice",
            title: "Edital nº 1 – TCDF",
            url: source.url ?? "",
          },
        ],
        officialFound: true,
        searchCalls: 1,
      },
    });

    await expect(
      freshnessWorkflow({ examBlueprintId: blueprint.id, kind: "exam" }),
    ).resolves.toMatchObject({ status: "checked" });

    expect(findOfficialSources).toHaveBeenCalledOnce();
    expect(extractExamBlueprint).not.toHaveBeenCalled();
  });

  // Nothing reads a settled notice again on its own; an admin can, deliberately.
  it("reads an exam's stored notice again on an admin's request, though nothing changed", async () => {
    // The notice ends with an erratum that moved the exam a week, which its first reading missed:
    // reading it again cites that line.
    const { blueprint, extraction } = await examWithLearner({ erratum: NEW_DATE_LINE });

    vi.mocked(extractExamBlueprint).mockResolvedValue({
      data: withExamDate({ extraction, line: NEW_DATE_LINE }),
      formatsProvenance: null,
      provenance: {
        ...PROVENANCE,
        costUsd: 0,
        latencyMs: 1,
        provider: "google",
        requestedModel: PROVENANCE.model,
        runId: "read-again",
        usage: {},
      },
      systemPrompt: "",
      usage: {} as never,
      userPrompt: "",
    });

    // A check finds the same document: the reading stands, without a model, and the check
    // reports when the next one is due.
    const check = await freshnessWorkflow({ examBlueprintId: blueprint.id, kind: "exam" });
    const checked = await prisma.examBlueprint.findUniqueOrThrow({ where: { id: blueprint.id } });

    expect(check).toStrictEqual({
      nextCheckAt: checked.nextCheckAt?.toISOString(),
      status: "checked",
    });

    expect(extractExamBlueprint).not.toHaveBeenCalled();

    await expect(readNoticeAgainWorkflow({ examBlueprintId: blueprint.id })).resolves.toStrictEqual(
      { status: "read" },
    );

    expect(extractExamBlueprint).toHaveBeenCalledOnce();

    await expect(
      prisma.examBlueprint.findUniqueOrThrow({ where: { id: blueprint.id } }),
    ).resolves.toMatchObject({ runId: "read-again" });

    await expect(readNoticeAgainWorkflow({ examBlueprintId: randomUUID() })).resolves.toStrictEqual(
      { status: "notFound" },
    );
  });

  // The check's own stopping rules are core's (`checkFreshness`); the run ends with them.
  it("stops when nobody studies the exam anymore", async () => {
    const blueprint = await examBlueprintFixture();

    await expect(
      freshnessWorkflow({ examBlueprintId: blueprint.id, kind: "exam" }),
    ).resolves.toStrictEqual({ reason: "noLearners", status: "stopped" });
  });

  it("writes one line when a law learners rely on changed", async () => {
    const source = await lawWithLearner("Art. 1º A alíquota é de 15%.");
    serveNotice("Art. 1º A alíquota é de 17%.");

    vi.mocked(generateSourceChangeNotice).mockResolvedValue({
      data: { message: "A lei mudou: a alíquota agora é de 17%." },
      provenance: {
        ...PROVENANCE,
        costUsd: 0,
        latencyMs: 1,
        provider: "openai",
        requestedModel: "openai/gpt-6-luna",
        usage: {},
      },
      systemPrompt: "",
      usage: {} as never,
      userPrompt: "",
    });

    await freshnessWorkflow({ kind: "source", sourceId: source.id });

    expect(generateSourceChangeNotice).toHaveBeenCalledWith(
      expect.objectContaining({
        changes: "- Art. 1º A alíquota é de 15%.\n+ Art. 1º A alíquota é de 17%.",
        source: "Lei nº 99.999/2026",
      }),
    );

    await expect(
      prisma.sourceChangeNotice.findMany({ where: { sourceId: source.id } }),
    ).resolves.toMatchObject([
      { examBlueprintId: null, message: "A lei mudou: a alíquota agora é de 17%." },
    ]);
  });

  it("writes no line, and runs no model, when a law's page only moved its articles around", async () => {
    const source = await lawWithLearner("Art. 1º A alíquota é de 15%.\nArt. 2º Vigora em 2027.");
    serveNotice("Art. 2º Vigora em 2027.\nArt. 1º A alíquota é de 15%.");

    await expect(freshnessWorkflow({ kind: "source", sourceId: source.id })).resolves.toMatchObject(
      { status: "checked" },
    );

    expect(generateSourceChangeNotice).not.toHaveBeenCalled();

    const [stored, notices] = await Promise.all([
      prisma.source.findUniqueOrThrow({ where: { id: source.id } }),
      prisma.sourceChangeNotice.count({ where: { sourceId: source.id } }),
    ]);

    // The new page was stored; only nothing learners would notice changed.
    expect(stored.contentHash).not.toBe(source.contentHash);
    expect(notices).toBe(0);
  });
});
