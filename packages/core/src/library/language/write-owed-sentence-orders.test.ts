import { prisma } from "@zoonk/db";
import { libraryLessonsFixture } from "@zoonk/testing/fixtures/library-lessons";
import { languageLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { describe, expect, it } from "vitest";
import { listOwedSentenceOrders } from "./write-owed-sentence-orders";

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
