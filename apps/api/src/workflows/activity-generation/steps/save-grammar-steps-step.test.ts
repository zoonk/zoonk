import { randomUUID } from "node:crypto";
import { fetchLessonActivities } from "@/workflows/_test-utils/fetch-lesson-activities";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { saveGrammarActivityStep } from "./save-grammar-steps-step";

const writeMock = vi.fn().mockResolvedValue(null);

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {},
  getWorkflowMetadata: vi.fn().mockReturnValue({ workflowRunId: "test-run-id" }),
  getWritable: vi.fn().mockReturnValue({
    getWriter: () => ({
      releaseLock: vi.fn(),
      write: writeMock,
    }),
  }),
  workflowStep: vi.fn().mockImplementation((_name: string, fn: unknown) => fn),
}));

describe(saveGrammarActivityStep, () => {
  let organizationId: number;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId, targetLanguage: "de" });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Save Grammar Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("saves grammar steps in correct order and marks activity as completed", async () => {
    const id = randomUUID().replaceAll("-", "").slice(0, 8);

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Save Grammar ${randomUUID()}`,
    });

    const grammarActivity = await activityFixture({
      generationStatus: "pending",
      kind: "grammar",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Grammar ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    await saveGrammarActivityStep(
      activities,
      "workflow-grammar-1",
      {
        examples: [
          { highlight: `ist${id}`, sentence: `Das ist${id} gut` },
          { highlight: `war${id}`, sentence: `Das war${id} toll` },
        ],
        exercises: [
          {
            answer: `ist${id}`,
            distractors: [`war${id}`, `hat${id}`],
            template: `Das [BLANK] gut`,
          },
        ],
      },
      {
        discovery: {
          context: `Look at the examples ${id}`,
          options: [
            { feedback: "Correct!", isCorrect: true, text: `ist${id}` },
            { feedback: "Not quite", isCorrect: false, text: `war${id}` },
          ],
          question: `What verb fits? ${id}`,
        },
        exampleTranslations: [`That is${id} good`, `That was${id} great`],
        exerciseFeedback: [`Because ist${id} fits here`],
        exerciseQuestions: [`Fill in the blank ${id}`],
        exerciseTranslations: [`That is${id} good`],
        ruleName: `Present tense ${id}`,
        ruleSummary: `The verb ist${id} is used for present tense`,
      },
      null,
    );

    const [steps, dbActivity] = await Promise.all([
      prisma.step.findMany({
        orderBy: { position: "asc" },
        where: { activityId: grammarActivity.id },
      }),
      prisma.activity.findUniqueOrThrow({
        where: { id: grammarActivity.id },
      }),
    ]);

    // Step order: 2 examples (static) + 1 discovery (multipleChoice) + 1 rule (static) + 1 exercise (fillBlank)
    expect(steps).toHaveLength(5);

    expect(steps.map((step) => step.kind)).toEqual([
      "static",
      "static",
      "multipleChoice",
      "static",
      "fillBlank",
    ]);

    expect(steps.map((step) => step.position)).toEqual([0, 1, 2, 3, 4]);
    expect(steps.every((step) => step.isPublished)).toBe(true);

    expect(dbActivity).toMatchObject({
      generationRunId: "workflow-grammar-1",
      generationStatus: "completed",
    });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "saveGrammarActivity" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "saveGrammarActivity" }),
    );
  });

  test("returns silently when no grammar activity exists", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `No Grammar ${randomUUID()}`,
    });

    const explanationActivity = await activityFixture({
      generationStatus: "pending",
      kind: "explanation",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Explanation ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    await saveGrammarActivityStep(
      activities,
      "workflow-grammar-2",
      {
        examples: [{ highlight: "test", sentence: "test sentence" }],
        exercises: [{ answer: "test", distractors: ["a", "b"], template: "the [BLANK]" }],
      },
      {
        discovery: {
          context: null,
          options: [{ feedback: "ok", isCorrect: true, text: "a" }],
          question: null,
        },
        exampleTranslations: ["translated"],
        exerciseFeedback: ["feedback"],
        exerciseQuestions: ["question"],
        exerciseTranslations: ["translated exercise"],
        ruleName: "Rule",
        ruleSummary: "Summary",
      },
      null,
    );

    const steps = await prisma.step.findMany({
      where: { activityId: explanationActivity.id },
    });

    expect(steps).toHaveLength(0);
  });

  test("streams error when DB transaction fails", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Grammar Error ${randomUUID()}`,
    });

    const grammarActivity = await activityFixture({
      generationStatus: "pending",
      kind: "grammar",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Grammar Fail ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    // Delete the activity so the prisma.activity.update inside the transaction fails
    await prisma.activity.delete({ where: { id: grammarActivity.id } });

    await saveGrammarActivityStep(
      activities,
      "workflow-grammar-error",
      {
        examples: [{ highlight: "ist", sentence: "Das ist gut" }],
        exercises: [{ answer: "ist", distractors: ["war", "hat"], template: "Das [BLANK] gut" }],
      },
      {
        discovery: {
          context: "Look at the example",
          options: [
            { feedback: "Correct!", isCorrect: true, text: "ist" },
            { feedback: "Not quite", isCorrect: false, text: "war" },
          ],
          question: "What verb fits?",
        },
        exampleTranslations: ["That is good"],
        exerciseFeedback: ["Because ist fits here"],
        exerciseQuestions: ["Fill in the blank"],
        exerciseTranslations: ["That is good"],
        ruleName: "Present tense",
        ruleSummary: "The verb ist is used for present tense",
      },
      null,
    );

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "saveGrammarActivity" }),
    );
  });
});
