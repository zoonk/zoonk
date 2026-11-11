import { randomUUID } from "node:crypto";
import { decideLibraryIdentity } from "@zoonk/ai/tasks/identity/decision";
import { generateSearchTerms } from "@zoonk/ai/tasks/identity/search-terms";
import { type LessonLaw, generateLessonLaws } from "@zoonk/ai/tasks/lesson-laws";
import { generateLessonSpec } from "@zoonk/ai/tasks/lesson-spec";
import { judgePicture } from "@zoonk/ai/tasks/lesson-spec/picture-need";
import { writeLessonDraft } from "@zoonk/ai/tasks/lesson-writer";
import { checkLessonQuality } from "@zoonk/ai/tasks/quality/lesson-check";
import { findOfficialSources } from "@zoonk/ai/tasks/research/find-official-sources";
import { readLawLookup, recordLawLookup } from "@zoonk/core/library/sources/laws";
import { prisma } from "@zoonk/db";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  libraryLessonFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { sourceFixture } from "@zoonk/testing/fixtures/sources";
import { Response as PageResponse, fetch } from "undici";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sleep } from "workflow";
import { getRun } from "workflow/api";
import { HookConflictError } from "workflow/errors";
import { recordedLessonFixture } from "../_test-utils/recorded-lesson";
import { recordedOutput, taskResult } from "../_test-utils/recorded-outputs";
import { getStartMock } from "../_test-utils/start-mock";
import { lawSourceWorkflow } from "../research/law-source-workflow";
import { lessonContentWorkflow } from "./lesson-content-workflow";
import { readLessonLaws } from "./read-lesson-laws";

type RecordedSpec = Awaited<ReturnType<typeof generateLessonSpec>>["data"];
type RecordedDraft = Awaited<ReturnType<typeof writeLessonDraft>>["data"];

const recordedSpec = recordedOutput<RecordedSpec>("lesson-spec");
const recordedDraft = recordedOutput<RecordedDraft>("lesson-draft");

const ARTICLE_4 = [
  "Art. 4º O ocupante de cargo ou emprego no Poder Executivo federal deve agir de modo a prevenir ou a impedir possível conflito de interesses e a resguardar informação privilegiada.",
  "§ 1º No caso de dúvida sobre como prevenir ou impedir situações que configurem conflito de interesses, o agente público deverá consultar a Comissão de Ética Pública ou a Controladoria-Geral da União.",
  "§ 2º A ocorrência de conflito de interesses independe da existência de lesão ao patrimônio público, bem como do recebimento de qualquer vantagem ou ganho pelo agente público ou por terceiro.",
].join("\n");

const LAW_TEXT = [
  "LEI Nº 12.813, DE 16 DE MAIO DE 2013",
  "Art. 1º As situações que configuram conflito de interesses envolvendo ocupantes de cargo ou emprego no âmbito do Poder Executivo federal regem-se pelo disposto nesta Lei.",
  "Art. 3º Para os fins desta Lei, considera-se conflito de interesses a situação gerada pelo confronto entre interesses públicos e privados.",
  ARTICLE_4,
  "Art. 5º Configura conflito de interesses no exercício de cargo ou emprego no âmbito do Poder Executivo federal divulgar informação privilegiada.",
].join("\n");

function conflictOfInterestLaw(attrs: Partial<LessonLaw> = {}): LessonLaw {
  const word = `zq${randomUUID().replaceAll("-", "").slice(0, 10)}`;

  return {
    articles: ["4"],
    country: "BR",
    language: "pt",
    name: `Lei nº 12.813/2013 ${word}`,
    officialDomains: ["planalto.gov.br"],
    queries: [`lei 12.813 ${word}`],
    searchTerms: ["conflito de interesses", word],
    ...attrs,
  };
}

function nameLaws(laws: LessonLaw[]) {
  vi.mocked(generateLessonLaws).mockResolvedValue(taskResult({ laws }));
}

function lawSource() {
  return sourceFixture({
    extractedText: LAW_TEXT,
    language: "pt",
    structure: { images: 0, pages: null, topic: "regulation" },
    title: "Lei nº 12.813, de 16 de maio de 2013",
    url: `https://www.planalto.gov.br/ccivil_03/${randomUUID()}.htm`,
  });
}

async function plannedLesson(spec: object) {
  const chapter = await libraryChapterFixture({ title: "How vaccines train the immune system" });

  const lesson = await recordedLessonFixture({
    homeChapterId: chapter.id,
    level: "overview",
    spec,
    specStatus: "completed",
  });

  await chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id });
  return lesson;
}

function writtenSources(): (string | undefined)[] {
  return vi.mocked(writeLessonDraft).mock.calls.map(([input]) => input.sources);
}

