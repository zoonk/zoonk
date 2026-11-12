import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import {
  examBlueprintFixture,
  learnerSourceFixture,
  sourceFixture,
} from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { PAGE_BREAK, PDF_CONTENT_TYPE, PPTX_CONTENT_TYPE } from "../../sources/source-contract";
import { loadLessonDocuments } from "./lesson-sources";

const QUERY = "Probationary period of a public servant: how long it lasts and how it is evaluated";

const STATUTE_PAGES = [
  "Title I. Preliminary provisions. This law governs federal agencies and their budgets.",
  "Article 20. On taking office, the public servant starts a probationary period of 36 months, during which their aptitude is evaluated: attendance, discipline, initiative, productivity and responsibility.",
  "Article 41. Salary tables are published every year by the ministry.",
];

const LAW_ARTICLES = [
  "Article 1. This law governs federal agencies and their budgets.",
  "Article 20. On taking office, the public servant starts a probationary period of 36 months, during which their aptitude is evaluated.",
  "Article 21. A servant who passes the probationary period gains tenure.",
  "Article 41. Salary tables are published every year by the ministry.",
];

const DAY_MS = 86_400_000;

function statute(attrs: Parameters<typeof sourceFixture>[0] = {}) {
  return sourceFixture({
    extractedText: STATUTE_PAGES.join(PAGE_BREAK),
    mimeType: PDF_CONTENT_TYPE,
    publisher: "Planalto",
    title: "Law 8,112 of 1990",
    ...attrs,
  });
}

async function planningGoal({
  chapterId,
  examBlueprintId,
  lessonId,
}: {
  chapterId?: string;
  examBlueprintId?: string;
  lessonId?: string;
}) {
  const user = await userFixture();
  const goal = await goalFixture({ examBlueprintId, userId: user.id });
  const plan = await planFixture({ goalId: goal.id });

  await planItemFixture({ chapterId, lessonId, phase: 0, planId: plan.id, position: 0 });

  return { goal, user };
}

