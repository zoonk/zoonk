import { prisma } from "@zoonk/db";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { sentenceFixture } from "@zoonk/testing/fixtures/sentences";
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

  it("copies reading sentence steps into listening lessons", async () => {
    const context = await createLessonContext({
      kind: "listening",
      organizationId,
      position: 2,
      targetLanguage: "de",
    });
    const [readingLesson, firstSentence, secondSentence] = await Promise.all([
      lessonFixture({
        chapterId: context.chapterId,
        generationStatus: "completed",
        isPublished: true,
        kind: "reading",
        organizationId,
        position: 1,
      }),
      sentenceFixture({ organizationId, targetLanguage: "de" }),
      sentenceFixture({ organizationId, targetLanguage: "de" }),
    ]);

    await Promise.all([
      stepFixture({
        content: {},
        kind: "reading",
        lessonId: readingLesson.id,
        position: 0,
        sentenceId: firstSentence.id,
      }),
      stepFixture({
        content: {},
        kind: "reading",
        lessonId: readingLesson.id,
        position: 1,
        sentenceId: secondSentence.id,
      }),
    ]);

    await saveListeningLessonStep(context);

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { kind: "listening", lessonId: context.id },
    });

    expect(steps.map((step) => [step.position, step.sentenceId])).toStrictEqual([
      [0, firstSentence.id],
      [1, secondSentence.id],
    ]);
  });

  it("throws when a listening lesson has no completed reading source", async () => {
    const context = await createLessonContext({
      kind: "listening",
      organizationId,
      position: 2,
      targetLanguage: "de",
    });

    await expect(saveListeningLessonStep(context)).rejects.toThrow(
      "Listening generation needs a completed reading lesson",
    );
  });
});
