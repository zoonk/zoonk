import { randomUUID } from "node:crypto";
import { generateActivityPracticeLanguage } from "@zoonk/ai/tasks/activities/language/practice";
import { generateLanguageAudio } from "@zoonk/core/audio/generate";
import { prisma } from "@zoonk/db";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { type LessonActivity } from "../steps/get-lesson-activities-step";
import { languagePracticeActivityWorkflow } from "./language-practice-workflow";

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {},
  getWorkflowMetadata: vi.fn().mockReturnValue({ workflowRunId: "test-run-id" }),
  getWritable: vi.fn().mockReturnValue({
    getWriter: () => ({
      releaseLock: vi.fn(),
      write: vi.fn().mockResolvedValue(null),
    }),
  }),
  workflowStep: vi.fn().mockImplementation((_name: string, fn: unknown) => fn),
}));

vi.mock("@zoonk/ai/tasks/activities/language/practice", () => ({
  generateActivityPracticeLanguage: vi.fn().mockResolvedValue({
    data: {
      scenario: "You're in a Madrid bakery.",
      steps: [
        {
          context: "The clerk smiles and asks what you'd like.",
          contextRomanization: null,
          contextTranslation: "The clerk smiles.",
          options: [
            {
              feedback: "Perfectly polite.",
              isCorrect: true,
              text: "Buenos dias.",
              textRomanization: "bweh-nos dee-as",
              translation: "Good morning.",
            },
            {
              feedback: "Too abrupt.",
              isCorrect: false,
              text: "Dame cafe.",
              textRomanization: "da-me ka-fe",
              translation: "Give me coffee.",
            },
          ],
        },
      ],
    },
  }),
}));

vi.mock("@zoonk/core/audio/generate", () => ({
  generateLanguageAudio: vi
    .fn()
    .mockResolvedValue({ data: null, error: new Error("not available") }),
}));

async function fetchLessonActivities(lessonId: number): Promise<LessonActivity[]> {
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

  return activities.map((activity) => ({ ...activity, id: Number(activity.id) }));
}