describe(loadLessonDocuments, () => {
  it("reads the passages of its goals' public sources that are about the lesson", async () => {
    const [lesson, law] = await Promise.all([libraryLessonFixture(), statute()]);
    const { goal, user } = await planningGoal({ lessonId: lesson.id });

    await learnerSourceFixture({
      goalId: goal.id,
      origin: "research",
      sourceId: law.id,
      userId: user.id,
    });

    const documents = await loadLessonDocuments({
      chapterId: null,
      courseId: null,
      lessonId: lesson.id,
      query: QUERY,
    });

    expect(documents.material).toStrictEqual([]);

    expect(documents.sources).toStrictEqual([
      {
        page: 2,
        ref: "S1:2",
        sourceHash: law.contentHash,
        sourceId: law.id,
        text: STATUTE_PAGES[1],
        title: "Law 8,112 of 1990",
        unit: "page",
      },
    ]);
  });

  it("keeps reading the law its screens cite after the learner whose research found it leaves", async () => {
    const [lesson, law] = await Promise.all([libraryLessonFixture(), statute()]);
    const { goal, user } = await planningGoal({ lessonId: lesson.id });

    await Promise.all([
      learnerSourceFixture({
        goalId: goal.id,
        origin: "research",
        sourceId: law.id,
        userId: user.id,
      }),
      libraryStepFixture({ lessonId: lesson.id, sourceId: law.id, sourcePage: 2 }),
    ]);

    await prisma.user.delete({ where: { id: user.id } });

    const documents = await loadLessonDocuments({
      chapterId: null,
      courseId: null,
      lessonId: lesson.id,
      query: QUERY,
    });

    expect(documents.sources.map((page) => [page.sourceId, page.text])).toStrictEqual([
      [law.id, STATUTE_PAGES[1]],
    ]);
  });

  it("keeps reading the law its screens were written from, even when no screen cites it", async () => {
    const [lesson, law] = await Promise.all([libraryLessonFixture(), statute()]);
    const step = await libraryStepFixture({ lessonId: lesson.id });

    await prisma.stepSource.create({
      data: { contentHash: law.contentHash, sourceId: law.id, stepId: step.id },
    });

    const documents = await loadLessonDocuments({
      chapterId: null,
      courseId: null,
      lessonId: lesson.id,
      query: QUERY,
    });

    expect(documents.sources.map((page) => [page.sourceId, page.text])).toStrictEqual([
      [law.id, STATUTE_PAGES[1]],
    ]);
  });

  it("never reads an exam's notice: a shared lesson is for every exam's learners", async () => {
    const chapter = await libraryChapterFixture();

    const [lesson, notice, researchedNotice, sharedUpload] = await Promise.all([
      libraryLessonFixture({ homeChapterId: chapter.id }),
      statute({ title: "Exam notice 1/2026" }),
      statute({ structure: { images: 0, pages: 3, topic: "exam" }, title: "Exam notice 2/2026" }),
      statute({ kind: "upload", title: "A notice a learner shared" }),
    ]);

    const blueprint = await examBlueprintFixture({ sourceId: notice.id });

    const { goal, user } = await planningGoal({
      chapterId: chapter.id,
      examBlueprintId: blueprint.id,
    });

    await Promise.all(
      [researchedNotice, sharedUpload].map((source) =>
        learnerSourceFixture({
          goalId: goal.id,
          origin: "research",
          sourceId: source.id,
          userId: user.id,
        }),
      ),
    );

    await expect(
      loadLessonDocuments({
        chapterId: chapter.id,
        courseId: null,
        lessonId: lesson.id,
        query: QUERY,
      }),
    ).resolves.toStrictEqual({ material: [], sources: [] });
  });

  it("leaves out private uploads, documents that state no facts and passages about other things", async () => {
    const lesson = await libraryLessonFixture();
    const { goal, user } = await planningGoal({ lessonId: lesson.id });

    const [privateNotes, syllabus, unrelated] = await Promise.all([
      statute({ kind: "upload", ownerId: user.id, visibility: "private" }),
      statute({ structure: { images: 0, pages: 3, topic: "syllabus" }, title: "A syllabus" }),
      sourceFixture({ extractedText: "Tomatoes grow best in full sun.", title: "Gardening" }),
    ]);

    await Promise.all(
      [privateNotes, syllabus, unrelated].map((source) =>
        learnerSourceFixture({
          goalId: goal.id,
          origin: "research",
          sourceId: source.id,
          userId: user.id,
        }),
      ),
    );

    await expect(
      loadLessonDocuments({ chapterId: null, courseId: null, lessonId: lesson.id, query: QUERY }),
    ).resolves.toStrictEqual({ material: [], sources: [] });
  });

  it("reads a goal's law however many newer notices and syllabi its goal holds", async () => {
    const lesson = await libraryLessonFixture();
    const { goal, user } = await planningGoal({ lessonId: lesson.id });

    const [law, ...notices] = await Promise.all([
      statute({
        fetchedAt: new Date(Date.now() - DAY_MS),
        structure: { images: 0, pages: 3, topic: "regulation" },
      }),
      ...Array.from({ length: 6 }, (_, index) =>
        statute({
          structure: { images: 0, pages: 3, topic: index % 2 === 0 ? "exam" : "syllabus" },
          title: `Exam notice ${index}`,
        }),
      ),
    ]);

    await Promise.all(
      [law, ...notices].map((source) =>
        learnerSourceFixture({
          goalId: goal.id,
          origin: "research",
          sourceId: source.id,
          userId: user.id,
        }),
      ),
    );

    const documents = await loadLessonDocuments({
      chapterId: null,
      courseId: null,
      lessonId: lesson.id,
      query: QUERY,
    });

    expect(documents.sources.map((page) => [page.sourceId, page.text])).toStrictEqual([
      [law.id, STATUTE_PAGES[1]],
    ]);
  });

  it("reads a lesson's law in the articles picked for it, ahead of six newer sources", async () => {
    const lesson = await libraryLessonFixture();
    const { goal, user } = await planningGoal({ lessonId: lesson.id });

    const [law, ...newer] = await Promise.all([
      sourceFixture({
        extractedText: LAW_ARTICLES.join("\n"),
        fetchedAt: new Date(Date.now() - DAY_MS),
        structure: { images: 0, pages: null, topic: "regulation" },
        title: "Law 8,112 of 1990",
      }),
      ...Array.from({ length: 6 }, () => statute()),
    ]);

    await Promise.all([
      prisma.lessonSource.create({
        data: { articles: ["Article 20"], lessonId: lesson.id, sourceId: law.id },
      }),
      ...[law, ...newer].map((source) =>
        learnerSourceFixture({
          goalId: goal.id,
          origin: "research",
          sourceId: source.id,
          userId: user.id,
        }),
      ),
    ]);

    const documents = await loadLessonDocuments({
      chapterId: null,
      courseId: null,
      lessonId: lesson.id,
      query: QUERY,
    });

    expect(documents.sources[0]).toStrictEqual({
      page: null,
      ref: "S1:2",
      sourceHash: law.contentHash,
      sourceId: law.id,
      text: LAW_ARTICLES[1],
      title: "Law 8,112 of 1990, Article 20",
      unit: "section",
    });

    expect(documents.sources.filter((page) => page.sourceId === law.id)).toHaveLength(1);
    expect(documents.sources.slice(1).map((page) => page.ref)).not.toContain("S1:2");
  });

  it("writes a private lesson from its owner's material alone", async () => {
    const owner = await userFixture();

    const [lesson, slides, law] = await Promise.all([
      libraryLessonFixture({ ownerId: owner.id, visibility: "private" }),
      sourceFixture({
        extractedText: ["Probation", "The probationary period lasts 36 months"].join(PAGE_BREAK),
        kind: "upload",
        mimeType: PPTX_CONTENT_TYPE,
        ownerId: owner.id,
        title: "Class 2",
        visibility: "private",
      }),
      statute(),
    ]);

    const goal = await goalFixture({ userId: owner.id });
    const plan = await planFixture({ goalId: goal.id });

    await Promise.all([
      planItemFixture({ lessonId: lesson.id, phase: 0, planId: plan.id, position: 0 }),
      learnerSourceFixture({ goalId: goal.id, sourceId: slides.id, userId: owner.id }),
      learnerSourceFixture({
        goalId: goal.id,
        origin: "research",
        sourceId: law.id,
        userId: owner.id,
      }),
    ]);

    const documents = await loadLessonDocuments({
      chapterId: null,
      courseId: null,
      lessonId: lesson.id,
      query: QUERY,
    });

    expect(documents.material.map((page) => page.sourceId)).toStrictEqual([slides.id, slides.id]);
    expect(documents.sources).toStrictEqual([]);
  });
});
