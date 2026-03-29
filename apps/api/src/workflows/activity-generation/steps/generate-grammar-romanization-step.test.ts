import { randomUUID } from "node:crypto";
import { fetchLessonActivities } from "@/workflows/_test-utils/fetch-lesson-activities";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { generateActivityRomanization } from "@zoonk/ai/tasks/activities/language/romanization";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { generateGrammarRomanizationStep } from "./generate-grammar-romanization-step";

const writeMock = vi.fn().mockResolvedValue(null);

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {},
  getWorkflowMetadata: vi.fn().mockReturnValue({ workflowRunId: "test-run-id" }),
  getWritable: vi.fn().mockReturnValue({
    getWriter: () => ({ releaseLock: vi.fn(), write: writeMock }),
  }),
  workflowStep: vi.fn().mockImplementation((_name: string, fn: unknown) => fn),
}));

vi.mock("@zoonk/ai/tasks/activities/language/romanization", () => ({
  generateActivityRomanization: vi.fn().mockResolvedValue({
    data: { romanizations: ["kore wa neko desu", "wa", "ga", "wo", "kore [BLANK] neko desu"] },
  }),
}));

describe(generateGrammarRomanizationStep, () => {
  let organizationId: number;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns romanizations for non-Roman script languages", async () => {
    const course = await courseFixture({ organizationId, targetLanguage: "ja" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Grammar Roman Chapter ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Grammar Roman ${randomUUID()}`,
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

    const result = await generateGrammarRomanizationStep(activities, grammarContent);

    expect(result.romanizations).not.toBeNull();
    expect(Object.keys(result.romanizations!).length).toBeGreaterThan(0);

    expect(generateActivityRomanization).toHaveBeenCalledWith(
      expect.objectContaining({ targetLanguage: "ja" }),
    );

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "started", step: "generateGrammarRomanization" }),
    );

    expect(events).toContainEqual(
      expect.objectContaining({ status: "completed", step: "generateGrammarRomanization" }),
    );
  });

  test("returns null for Roman script languages without calling AI", async () => {
    const course = await courseFixture({ organizationId, targetLanguage: "de" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Grammar Roman Skip ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Grammar Roman Skip ${randomUUID()}`,
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
      examples: [{ highlight: "der", sentence: "Der Hund" }],
      exercises: [{ answer: "der", distractors: ["die", "das"], template: "[BLANK] Hund" }],
    };

    const result = await generateGrammarRomanizationStep(activities, grammarContent);

    expect(result).toEqual({ romanizations: null });
    expect(generateActivityRomanization).not.toHaveBeenCalled();
  });

  test("returns null when no grammar activity exists", async () => {
    const course = await courseFixture({ organizationId, targetLanguage: "ja" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Grammar Roman NoAct ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Grammar Roman NoAct ${randomUUID()}`,
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

    const result = await generateGrammarRomanizationStep(activities, grammarContent);

    expect(result).toEqual({ romanizations: null });
    expect(generateActivityRomanization).not.toHaveBeenCalled();
  });

  test("streams error when AI romanization fails", async () => {
    vi.mocked(generateActivityRomanization).mockRejectedValueOnce(new Error("AI error"));

    const course = await courseFixture({ organizationId, targetLanguage: "ja" });

    const chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `Grammar Roman Fail ${randomUUID()}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `Grammar Roman Fail ${randomUUID()}`,
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

    const result = await generateGrammarRomanizationStep(activities, grammarContent);

    expect(result).toEqual({ romanizations: null });

    const events = getStreamedEvents(writeMock);

    expect(events).toContainEqual(
      expect.objectContaining({ status: "error", step: "generateGrammarRomanization" }),
    );
  });
});
