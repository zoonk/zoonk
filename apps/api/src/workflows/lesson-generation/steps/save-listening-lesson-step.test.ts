import { prisma } from "@zoonk/db";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { chapterSentenceFixture, sentenceFixture } from "@zoonk/testing/fixtures/sentences";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { beforeAll, describe, expect, it } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { saveListeningLessonStep } from "./save-listening-lesson-step";

describe(saveListeningLessonStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  it("copies reading sentence steps into the listening companion lesson", async () => {
    const context = await createLessonContext({
      kind: "reading",
      organizationId,
      position: 1,
      targetLanguage: "de",
    });

    const [listeningLesson, firstSentence, secondSentence] = await Promise.all([
      lessonFixture({
        chapterId: context.chapterId,
        generationStatus: "pending",
        isPublished: true,
        kind: "listening",
        organizationId,
        position: 2,
      }),
      sentenceFixture({ organizationId, targetLanguage: "de" }),
      sentenceFixture({ organizationId, targetLanguage: "de" }),
    ]);

    const [firstChapterSentence, secondChapterSentence] = await Promise.all([
      chapterSentenceFixture({ sentenceId: firstSentence.id, sourceLessonId: context.id }),
      chapterSentenceFixture({ sentenceId: secondSentence.id, sourceLessonId: context.id }),
    ]);

    await Promise.all([
      stepFixture({
        chapterSentenceId: firstChapterSentence.id,
        content: {},
        kind: "reading",
        lessonId: context.id,
        position: 0,
        sentenceId: firstSentence.id,
      }),
      stepFixture({
        chapterSentenceId: secondChapterSentence.id,
        content: {},
        kind: "reading",
        lessonId: context.id,
        position: 1,
        sentenceId: secondSentence.id,
      }),
    ]);

    await saveListeningLessonStep(context);

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { kind: "listening", lessonId: listeningLesson.id },
    });

    expect(
      steps.map((step) => [step.position, step.sentenceId, step.chapterSentenceId]),
    ).toStrictEqual([
      [0, firstSentence.id, firstChapterSentence.id],
      [1, secondSentence.id, secondChapterSentence.id],
    ]);

    const dbListeningLesson = await prisma.lesson.findUniqueOrThrow({
      where: { id: listeningLesson.id },
    });

    expect(dbListeningLesson.generationStatus).toBe("completed");
  });

  it("does nothing when reading has no listening companion", async () => {
    const context = await createLessonContext({
      kind: "reading",
      organizationId,
      position: 1,
      targetLanguage: "de",
    });

    await expect(saveListeningLessonStep(context)).resolves.toBeUndefined();
  });
});
