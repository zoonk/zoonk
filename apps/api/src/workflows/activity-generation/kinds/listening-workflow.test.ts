import { randomUUID } from "node:crypto";
import { assertStepContent } from "@zoonk/core/steps/contract/content";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { sentenceFixture } from "@zoonk/testing/fixtures/sentences";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { beforeAll, describe, expect, test } from "vitest";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { listeningActivityWorkflow } from "./listening-workflow";

async function fetchLessonActivities(lessonId: string): Promise<LessonActivity[]> {
  const activities = await prisma.activity.findMany({
    include: {
      _count: { select: { steps: true } },
      lesson: {
        include: {
          chapter: {
            include: {
              course: { include: { organization: true } },
            },
          },
        },
      },
    },
    orderBy: { position: "asc" },
    where: { lessonId },
  });

  return activities.map((activity) => ({ ...activity, id: activity.id }));
}

describe(listeningActivityWorkflow, () => {
  let organizationId: string;
  let course: Awaited<ReturnType<typeof courseFixture>>;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const org = await aiOrganizationFixture();
    organizationId = org.id;
    course = await courseFixture({ organizationId, targetLanguage: "es" });
    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Listening Chapter ${randomUUID()}`,
    });
  });

  test("copies reading steps to listening activity", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Listening Copy ${randomUUID()}`,
    });

    const readingActivity = await activityFixture({
      generationStatus: "running",
      kind: "reading",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      position: 0,
      title: `Reading ${randomUUID()}`,
    });

    const [sentence1, sentence2] = await Promise.all([
      sentenceFixture({ organizationId, sentence: `Sentence A ${randomUUID()}` }),
      sentenceFixture({ organizationId, sentence: `Sentence B ${randomUUID()}` }),
    ]);

    await Promise.all([
      stepFixture({
        activityId: readingActivity.id,
        content: assertStepContent("reading", {}),
        kind: "reading",
        position: 0,
        sentenceId: sentence1.id,
      }),
      stepFixture({
        activityId: readingActivity.id,
        content: assertStepContent("reading", {}),
        kind: "reading",
        position: 1,
        sentenceId: sentence2.id,
      }),
    ]);

    const listeningActivity = await activityFixture({
      generationStatus: "pending",
      kind: "listening",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      position: 1,
      title: `Listening ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await listeningActivityWorkflow({ allActivities: activities, workflowRunId: "test-run-id" });

    const listeningSteps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: listeningActivity.id },
    });

    expect(listeningSteps).toHaveLength(2);

    for (const step of listeningSteps) {
      expect(step.kind).toBe("listening");
      expect(step.sentenceId).not.toBeNull();
      expect(step.isPublished).toBe(true);
    }
  });

  test("sets listening status to 'completed' after copying", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Listening Complete ${randomUUID()}`,
    });

    const readingActivity = await activityFixture({
      generationStatus: "completed",
      kind: "reading",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      position: 0,
      title: `Reading ${randomUUID()}`,
    });

    const sentence = await sentenceFixture({ organizationId });

    await stepFixture({
      activityId: readingActivity.id,
      content: assertStepContent("reading", {}),
      kind: "reading",
      position: 0,
      sentenceId: sentence.id,
    });

    const listeningActivity = await activityFixture({
      generationStatus: "pending",
      kind: "listening",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      position: 1,
      title: `Listening ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await listeningActivityWorkflow({ allActivities: activities, workflowRunId: "test-run-id" });

    const dbActivity = await prisma.activity.findUnique({ where: { id: listeningActivity.id } });
    expect(dbActivity?.generationStatus).toBe("completed");
  });

  test("fails gracefully when reading activity does not exist", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Listening NoReading ${randomUUID()}`,
    });

    const listeningActivity = await activityFixture({
      generationStatus: "pending",
      kind: "listening",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Listening ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await listeningActivityWorkflow({ allActivities: activities, workflowRunId: "test-run-id" });

    const dbActivity = await prisma.activity.findUnique({ where: { id: listeningActivity.id } });
    expect(dbActivity?.generationStatus).toBe("failed");
  });
});