describe(languagePracticeActivityWorkflow, () => {
  let organizationId: number;
  let course: Awaited<ReturnType<typeof courseFixture>>;
  let chapter: Awaited<ReturnType<typeof chapterFixture>>;

  beforeAll(async () => {
    const org = await aiOrganizationFixture();
    organizationId = org.id;
    course = await courseFixture({ organizationId, targetLanguage: "es" });
    chapter = await chapterFixture({
      courseId: course.id,
      organizationId,
      title: `LangPractice Chapter ${randomUUID()}`,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("creates language practice steps (scenario + multipleChoice) in database", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `LangPractice Steps ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "languagePractice",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Language Practice ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await languagePracticeActivityWorkflow(activities, "test-run-id", [], []);

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: activity.id },
    });

    // 1 scenario step + 1 multipleChoice step = 2 steps
    expect(steps).toHaveLength(2);

    // Scenario step (static)
    expect(steps[0]?.kind).toBe("static");
    expect(steps[0]?.content).toMatchObject({
      text: "You're in a Madrid bakery.",
      title: "Scenario",
      variant: "text",
    });
    expect(steps[0]?.position).toBe(0);

    // MultipleChoice step
    expect(steps[1]?.kind).toBe("multipleChoice");
    expect(steps[1]?.content).toMatchObject({
      context: "The clerk smiles and asks what you'd like.",
      kind: "language",
    });
    expect(steps[1]?.position).toBe(1);
  });

  test("sets language practice status to 'completed' after saving", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `LangPractice Complete ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "languagePractice",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Language Practice ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await languagePracticeActivityWorkflow(activities, "test-run-id", [], []);

    const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(dbActivity?.generationStatus).toBe("completed");
  });

  test("sets language practice status to 'failed' when AI throws", async () => {
    vi.mocked(generateActivityPracticeLanguage).mockRejectedValueOnce(new Error("AI failed"));

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `LangPractice Fail ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "languagePractice",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Language Practice ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await languagePracticeActivityWorkflow(activities, "test-run-id", [], []);

    const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(dbActivity?.generationStatus).toBe("failed");
  });

  test("converts empty romanization to null for Roman-script languages", async () => {
    vi.mocked(generateActivityPracticeLanguage).mockResolvedValueOnce({
      data: {
        scenario: "You're at a cafe in Madrid ordering breakfast.",
        steps: [
          {
            context: "Buenos días, ¿qué le pongo?",
            contextRomanization: "",
            contextTranslation: "Good morning, what can I get you?",
            options: [
              {
                feedback: "Perfectly polite and natural.",
                isCorrect: true,
                text: "Un café con leche, por favor.",
                textRomanization: "",
                translation: "A coffee with milk, please.",
              },
              {
                feedback: "Too abrupt.",
                isCorrect: false,
                text: "Dame café.",
                textRomanization: "",
                translation: "Give me coffee.",
              },
            ],
          },
        ],
      },
    } as Awaited<ReturnType<typeof generateActivityPracticeLanguage>>);

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `LangPractice EmptyRoman ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "languagePractice",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Language Practice ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await languagePracticeActivityWorkflow(activities, "test-run-id", [], []);

    const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(dbActivity?.generationStatus).toBe("completed");

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: activity.id },
    });

    expect(steps).toHaveLength(2);
    expect(steps[1]?.content).toMatchObject({
      contextRomanization: null,
      options: expect.arrayContaining([expect.objectContaining({ textRomanization: null })]),
    });
  });

  test("skips generation when activity is already completed", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `LangPractice Skip ${randomUUID()}`,
    });

    await activityFixture({
      generationStatus: "completed",
      kind: "languagePractice",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Language Practice ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await languagePracticeActivityWorkflow(activities, "test-run-id", [], []);

    expect(generateActivityPracticeLanguage).not.toHaveBeenCalled();
  });

  test("stores translation and audio fields in step content", async () => {
    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `LangPractice Fields ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "languagePractice",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Language Practice ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await languagePracticeActivityWorkflow(activities, "test-run-id", [], []);

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { activityId: activity.id, kind: "multipleChoice" },
    });

    expect(steps).toHaveLength(1);

    const content = steps[0]!.content as Record<string, unknown>;
    expect(content).toHaveProperty("contextAudioUrl");

    const options = content.options as Record<string, unknown>[];

    for (const option of options) {
      expect(option).toHaveProperty("audioUrl");
      expect(option).toHaveProperty("translation");
      expect(option.translation).toBeTypeOf("string");
      expect((option.translation as string).length).toBeGreaterThan(0);
    }
  });

  test("normalizes punctuation spacing in stored content", async () => {
    vi.mocked(generateActivityPracticeLanguage).mockResolvedValueOnce({
      data: {
        scenario: "You're at a cafe.",
        steps: [
          {
            context: "Bonjour , comment ça va ?",
            contextRomanization: null,
            contextTranslation: "Hello , how are you ?",
            options: [
              {
                feedback: "Great choice !",
                isCorrect: true,
                text: "Très bien , merci !",
                textRomanization: null,
                translation: "Very well , thank you !",
              },
              {
                feedback: "Not quite .",
                isCorrect: false,
                text: "Au revoir !",
                textRomanization: null,
                translation: "Goodbye !",
              },
            ],
          },
        ],
      },
    } as Awaited<ReturnType<typeof generateActivityPracticeLanguage>>);

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `LangPractice Punctuation ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "languagePractice",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Language Practice ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await languagePracticeActivityWorkflow(activities, "test-run-id", [], []);

    const steps = await prisma.step.findMany({
      where: { activityId: activity.id, kind: "multipleChoice" },
    });

    const content = steps[0]!.content as Record<string, unknown>;
    expect(content.context).toBe("Bonjour, comment ça va?");
    expect(content.contextTranslation).toBe("Hello, how are you?");

    const options = content.options as Record<string, unknown>[];
    expect(options[0]!.text).toBe("Très bien, merci!");
    expect(options[0]!.feedback).toBe("Great choice!");
    expect(options[0]!.translation).toBe("Very well, thank you!");
    expect(options[1]!.text).toBe("Au revoir!");
    expect(options[1]!.feedback).toBe("Not quite.");
    expect(options[1]!.translation).toBe("Goodbye!");
  });

  test("generates audio and stores URLs in step content when TTS succeeds", async () => {
    vi.mocked(generateLanguageAudio).mockResolvedValue({
      data: "https://example.com/audio.mp3",
      error: null,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `LangPractice Audio ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "languagePractice",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Language Practice ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await languagePracticeActivityWorkflow(activities, "test-run-id", [], []);

    const steps = await prisma.step.findMany({
      where: { activityId: activity.id, kind: "multipleChoice" },
    });

    const content = steps[0]!.content as Record<string, unknown>;
    expect(content.contextAudioUrl).toBe("https://example.com/audio.mp3");

    const options = content.options as Record<string, unknown>[];

    for (const option of options) {
      expect(option.audioUrl).toBe("https://example.com/audio.mp3");
    }
  });

  test("skips TTS for sentences that already have a SentenceAudio record", async () => {
    const id = randomUUID().replaceAll("-", "").slice(0, 8);
    const existingContext = `Existing context ${id}`;

    await prisma.sentenceAudio.create({
      data: {
        audioUrl: "https://example.com/existing-audio.mp3",
        organizationId,
        sentence: existingContext,
        targetLanguage: "es",
      },
    });

    vi.mocked(generateLanguageAudio).mockResolvedValue({
      data: "https://example.com/new-audio.mp3",
      error: null,
    });

    vi.mocked(generateActivityPracticeLanguage).mockResolvedValueOnce({
      data: {
        scenario: "Test scenario.",
        steps: [
          {
            context: existingContext,
            contextRomanization: null,
            contextTranslation: "Existing translation.",
            options: [
              {
                feedback: "Good.",
                isCorrect: true,
                text: `New text ${id}`,
                textRomanization: null,
                translation: "New translation.",
              },
              {
                feedback: "Bad.",
                isCorrect: false,
                text: `Other text ${id}`,
                textRomanization: null,
                translation: "Other translation.",
              },
            ],
          },
        ],
      },
    } as Awaited<ReturnType<typeof generateActivityPracticeLanguage>>);

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `LangPractice Dedup ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "languagePractice",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Language Practice ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await languagePracticeActivityWorkflow(activities, "test-run-id", [], []);

    // Should NOT call TTS for the existing context sentence
    expect(generateLanguageAudio).not.toHaveBeenCalledWith(
      expect.objectContaining({ text: existingContext }),
    );

    // Should call TTS for the new option texts
    expect(generateLanguageAudio).toHaveBeenCalledWith(
      expect.objectContaining({ text: `New text ${id}` }),
    );

    const steps = await prisma.step.findMany({
      where: { activityId: activity.id, kind: "multipleChoice" },
    });

    const content = steps[0]!.content as Record<string, unknown>;

    // Existing audio URL should be used for context
    expect(content.contextAudioUrl).toBe("https://example.com/existing-audio.mp3");

    // New audio URL should be used for option texts
    const options = content.options as Record<string, unknown>[];

    for (const option of options) {
      expect(option.audioUrl).toBe("https://example.com/new-audio.mp3");
    }
  });

  test("completes activity even when audio generation fails", async () => {
    vi.mocked(generateLanguageAudio).mockResolvedValue({
      data: null,
      error: new Error("TTS failed"),
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "language",
      organizationId,
      title: `LangPractice AudioFail ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "languagePractice",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Language Practice ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await languagePracticeActivityWorkflow(activities, "test-run-id", [], []);

    const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(dbActivity?.generationStatus).toBe("completed");
  });

  test("skips audio step for unsupported TTS language", async () => {
    const unsupportedCourse = await courseFixture({
      organizationId,
      targetLanguage: "xx",
    });

    const unsupportedChapter = await chapterFixture({
      courseId: unsupportedCourse.id,
      organizationId,
      title: `LangPractice UnsupportedLang Chapter ${randomUUID()}`,
    });

    vi.mocked(generateLanguageAudio).mockResolvedValue({
      data: "https://example.com/audio.mp3",
      error: null,
    });

    const lesson = await lessonFixture({
      chapterId: unsupportedChapter.id,
      kind: "language",
      organizationId,
      title: `LangPractice UnsupportedLang ${randomUUID()}`,
    });

    const activity = await activityFixture({
      generationStatus: "pending",
      kind: "languagePractice",
      language: "en",
      lessonId: lesson.id,
      organizationId,
      title: `Language Practice ${randomUUID()}`,
    });

    const activities = await fetchLessonActivities(lesson.id);
    await languagePracticeActivityWorkflow(activities, "test-run-id", [], []);

    // TTS should never be called for unsupported language
    expect(generateLanguageAudio).not.toHaveBeenCalled();

    // Activity should still complete
    const dbActivity = await prisma.activity.findUnique({ where: { id: activity.id } });
    expect(dbActivity?.generationStatus).toBe("completed");

    // Audio URLs should remain null
    const steps = await prisma.step.findMany({
      where: { activityId: activity.id, kind: "multipleChoice" },
    });

    const content = steps[0]!.content as Record<string, unknown>;
    expect(content.contextAudioUrl).toBeNull();
  });
});
