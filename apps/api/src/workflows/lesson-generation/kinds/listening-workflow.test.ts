import { randomUUID } from "node:crypto";
import { assertStepContent, parseStepContent } from "@zoonk/core/steps/contract/content";
import { prisma } from "@zoonk/db";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { lessonSentenceFixture, sentenceFixture } from "@zoonk/testing/fixtures/sentences";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { beforeAll, describe, expect, it } from "vitest";
import { createLessonContext } from "../steps/_test-utils/create-lesson-context";
import { listeningLessonWorkflow } from "./listening-workflow";

describe(listeningLessonWorkflow, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  it("stores listening steps from the previous reading lesson", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    const context = await createLessonContext({
      kind: "listening",
      organizationId,
      position: 2,
      targetLanguage: "de",
    });

    const [readingLesson, sentence] = await Promise.all([
      lessonFixture({
        chapterId: context.chapterId,
        generationStatus: "completed",
        isPublished: true,
        kind: "reading",
        organizationId,
        position: 1,
      }),
      sentenceFixture({
        organizationId,
        sentence: `Guten Morgen ${uniqueId}`,
        targetLanguage: "de",
      }),
    ]);

    await Promise.all([
      lessonSentenceFixture({
        lessonId: readingLesson.id,
        sentenceId: sentence.id,
        translation: `Good morning ${uniqueId}`,
        userLanguage: "en",
      }),
      stepFixture({
        content: assertStepContent("reading", {}),
        isPublished: true,
        kind: "reading",
        lessonId: readingLesson.id,
        position: 0,
        sentenceId: sentence.id,
      }),
    ]);

    await listeningLessonWorkflow(context);

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: context.id },
    });

    expect(steps.map((step) => [step.position, step.kind, step.sentenceId])).toStrictEqual([
      [0, "listening", sentence.id],
    ]);

    expect(steps.map((step) => parseStepContent("listening", step.content))).toStrictEqual([{}]);
  });
});
