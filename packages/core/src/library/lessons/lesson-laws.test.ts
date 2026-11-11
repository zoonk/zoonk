import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { brandFixture, productFixture } from "@zoonk/testing/fixtures/products";
import { learnerSourceFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { temperatureSpec } from "../quality/_test-utils/written-lessons";
import { loadLessonDocuments } from "./_utils/lesson-sources";
import { linkLessonLaws, loadLessonLawsInput, replanUnsourcedLesson } from "./lesson-laws";

const CONFLICT_OF_INTEREST_ARTICLES = [
  "Art. 3º Para os fins desta Lei, considera-se:",
  "I - conflito de interesses: a situação gerada pelo confronto entre interesses públicos e privados, que possa comprometer o interesse coletivo ou influenciar, de maneira imprópria, o desempenho da função pública; e",
  "II - informação privilegiada: a que diz respeito a assuntos sigilosos ou aquela relevante ao processo de decisão no âmbito do Poder Executivo federal que tenha repercussão econômica ou financeira e que não seja de amplo conhecimento público.",
  "Art. 4º O ocupante de cargo ou emprego no Poder Executivo federal deve agir de modo a prevenir ou a impedir possível conflito de interesses e a resguardar informação privilegiada.",
  "§ 1º No caso de dúvida sobre como prevenir ou impedir situações que configurem conflito de interesses, o agente público deverá consultar a Comissão de Ética Pública, criada no âmbito do Poder Executivo federal, ou a Controladoria-Geral da União, conforme o disposto no parágrafo único do art. 8º desta Lei.",
  "§ 2º A ocorrência de conflito de interesses independe da existência de lesão ao patrimônio público, bem como do recebimento de qualquer vantagem ou ganho pelo agente público ou por terceiro.",
  "Art. 5º Configura conflito de interesses no exercício de cargo ou emprego no âmbito do Poder Executivo federal:",
  "I - divulgar ou fazer uso de informação privilegiada, em proveito próprio ou de terceiro, obtida em razão das atividades exercidas;",
];

/** Lei 12.813/2013 with enough other articles that the lesson can't read all of it. */
function conflictOfInterestLaw(): string {
  const others = Array.from(
    { length: 40 },
    (_, index) =>
      `Art. ${index + 6}. O agente público observará as regras de conduta e de transparência ${"previstas nesta Lei e em seu regulamento, ".repeat(6)}`,
  );

  return [
    "LEI Nº 12.813, DE 16 DE MAIO DE 2013",
    "Art. 1º As situações que configuram conflito de interesses envolvendo ocupantes de cargo ou emprego no âmbito do Poder Executivo federal regem-se pelo disposto nesta Lei.",
    "Art. 2º Submetem-se ao regime desta Lei os ocupantes dos cargos de Ministro de Estado.",
    ...CONFLICT_OF_INTEREST_ARTICLES,
    ...others,
  ].join("\n");
}

const PROMPT = {
  chapterTitle: "Ética no serviço público",
  courseTitle: "Ética e conduta na administração pública",
  isPrivate: false,
  language: "pt",
  lessonDescription:
    "Quando um agente público tem conflito de interesses e o que fazer em caso de dúvida.",
  lessonTitle: "Imparcialidade e conflito de interesses",
  skills: ["Reconhecer conflito de interesses mesmo sem prejuízo ao erário"],
};

describe(linkLessonLaws, () => {
  it("gives the lesson a hinted article whole, its caput and every paragraph", async () => {
    const [lesson, law] = await Promise.all([
      libraryLessonFixture({ language: "pt" }),
      sourceFixture({
        extractedText: conflictOfInterestLaw(),
        language: "pt",
        mimeType: "text/html",
        structure: { images: 0, pages: null, topic: "regulation" },
        title: "Lei nº 12.813, de 16 de maio de 2013",
      }),
    ]);

    expect(conflictOfInterestLaw().length).toBeGreaterThan(12_000);

    await linkLessonLaws({
      laws: [{ articles: ["4"], searchTerms: ["conflito de interesses"], sourceId: law.id }],
      lessonId: lesson.id,
      prompt: PROMPT,
    });

    const link = await prisma.lessonSource.findUniqueOrThrow({
      where: { lessonId_sourceId: { lessonId: lesson.id, sourceId: law.id } },
    });

    expect(link.articles).toContain("Art. 4º");

    const { sources } = await loadLessonDocuments({
      chapterId: null,
      courseId: null,
      lessonId: lesson.id,
      query: "",
    });

    const article = sources.find((page) => page.title.endsWith(", Art. 4º"));

    expect(article?.text).toBe(CONFLICT_OF_INTEREST_ARTICLES.slice(3, 6).join("\n"));
    expect(sources.every((page) => page.sourceId === law.id)).toBe(true);

    expect(
      sources.reduce((size, page) => size + page.text.length + page.title.length, 0),
    ).toBeLessThanOrEqual(12_000);
  });

  it("finds the article the lesson is about by its terms when no article is hinted", async () => {
    const [lesson, law] = await Promise.all([
      libraryLessonFixture({ language: "pt" }),
      sourceFixture({
        extractedText: conflictOfInterestLaw(),
        language: "pt",
        structure: { images: 0, pages: null, topic: "regulation" },
        title: "Lei nº 12.813, de 16 de maio de 2013",
      }),
    ]);

    await linkLessonLaws({
      laws: [{ articles: [], searchTerms: ["conflito de interesses"], sourceId: law.id }],
      lessonId: lesson.id,
      prompt: PROMPT,
    });

    const link = await prisma.lessonSource.findUniqueOrThrow({
      where: { lessonId_sourceId: { lessonId: lesson.id, sourceId: law.id } },
    });

    expect(link.articles).toStrictEqual(expect.arrayContaining(["Art. 3º", "Art. 4º", "Art. 5º"]));
  });

  it("checks a linked law for changes again after its checks stopped", async () => {
    const [lesson, law] = await Promise.all([
      libraryLessonFixture({ language: "pt" }),
      sourceFixture({
        extractedText: conflictOfInterestLaw(),
        language: "pt",
        mimeType: "text/html",
        nextCheckAt: null,
        structure: { images: 0, pages: null, topic: "regulation" },
        title: "Lei nº 12.813, de 16 de maio de 2013",
      }),
    ]);

    await linkLessonLaws({
      laws: [{ articles: ["4"], searchTerms: [], sourceId: law.id }],
      lessonId: lesson.id,
      prompt: PROMPT,
    });

    const source = await prisma.source.findUniqueOrThrow({ where: { id: law.id } });
    expect(source.nextCheckAt).not.toBeNull();
  });

  it("links nothing for a law whose text is gone", async () => {
    const [lesson, law] = await Promise.all([
      libraryLessonFixture({ language: "pt" }),
      sourceFixture({ extractedText: null, language: "pt" }),
    ]);

    await linkLessonLaws({
      laws: [{ articles: [], searchTerms: [], sourceId: law.id }],
      lessonId: lesson.id,
      prompt: PROMPT,
    });

    await expect(prisma.lessonSource.count({ where: { lessonId: lesson.id } })).resolves.toBe(0);
  });
});

describe(loadLessonLawsInput, () => {
  it("asks about a shared or private lesson's laws from its titles and skills", async () => {
    const chapter = await libraryChapterFixture({ title: "Ética no serviço público" });

    const lesson = await libraryLessonFixture({
      canDo: "Dizer quando há conflito de interesses",
      homeChapterId: chapter.id,
      language: "pt",
      title: "Imparcialidade e conflito de interesses",
    });

    await expect(loadLessonLawsInput(lesson.id)).resolves.toStrictEqual({
      ownerId: null,
      prompt: {
        chapterTitle: "Ética no serviço público",
        courseTitle: "Ética no serviço público",
        isPrivate: false,
        language: "pt",
        lessonCanDo: "Dizer quando há conflito de interesses",
        lessonDescription: lesson.description,
        lessonTitle: "Imparcialidade e conflito de interesses",
        skills: [],
      },
    });
  });

  it("never asks about a language, challenge, product or material lesson, or one with its laws", async () => {
    const [owner, brand, law] = await Promise.all([userFixture(), brandFixture(), sourceFixture()]);
    const product = await productFixture({ organizationId: brand.id });

    const productCourse = await courseFixture({ productId: product.id });
    const productChapter = await libraryChapterFixture({ homeCourseId: productCourse.id });

    const [language, challenge, productLesson, materialLesson, linked] = await Promise.all([
      libraryLessonFixture({ targetLanguage: "es" }),
      libraryLessonFixture({ identityKey: `chapter:x:challenge:${randomUUID()}` }),
      libraryLessonFixture({ homeChapterId: productChapter.id }),
      libraryLessonFixture({ ownerId: owner.id, visibility: "private" }),
      libraryLessonFixture(),
    ]);

    const goal = await goalFixture({ userId: owner.id });
    const plan = await planFixture({ goalId: goal.id });

    const upload = await sourceFixture({
      extractedText: "Minhas anotações de aula",
      kind: "upload",
      ownerId: owner.id,
      visibility: "private",
    });

    await Promise.all([
      planItemFixture({ lessonId: materialLesson.id, planId: plan.id }),
      learnerSourceFixture({
        goalId: goal.id,
        origin: "upload",
        sourceId: upload.id,
        userId: owner.id,
      }),
      prisma.lessonSource.create({ data: { articles: [], lessonId: linked.id, sourceId: law.id } }),
    ]);

    const inputs = await Promise.all(
      [language, challenge, productLesson, materialLesson, linked].map((lesson) =>
        loadLessonLawsInput(lesson.id),
      ),
    );

    expect(inputs).toStrictEqual([null, null, null, null, null]);
  });
});

describe(replanUnsourcedLesson, () => {
  it("plans a lesson planned from memory again once, before anything is written from it", async () => {
    const lesson = await libraryLessonFixture({
      spec: { ...temperatureSpec(), plannedAt: "2026-11-08T16:38:57.438Z" },
      specRunId: "old-run",
      specStatus: "completed",
    });

    await expect(replanUnsourcedLesson(lesson.id)).resolves.toBe(true);

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
    ).resolves.toMatchObject({ specRunId: null, specStatus: "pending" });

    await expect(replanUnsourcedLesson(lesson.id)).resolves.toBe(false);
  });

  it("never plans again a sourced plan or a lesson with screens", async () => {
    const [sourced, written] = await Promise.all([
      libraryLessonFixture({
        spec: { ...temperatureSpec(), sourcedProvisions: true },
        specStatus: "completed",
      }),
      libraryLessonFixture({ spec: temperatureSpec(), specStatus: "completed" }),
    ]);

    await libraryStepFixture({ lessonId: written.id });

    await expect(
      Promise.all([replanUnsourcedLesson(sourced.id), replanUnsourcedLesson(written.id)]),
    ).resolves.toStrictEqual([false, false]);
  });
});
