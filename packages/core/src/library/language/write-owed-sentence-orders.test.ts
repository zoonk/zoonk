import { prisma } from "@zoonk/db";
import { libraryLessonsFixture } from "@zoonk/testing/fixtures/library-lessons";
import { languageLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { describe, expect, it } from "vitest";
import {
  generateSentenceOrderCandidates,
  listOwedSentenceOrders,
} from "./write-owed-sentence-orders";

describe(generateSentenceOrderCandidates, () => {
  it("does not schedule or spend attempts on an owed lesson without a target language", async () => {
    const { lesson, sentence } = await languageLessonFixture();

    await prisma.lessonSentence.update({
      data: { ordersOwedAt: new Date() },
      where: { lessonId_sentenceId: { lessonId: lesson.id, sentenceId: sentence.id } },
    });

    await prisma.lesson.update({ data: { targetLanguage: null }, where: { id: lesson.id } });

    await expect(generateSentenceOrderCandidates({ lessonId: lesson.id })).resolves.toStrictEqual({
      status: "skipped",
    });

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } }),
    ).resolves.toMatchObject({ sentenceOrdersAttempts: 0 });

    await expect(listOwedSentenceOrders()).resolves.not.toContain(lesson.id);
  });
});

describe(listOwedSentenceOrders, () => {
  it("starts at most 1,000 owed lessons so a backlog of thousands drains in days", async () => {
    const [{ sentence }, lessons] = await Promise.all([
      languageLessonFixture(),
      libraryLessonsFixture(1001, { language: "pt", targetLanguage: "en" }),
    ]);

    const lessonIds = lessons.map((lesson) => lesson.id);

    try {
      await prisma.lessonSentence.createMany({
        data: lessons.map((lesson) => ({
          explanation: "Test sentence",
          lessonId: lesson.id,
          model: "test",
          ordersOwedAt: new Date("1900-01-01"),
          position: 0,
          promptVersion: "test",
          runId: "test",
          sentenceId: sentence.id,
          translation: "Quanto é o aluguel?",
        })),
      });

      await expect(listOwedSentenceOrders()).resolves.toHaveLength(1000);
    } finally {
      await prisma.lesson.deleteMany({ where: { id: { in: lessonIds } } });
    }
  });
});