describe(readLessonLaws, () => {
  beforeEach(() => {
    vi.mocked(generateLessonSpec).mockResolvedValue(taskResult(recordedSpec));
    vi.mocked(judgePicture).mockResolvedValue(true);
    vi.mocked(writeLessonDraft).mockResolvedValue(taskResult(recordedDraft));

    vi.mocked(checkLessonQuality).mockResolvedValue(
      taskResult({ issues: [] }, "anthropic/claude-opus-5.5"),
    );
  });

  it("writes a planned lesson from a law looked up before, with no search", async () => {
    const [lesson, source] = await Promise.all([
      plannedLesson({ ...recordedSpec.lessons[0], sourcedProvisions: true }),
      lawSource(),
    ]);

    const law = conflictOfInterestLaw();
    nameLaws([law]);
    await recordLawLookup({ law, sourceId: source.id });

    await expect(lessonContentWorkflow({ lessonId: lesson.id })).resolves.toMatchObject({
      status: "ready",
    });

    expect(generateLessonSpec).not.toHaveBeenCalled();
    expect(findOfficialSources).not.toHaveBeenCalled();
    expect(decideLibraryIdentity).not.toHaveBeenCalled();

    expect(getStartMock().mock.calls.map(([workflow]) => workflow)).not.toContain(
      lawSourceWorkflow,
    );

    expect(writtenSources()).toStrictEqual([expect.stringContaining(ARTICLE_4)]);
  });

  it("plans a lesson planned from memory again once when its law has no official text", async () => {
    const lesson = await plannedLesson(recordedSpec.lessons[0] ?? {});
    const law = conflictOfInterestLaw();
    nameLaws([law]);
    await recordLawLookup({ law, sourceId: null });
    vi.mocked(writeLessonDraft).mockRejectedValueOnce(new Error("Provider unavailable"));

    await expect(lessonContentWorkflow({ lessonId: lesson.id })).rejects.toThrow(
      "Provider unavailable",
    );

    await expect(lessonContentWorkflow({ lessonId: lesson.id })).resolves.toMatchObject({
      status: "ready",
    });

    expect(generateLessonSpec).toHaveBeenCalledOnce();
    expect(findOfficialSources).not.toHaveBeenCalled();
    expect(writtenSources()).toStrictEqual([undefined, undefined]);
  });

  it("writes the lesson without laws when they can't be named", async () => {
    const lesson = await plannedLesson({ ...recordedSpec.lessons[0], sourcedProvisions: true });
    vi.mocked(generateLessonLaws).mockRejectedValue(new Error("Provider unavailable"));

    await expect(lessonContentWorkflow({ lessonId: lesson.id })).resolves.toMatchObject({
      status: "ready",
    });

    expect(writeLessonDraft).toHaveBeenCalledOnce();
  });

  it("looks a law up once for sibling lessons naming it at once", async () => {
    const [first, second] = await Promise.all([
      libraryLessonFixture({ language: "pt" }),
      libraryLessonFixture({ language: "pt" }),
    ]);

    const law = conflictOfInterestLaw();
    const address = `https://www.planalto.gov.br/ccivil_03/${randomUUID()}.htm`;
    const holders = new Map<string, string>();
    const finished = new Set<string>();

    vi.mocked(generateLessonLaws)
      .mockResolvedValueOnce(taskResult({ laws: [law] }))
      .mockResolvedValueOnce(
        taskResult({ laws: [{ ...law, name: ` ${law.name.toUpperCase()} ` }] }),
      );

    vi.mocked(findOfficialSources).mockResolvedValue(
      taskResult({
        board: null,
        documents: [
          {
            documentType: "law",
            kind: "official",
            publisher: "Presidência da República",
            reason: "The law's consolidated text",
            title: `Lei nº 12.813 ${randomUUID()}`,
            url: address,
          },
        ],
        officialFound: true,
        searchCalls: 1,
      }),
    );

    vi.mocked(fetch).mockResolvedValue(
      new PageResponse(LAW_TEXT, { headers: { "content-type": "text/plain" } }),
    );

    vi.mocked(generateSearchTerms).mockImplementation(async ({ subjects }) =>
      taskResult({ subjects: subjects.map(() => ({ terms: [randomUUID().slice(0, 8)] })) }),
    );

    vi.mocked(decideLibraryIdentity).mockImplementation(async ({ candidates }) => {
      const verdicts = candidates.map((candidate) => ({
        id: candidate.id,
        model: "test/jev",
        probability: candidate.item.url === address ? 0.9 : 0.1,
      }));

      return { match: verdicts.find((verdict) => verdict.probability > 0.5) ?? null, verdicts };
    });

    vi.mocked(getRun).mockImplementation(
      (runId: string) =>
        ({
          exists: Promise.resolve(true),
          status: Promise.resolve(finished.has(runId) ? "completed" : "running"),
        }) as never,
    );

    vi.mocked(sleep).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(resolve, 10);
        }),
    );

    getStartMock().mockImplementation(async (_workflow, _args, options) => {
      const token = options?.experimental_hook?.token ?? "";
      const holder = holders.get(token);

      if (holder) {
        throw new HookConflictError(token, holder);
      }

      const runId = `law-run-${holders.size}`;
      holders.set(token, runId);
      const { country, language, name, officialDomains, queries, searchTerms } = law;

      await lawSourceWorkflow({
        law: { country, language, name, officialDomains, queries, searchTerms },
      });

      finished.add(runId);

      return { runId } as never;
    });

    await Promise.all(
      [first, second].map((lesson) =>
        readLessonLaws({ lessonId: lesson.id, workflowRunId: `run-${lesson.id}` }),
      ),
    );

    const lookup = await readLawLookup(law);

    const links = await prisma.lessonSource.findMany({
      select: { articles: true, lessonId: true, sourceId: true },
      where: { lessonId: { in: [first.id, second.id] } },
    });

    expect(findOfficialSources).toHaveBeenCalledOnce();
    expect(getStartMock()).toHaveBeenCalledTimes(2);

    expect(
      [first.id, second.id].map((lessonId) => links.find((link) => link.lessonId === lessonId)),
    ).toStrictEqual([
      {
        articles: expect.arrayContaining(["Art. 4º"]),
        lessonId: first.id,
        sourceId: lookup?.sourceId,
      },
      {
        articles: expect.arrayContaining(["Art. 4º"]),
        lessonId: second.id,
        sourceId: lookup?.sourceId,
      },
    ]);
  });
});
