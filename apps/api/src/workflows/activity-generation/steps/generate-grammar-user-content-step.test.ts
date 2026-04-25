import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { fetchLessonActivities } from "@/workflows/activity-generation/steps/_utils/fetch-lesson-activities";
import { generateActivityGrammarUserContent } from "@zoonk/ai/tasks/activities/language/grammar-user-content";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateGrammarUserContentStep } from "./generate-grammar-user-content-step";

const writeMock = vi.fn().mockResolvedValue(null);

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {},
  getWorkflowMetadata: vi.fn().mockReturnValue({ workflowRunId: "test-run-id" }),
  getWritable: vi.fn().mockReturnValue({
    getWriter: () => ({ releaseLock: vi.fn(), write: writeMock }),
  }),
  workflowStep: vi.fn().mockImplementation((_name: string, fn: unknown) => fn),
}));

vi.mock("@zoonk/ai/tasks/activities/language/grammar-user-content", () => ({
  generateActivityGrammarUserContent: vi.fn().mockResolvedValue({
    data: {
      discovery: {
        context: "Look at the sentences below.",
        options: [{ feedback: "Correct!", isCorrect: true, text: "Topic marker" }],
        question: "What does は indicate?",
      },
      exampleTranslations: ["This is a cat"],
      exerciseFeedback: ["Good job!"],
      exerciseQuestions: [null],
      exerciseTranslations: ["This is a cat"],
      ruleName: "Topic marker は",
      ruleSummary: "は marks the topic of the sentence.",
    },
  }),
}));

const validUserContent = {
  discovery: {
    context: "Look at the sentences below.",
    options: [{ feedback: "Correct!", isCorrect: true, text: "Topic marker" }],
    question: "What does は indicate?",
  },
  exampleTranslations: ["This is a cat"],
  exerciseFeedback: ["Good job!"],
  exerciseQuestions: [null],
  exerciseTranslations: ["This is a cat"],
  ruleName: "Topic marker は",
  ruleSummary: "は marks the topic of the sentence.",
};

describe(generateGrammarUserContentStep, () => {
  let organizationId: string;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
    const course = await courseFixture({ organizationId, targetLanguage: "ja" });

    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Grammar UserContent Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns user content on success", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Grammar UserContent ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "grammar",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Grammar ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    const grammarContent = {
      examples: [{ highlight: "は", sentence: "これは猫です" }],
      exercises: [{ answer: "は", distractors: ["が", "を"], template: "これ[BLANK]猫です" }],
    };

    const result = await generateGrammarUserContentStep(activities, grammarContent);

    expect(result).toEqual({ userContent: validUserContent });

    expect(generateActivityGrammarUserContent).toHaveBeenCalledWith(
      expect.objectContaining({
        chapterTitle: chapter.title,
        examples: grammarContent.examples,
        exercises: grammarContent.exercises,
        targetLanguage: "ja",
        userLanguage: "en",
      }),
    );

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateGrammarUserContent" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateGrammarUserContent" }),
    );
  });

  test("returns null when no grammar activity exists", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Grammar UserContent NoAct ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "pending",
      kind: "vocabulary",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Vocab ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    const grammarContent = {
      examples: [{ highlight: "は", sentence: "test" }],
      exercises: [{ answer: "は", distractors: ["が"], template: "test[BLANK]" }],
    };

    const result = await generateGrammarUserContentStep(activities, grammarContent);

    expect(result).toEqual({ userContent: null });
    expect(generateActivityGrammarUserContent).not.toHaveBeenCalled();
  });

  test("throws AI errors without streaming an error status", async () => {
    vi.mocked(generateActivityGrammarUserContent).mockRejectedValueOnce(new Error("AI error"));

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Grammar UserContent Fail ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "grammar",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Grammar ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    const grammarContent = {
      examples: [{ highlight: "は", sentence: "test" }],
      exercises: [{ answer: "は", distractors: ["が"], template: "test[BLANK]" }],
    };

    await expect(generateGrammarUserContentStep(activities, grammarContent)).rejects.toThrow(
      "AI error",
    );

    const updated = await prisma.activity.findUniqueOrThrow({ where: { id: dbActivity.id } });
    expect(updated.generationStatus).toBe("pending");

    const events = getStreamedEvents(writeMock);

    expect(events).not.toContainEqual(
      expect.objectContaining({ status: "error", step: "generateGrammarUserContent" }),
    );
  });

  test("throws when AI returns empty result", async () => {
    vi.mocked(generateActivityGrammarUserContent).mockResolvedValueOnce(null as never);

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Grammar UserContent Empty ${randomUUID()}`,
    });

    const dbActivity = await activityFixture({
      generationStatus: "pending",
      kind: "grammar",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Grammar ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);

    const grammarContent = {
      examples: [{ highlight: "は", sentence: "test" }],
      exercises: [{ answer: "は", distractors: ["が"], template: "test[BLANK]" }],
    };

    await expect(generateGrammarUserContentStep(activities, grammarContent)).rejects.toThrow(
      "aiEmptyResult",
    );

    const updated = await prisma.activity.findUniqueOrThrow({ where: { id: dbActivity.id } });
    expect(updated.generationStatus).toBe("pending");

    const events = getStreamedEvents(writeMock);

    expect(events).not.toContainEqual(
      expect.objectContaining({ status: "error", step: "generateGrammarUserContent" }),
    );
  });
});
