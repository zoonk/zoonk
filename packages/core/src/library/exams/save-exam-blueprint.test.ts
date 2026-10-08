import { randomUUID } from "node:crypto";
import { decideExamIdentity } from "@zoonk/ai/tasks/v2/research/exam-identity-decision";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { examBlueprintFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { revalidateTag } from "next/cache";
import { describe, expect, it, vi } from "vitest";
import { getExamBlueprintCacheTag } from "../../cache/tags";
import { uniqueWord } from "../identity/_test-utils/identity-mocks";
import { MAX_MATCHES_PER_TERM } from "../identity/_utils/text-search-sql";
import { type BlueprintContent } from "./blueprint-contract";
import {
  type ExamIdentity,
  type ExamRequest,
  buildExamIdentityKey,
  findSameExam,
} from "./exam-identity";
import { previewExamBlueprintChanges, saveExamBlueprint } from "./save-exam-blueprint";

/** Whether two exams are the same is an evaluation model's call: each test says what it answers. */
vi.mock("@zoonk/ai/tasks/v2/research/exam-identity-decision", () => ({
  decideExamIdentity: vi.fn(),
}));

/** The stored exams the search hands the identity decision for a request, best first. */
async function searchedCandidates(request: Partial<ExamRequest> & Pick<ExamRequest, "name">) {
  vi.mocked(decideExamIdentity).mockClear();
  vi.mocked(decideExamIdentity).mockResolvedValue(null);

  await findSameExam({
    request: { board: null, country: "BR", language: "pt", ownerId: null, role: null, ...request },
    searchTerms: [],
  });

  return vi.mocked(decideExamIdentity).mock.calls[0]?.[0].candidates ?? [];
}

const PROVENANCE = {
  generatedAt: new Date("2026-09-26T12:00:00.000Z"),
  model: "anthropic/claude-opus-5.5",
  promptVersion: "test-v1",
  runId: "run-1",
};

function identity(overrides: Partial<ExamIdentity> = {}): ExamIdentity {
  return {
    board: "Cebraspe",
    country: "BR",
    language: "pt",
    name: `Concurso ${randomUUID()}`,
    ownerId: null,
    role: "Analista Judiciário",
    ...overrides,
  };
}

function content({
  questions,
  sourceHash,
  sourceId,
}: {
  questions: number;
  sourceHash: string;
  sourceId: string;
}): BlueprintContent {
  const citation = { passage: `A prova objetiva terá ${questions} itens.`, sourceId };

  return {
    edition: {
      citations: [],
      dates: [
        {
          citation,
          date: "2026-10-05",
          kind: "registrationEnd",
          label: "Fim das inscrições",
          startTime: null,
        },
        { citation, date: "2026-11-22", kind: "exam", label: "Prova objetiva", startTime: "08:00" },
      ],
      noticeUrl: "https://www.cebraspe.org.br/edital.pdf",
      questionCount: questions,
      sourceHash,
      timeZone: "America/Sao_Paulo",
      year: 2026,
    },
    structure: {
      formats: [{ citation, description: "Certo ou errado", kind: "trueFalse", options: null }],
      mock: {
        adaptive: false,
        citations: [citation],
        order: null,
        scoring: {
          description: "Um item errado anula um item certo.",
          method: "wrongCancelsRight",
        },
        sections: [{ day: 1, minutes: 240, name: "Prova objetiva", questions }],
        timeLimitMinutes: 240,
        totalQuestions: questions,
      },
      rules: [{ citation, text: "Um item errado anula um item certo." }],
      subjects: [
        {
          citation,
          name: "Direito Constitucional",
          questions,
          topics: ["Direitos fundamentais"],
          weight: null,
        },
      ],
    },
    topicFrequency: [],
  };
}

describe(saveExamBlueprint, () => {
  it("creates the canonical blueprint with the dates freshness reads", async () => {
    const source = await sourceFixture({ language: "pt" });
    const examIdentity = identity();

    const saved = await saveExamBlueprint({
      content: content({ questions: 120, sourceHash: source.contentHash, sourceId: source.id }),
      identity: examIdentity,
      provenance: PROVENANCE,
      sourceId: source.id,
    });

    expect(saved.created).toBe(true);

    expect(saved.blueprint).toMatchObject({
      board: "Cebraspe",
      examDate: new Date("2026-11-22T00:00:00.000Z"),
      identityKey: buildExamIdentityKey(examIdentity),
      model: PROVENANCE.model,
      registrationEndsAt: new Date("2026-10-05T00:00:00.000Z"),
      sourceId: source.id,
      validUntil: new Date("2026-11-22T00:00:00.000Z"),
    });

    expect(revalidateTag).toHaveBeenCalledWith(getExamBlueprintCacheTag(saved.blueprint.id), {
      expire: 0,
    });
  });

  it("keeps a fetched notice valid until the exam, and leaves uploads alone", async () => {
    const [notice, upload] = await Promise.all([
      sourceFixture({ language: "pt", validUntil: new Date("2026-10-26T00:00:00.000Z") }),
      sourceFixture({ kind: "upload", language: "pt", validUntil: null }),
    ]);

    await Promise.all(
      [notice, upload].map((source) =>
        saveExamBlueprint({
          content: content({ questions: 90, sourceHash: source.contentHash, sourceId: source.id }),
          identity: identity(),
          provenance: PROVENANCE,
          sourceId: source.id,
        }),
      ),
    );

    const stored = await prisma.source.findMany({
      select: { id: true, validUntil: true },
      where: { id: { in: [notice.id, upload.id] } },
    });

    expect(new Map(stored.map((source) => [source.id, source.validUntil]))).toStrictEqual(
      new Map([
        [notice.id, new Date("2026-11-22T00:00:00.000Z")],
        [upload.id, null],
      ]),
    );
  });

  it("updates only what changed on a new reading and records the learner notice", async () => {
    const [source, corrected] = await Promise.all([
      sourceFixture({ language: "pt" }),
      sourceFixture({ language: "pt" }),
    ]);

    const examIdentity = identity();
    const first = content({ questions: 120, sourceHash: source.contentHash, sourceId: source.id });

    const created = await saveExamBlueprint({
      content: first,
      identity: examIdentity,
      provenance: PROVENANCE,
      sourceId: source.id,
    });

    // A lesson written from the first notice, before the correction replaced it.
    const citing = await libraryLessonFixture({ contentStatus: "completed" });

    await libraryStepFixture({
      generatedAt: new Date(Date.now() - 60_000),
      lessonId: citing.id,
      sourceId: source.id,
    });

    const next = content({
      questions: 100,
      sourceHash: corrected.contentHash,
      sourceId: corrected.id,
    });

    const preview = await previewExamBlueprintChanges({ content: next, identity: examIdentity });

    expect(preview?.map((change) => change.field)).toStrictEqual([
      "subjects",
      "mock",
      "edition.questionCount",
    ]);

    const updated = await saveExamBlueprint({
      content: next,
      identity: examIdentity,
      notice: {
        message: "O edital mudou: a prova agora tem 100 itens.",
        provenance: { ...PROVENANCE, model: "google/gemini-3.8-flash", runId: "run-2" },
      },
      provenance: { ...PROVENANCE, runId: "run-3" },
      sourceId: corrected.id,
    });

    expect(updated.created).toBe(false);
    expect(updated.blueprint.id).toBe(created.blueprint.id);
    expect(updated.blueprint.runId).toBe("run-3");
    expect(updated.blueprint.structure).toMatchObject({ rules: first.structure.rules });

    const notices = await prisma.sourceChangeNotice.findMany({
      where: { examBlueprintId: created.blueprint.id },
    });

    expect(notices).toMatchObject([
      {
        contentHash: corrected.contentHash,
        fields: ["subjects", "mock", "edition.questionCount"],
        language: "pt",
        message: "O edital mudou: a prova agora tem 100 itens.",
        model: "google/gemini-3.8-flash",
        previousHash: source.contentHash,
        sourceId: corrected.id,
      },
    ]);

    await expect(
      prisma.contentReviewFlag.count({
        where: { lessonId: citing.id, noticeId: notices[0]?.id, status: "open" },
      }),
    ).resolves.toBe(1);
  });

  it("records no notice when a new reading says the same thing", async () => {
    const source = await sourceFixture({ language: "pt" });
    const examIdentity = identity();
    const first = content({ questions: 80, sourceHash: source.contentHash, sourceId: source.id });

    const created = await saveExamBlueprint({
      content: first,
      identity: examIdentity,
      provenance: PROVENANCE,
      sourceId: source.id,
    });

    const saved = await saveExamBlueprint({
      content: { ...first, edition: { ...first.edition, sourceHash: "new-hash" } },
      identity: examIdentity,
      notice: { message: "Nothing changed", provenance: PROVENANCE },
      provenance: { ...PROVENANCE, runId: "run-ignored" },
      sourceId: source.id,
    });

    expect(saved.changes).toStrictEqual([]);
    expect(saved.blueprint.runId).toBe(created.blueprint.runId);
    expect(saved.blueprint.edition).toMatchObject({ sourceHash: "new-hash" });

    await expect(
      prisma.sourceChangeNotice.count({ where: { examBlueprintId: created.blueprint.id } }),
    ).resolves.toBe(0);
  });

  it("tells learners nothing when the same notice is read again with new instructions", async () => {
    const source = await sourceFixture({ language: "pt" });
    const examIdentity = identity();
    const first = content({ questions: 80, sourceHash: source.contentHash, sourceId: source.id });

    await saveExamBlueprint({
      content: first,
      identity: examIdentity,
      provenance: PROVENANCE,
      sourceId: source.id,
    });

    // The same document, read by newer instructions that now see the notice's groups.
    const reread = content({ questions: 90, sourceHash: source.contentHash, sourceId: source.id });

    await expect(
      previewExamBlueprintChanges({ content: reread, identity: examIdentity }),
    ).resolves.toBeNull();
  });

  it("keeps the number of options when a new reading of the notice doesn't state it", async () => {
    const [source, page] = await Promise.all([
      sourceFixture({ language: "pt" }),
      sourceFixture({ language: "pt" }),
    ]);

    const examIdentity = identity({ board: "Inep", name: `Enem ${randomUUID()}`, role: null });
    const first = content({ questions: 180, sourceHash: source.contentHash, sourceId: source.id });

    const fiveOptions = {
      citation: { passage: "Cada questão terá cinco alternativas.", sourceId: source.id },
      description: "Múltipla escolha com cinco alternativas",
      kind: "multipleChoice" as const,
      options: 5,
    };

    await saveExamBlueprint({
      content: { ...first, structure: { ...first.structure, formats: [fiveOptions] } },
      identity: examIdentity,
      provenance: PROVENANCE,
      sourceId: source.id,
    });

    // The exam's page, read by newer instructions: "180 questões objetivas", no options.
    const reread = content({ questions: 180, sourceHash: page.contentHash, sourceId: page.id });

    const saved = await saveExamBlueprint({
      content: {
        ...reread,
        structure: {
          ...reread.structure,
          formats: [
            {
              citation: { passage: "180 questões objetivas", sourceId: page.id },
              description: "Questões objetivas",
              kind: "multipleChoice",
              options: null,
            },
          ],
        },
      },
      identity: examIdentity,
      provenance: { ...PROVENANCE, runId: "run-reread" },
      sourceId: page.id,
    });

    expect(saved.changes).toStrictEqual([]);
    expect(saved.blueprint.structure).toMatchObject({ formats: [fiveOptions] });
  });

  it("keeps a blueprint read from private material private, in its owner's key space", async () => {
    const [source, owner] = await Promise.all([sourceFixture({ language: "pt" }), userFixture()]);

    const examIdentity = identity({
      board: null,
      name: "Bioquímica prova 2",
      ownerId: owner.id,
      role: null,
    });

    const saved = await saveExamBlueprint({
      content: content({ questions: 10, sourceHash: source.contentHash, sourceId: source.id }),
      identity: examIdentity,
      provenance: PROVENANCE,
      sourceId: source.id,
    });

    expect(saved.blueprint).toMatchObject({
      identityKey: `private:${owner.id}:bioquimica-prova-2`,
      ownerId: owner.id,
      visibility: "private",
    });

    await expect(searchedCandidates({ name: "Bioquímica prova" })).resolves.not.toContainEqual(
      expect.objectContaining({ id: saved.blueprint.id }),
    );
  });

  it("deletes a blueprint read from private material with its owner, never a shared one", async () => {
    const [source, owner] = await Promise.all([sourceFixture({ language: "pt" }), userFixture()]);
    const name = `Bioquímica prova ${randomUUID()}`;

    const save = (ownerId: string | null) =>
      saveExamBlueprint({
        content: content({ questions: 10, sourceHash: source.contentHash, sourceId: source.id }),
        identity: identity({ name, ownerId }),
        provenance: PROVENANCE,
        sourceId: source.id,
      });

    const [own, shared] = await Promise.all([save(owner.id), save(null)]);

    expect(shared.blueprint).toMatchObject({ ownerId: null, visibility: "public" });

    await goalFixture({ examBlueprintId: shared.blueprint.id, kind: "exam", userId: owner.id });
    await prisma.user.delete({ where: { id: owner.id } });

    await expect(
      prisma.examBlueprint.findUnique({ where: { id: own.blueprint.id } }),
    ).resolves.toBeNull();

    await expect(
      prisma.examBlueprint.findUnique({ where: { id: shared.blueprint.id } }),
    ).resolves.not.toBeNull();
  });
});

describe(findSameExam, () => {
  it("finds a shared blueprint under another name for the same exam, in any country when none is known", async () => {
    const marker = randomUUID().slice(0, 8);

    const blueprint = await examBlueprintFixture({
      board: "INEP",
      country: "BR",
      identityKey: `enem-${marker}`,
      language: "pt",
      name: `ENEM ${marker} Exame Nacional do Ensino Médio`,
    });

    const name = `exame nacional ensino medio ${marker}`;

    await expect(searchedCandidates({ name })).resolves.toContainEqual(
      expect.objectContaining({ id: blueprint.id }),
    );

    await expect(searchedCandidates({ country: "US", name })).resolves.toStrictEqual([]);

    await expect(searchedCandidates({ country: null, name })).resolves.toContainEqual(
      expect.objectContaining({ id: blueprint.id }),
    );

    // The evaluation model's yes is what links it, compared in the match's country.
    vi.mocked(decideExamIdentity).mockResolvedValue({ id: blueprint.id, probability: 0.9 });

    const found = await findSameExam({
      request: { board: null, country: null, language: "pt", name, ownerId: null, role: null },
      searchTerms: [],
    });

    expect(found?.id).toBe(blueprint.id);

    expect(decideExamIdentity).toHaveBeenLastCalledWith(
      expect.objectContaining({ request: expect.objectContaining({ country: "BR" }) }),
    );
  });

  it("takes an exact key match without asking the evaluation model", async () => {
    const name = `Concurso ${randomUUID()}`;

    const blueprint = await examBlueprintFixture({
      identityKey: buildExamIdentityKey({ name, ownerId: null, role: null }),
      language: "pt",
      name,
    });

    vi.mocked(decideExamIdentity).mockClear();

    const found = await findSameExam({
      request: { board: null, country: null, language: "pt", name, ownerId: null, role: null },
      searchTerms: [],
    });

    expect(found?.id).toBe(blueprint.id);
    expect(decideExamIdentity).not.toHaveBeenCalled();
  });

  it("ranks a blueprint matching a specific term first when a broad term matches too many to rank", async () => {
    const [broad, specific] = [uniqueWord(), uniqueWord()];

    await Promise.all(
      Array.from({ length: MAX_MATCHES_PER_TERM + 1 }, () =>
        examBlueprintFixture({ language: "pt", name: `Concurso ${broad}` }),
      ),
    );

    const target = await examBlueprintFixture({
      language: "pt",
      name: `Concurso ${broad} ${specific}`,
    });

    vi.mocked(decideExamIdentity).mockClear();
    vi.mocked(decideExamIdentity).mockResolvedValue(null);

    await findSameExam({
      request: {
        board: null,
        country: "BR",
        language: "pt",
        name: broad,
        ownerId: null,
        role: null,
      },
      searchTerms: [specific],
    });

    const candidates = vi.mocked(decideExamIdentity).mock.calls[0]?.[0].candidates ?? [];

    expect(candidates[0]?.id).toBe(target.id);
    expect(candidates).toHaveLength(5);
  });
});
