import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { generateLessonExplanation } from "@zoonk/ai/tasks/lessons/core/explanation";
import { generateLessonPractice } from "@zoonk/ai/tasks/lessons/core/practice";
import { generateLessonQuiz } from "@zoonk/ai/tasks/lessons/core/quiz";
import { generateLessonAlphabet } from "@zoonk/ai/tasks/lessons/language/alphabet";
import { generateLessonDistractors } from "@zoonk/ai/tasks/lessons/language/distractors";
import { generateLessonGrammar } from "@zoonk/ai/tasks/lessons/language/grammar";
import { generateLessonPronunciation } from "@zoonk/ai/tasks/lessons/language/pronunciation";
import { generateLessonRomanization } from "@zoonk/ai/tasks/lessons/language/romanization";
import { generateLessonSentences } from "@zoonk/ai/tasks/lessons/language/sentences";
import { generateTranslation } from "@zoonk/ai/tasks/lessons/language/translation";
import { generateLessonVocabulary } from "@zoonk/ai/tasks/lessons/language/vocabulary";
import { generateLessonTutorial } from "@zoonk/ai/tasks/lessons/tutorial";
import { generateStepImagePrompts } from "@zoonk/ai/tasks/steps/image-prompts";
import { generateLanguageAudio } from "@zoonk/core/audio/generate";
import { generateContentThumbnailImage } from "@zoonk/core/content/thumbnail";
import { generateContentStepImage } from "@zoonk/core/steps/content-image";
import { assertStepContent, parseStepContent } from "@zoonk/core/steps/contract/content";
import { generateStepImage } from "@zoonk/core/steps/image";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { chapterWordFixture, wordFixture } from "@zoonk/testing/fixtures/words";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { lessonGenerationWorkflow } from "./lesson-generation-workflow";
import { type setLessonAsRunningStep } from "./steps/set-lesson-as-running-step";

type SetLessonAsRunningStepModule = { setLessonAsRunningStep: typeof setLessonAsRunningStep };

const languageMockState = vi.hoisted(() => ({
  distractors: Object.fromEntries([
    ["水", ["火", "土"]],
    ["猫", ["犬", "鳥"]],
  ]) as Record<string, string[]>,
  words: [
    { translation: "cat", word: "猫" },
    { translation: "water", word: "水" },
  ],
}));

const claimRaceMockState = vi.hoisted(() => ({
  completeBeforeClaim: null as null | ((input: { lessonId: string }) => Promise<void>),
}));

vi.mock("./steps/set-lesson-as-running-step", async () => {
  const actual = await vi.importActual<SetLessonAsRunningStepModule>(
    "./steps/set-lesson-as-running-step",
  );

  return {
    ...actual,
    setLessonAsRunningStep: vi.fn(
      async (input: Parameters<typeof actual.setLessonAsRunningStep>[0]) => {
        if (claimRaceMockState.completeBeforeClaim) {
          await claimRaceMockState.completeBeforeClaim({ lessonId: input.lessonId });
        }

        return actual.setLessonAsRunningStep(input);
      },
    ),
  };
});

vi.mock("@zoonk/ai/tasks/lessons/core/explanation", () => ({
  generateLessonExplanation: vi.fn().mockResolvedValue({
    data: {
      anchor: { text: "Apply the idea in a new case.", title: "Transfer" },
      explanation: [
        { text: "Explain the first idea.", title: "First idea" },
        { text: "Explain the second idea.", title: "Second idea" },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/lessons/core/practice", () => ({
  generateLessonPractice: vi.fn().mockResolvedValue({
    data: {
      situations: [
        {
          dialogue: "Use the situation details.",
          imagePrompt: "practice question image",
          options: [
            { feedback: "Correct.", isCorrect: true, text: "Use the rule." },
            { feedback: "Not yet.", isCorrect: false, text: "Ignore the rule." },
          ],
          question: "What should happen next?",
        },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/lessons/core/quiz", () => ({
  generateLessonQuiz: vi.fn().mockResolvedValue({
    data: {
      questions: [
        {
          format: "selectImage",
          options: [
            { feedback: "Correct.", isCorrect: true, prompt: "correct quiz option" },
            { feedback: "Not yet.", isCorrect: false, prompt: "wrong quiz option" },
          ],
          question: "Pick the correct image.",
        },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/lessons/tutorial", () => ({
  generateLessonTutorial: vi.fn().mockResolvedValue({
    data: {
      steps: [
        { text: "Open the tool settings.", title: "Open settings" },
        { text: "Save the configured project.", title: "Save project" },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/lessons/language/vocabulary", () => ({
  generateLessonVocabulary: vi.fn().mockResolvedValue({ data: { words: languageMockState.words } }),
}));

vi.mock("@zoonk/ai/tasks/lessons/language/alphabet", () => ({
  generateLessonAlphabet: vi.fn().mockResolvedValue({
    data: {
      intro: [{ text: "The vowels are あ (a) and い (i).", title: "Vowels" }],
      symbols: [
        {
          audioText: "あ",
          forms: [],
          pronunciation: "like a in father",
          readingAid: "a",
          symbol: "あ",
        },
        {
          audioText: "い",
          forms: [],
          pronunciation: "like ee in see",
          readingAid: "i",
          symbol: "い",
        },
      ],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/lessons/language/distractors", () => ({
  generateLessonDistractors: vi
    .fn()
    .mockImplementation(({ input }) =>
      Promise.resolve({ data: { distractors: languageMockState.distractors[input] ?? [] } }),
    ),
}));

vi.mock("@zoonk/ai/tasks/lessons/language/grammar", () => ({
  generateLessonGrammar: vi
    .fn()
    .mockResolvedValue({
      data: {
        examples: [{ highlight: "猫", sentence: "猫がいます", translation: "There is a cat." }],
        explanations: [
          {
            text: "Use がいます to say that a living thing exists.",
            title: "Existence with がいます",
          },
        ],
        questions: [
          {
            answer: "猫",
            distractors: ["犬", "鳥"],
            feedback: "Use the noun before the marker.",
            question: "Which noun completes the sentence?",
            template: "[BLANK]がいます",
          },
        ],
      },
    }),
}));

vi.mock("@zoonk/ai/tasks/lessons/language/sentences", () => ({
  generateLessonSentences: vi
    .fn()
    .mockResolvedValue({
      data: {
        sentences: [
          {
            explanation: "Uses both vocabulary words in context.",
            sentence: "猫と水",
            translation: "cat and water",
          },
        ],
      },
    }),
}));

vi.mock("@zoonk/ai/tasks/lessons/language/translation", () => ({
  generateTranslation: vi
    .fn()
    .mockImplementation(({ word }) =>
      Promise.resolve({ data: { translation: `${word} translated` } }),
    ),
}));

vi.mock("@zoonk/ai/tasks/lessons/language/pronunciation", () => ({
  generateLessonPronunciation: vi
    .fn()
    .mockImplementation(({ word }) =>
      Promise.resolve({ data: { pronunciation: `${word} pronunciation` } }),
    ),
}));

vi.mock("@zoonk/ai/tasks/lessons/language/romanization", () => ({
  generateLessonRomanization: vi
    .fn()
    .mockImplementation(({ texts }) =>
      Promise.resolve({
        data: { romanizations: texts.map((text: string) => `${text} romanized`) },
      }),
    ),
}));

vi.mock("@zoonk/ai/tasks/steps/image-prompts", () => ({
  generateStepImagePrompts: vi
    .fn()
    .mockImplementation(({ steps }) =>
      Promise.resolve({
        data: {
          prompts:
            steps.length === 2
              ? ["tutorial first image prompt", "tutorial second image prompt"]
              : ["first image prompt", "second image prompt", "anchor image prompt"],
        },
      }),
    ),
}));

vi.mock("@zoonk/core/steps/content-image", () => ({
  generateContentStepImage: vi
    .fn()
    .mockImplementation(({ prompt }) =>
      Promise.resolve({
        data: `https://example.com/content/${encodeURIComponent(prompt)}.webp`,
        error: null,
      }),
    ),
}));

vi.mock("@zoonk/core/audio/generate", () => ({
  generateLanguageAudio: vi
    .fn()
    .mockImplementation(({ text }) =>
      Promise.resolve({
        data: `https://example.com/audio/${encodeURIComponent(text)}.mp3`,
        error: null,
      }),
    ),
}));

vi.mock("@zoonk/core/content/thumbnail", () => ({
  generateContentThumbnailImage: vi
    .fn()
    .mockImplementation(({ title }) =>
      Promise.resolve({
        data: `https://example.com/thumbnail/${encodeURIComponent(title)}.webp`,
        error: null,
      }),
    ),
}));

vi.mock("@zoonk/core/steps/image", () => ({
  generateStepImage: vi
    .fn()
    .mockImplementation(({ prompt }) =>
      Promise.resolve({
        data: `https://example.com/select/${encodeURIComponent(prompt)}.webp`,
        error: null,
      }),
    ),
}));

/**
 * Creates the minimum published course tree a lesson-generation workflow needs.
 * Keeping this setup local prevents tests from depending on seed data or route fixtures.
 */
async function createWorkflowTree({ organizationId }: { organizationId: string }) {
  const course = await courseFixture({
    isPublished: true,
    organizationId,
    title: `Workflow Course ${randomUUID()}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId,
    title: `Workflow Chapter ${randomUUID()}`,
  });

  return { chapter, course };
}

/**
 * Language lesson workflows need a target language on the course so audio,
 * romanization, and reading/listening source lookups follow the production path.
 */
async function createLanguageWorkflowTree({ organizationId }: { organizationId: string }) {
  const uniqueId = randomUUID();

  const course = await courseFixture({
    isPublished: true,
    organizationId,
    targetLanguage: "ja",
    title: `Language Workflow Course ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId,
    title: `Language Workflow Chapter ${uniqueId}`,
  });

  return { chapter, course };
}

/**
 * Persists one completed explanation lesson with metadata. Practice and quiz
 * generation read the title and description; the static step keeps older
 * workflow assertions realistic where saved content still exists.
 */
async function completedExplanationLesson({
  chapterId,
  organizationId,
  position,
  text,
  title,
}: {
  chapterId: string;
  organizationId: string;
  position: number;
  text: string;
  title: string;
}) {
  const lesson = await lessonFixture({
    chapterId,
    description: text,
    generationStatus: "completed",
    isPublished: true,
    kind: "explanation",
    organizationId,
    position,
    title,
  });

  await stepFixture({
    content: assertStepContent("static", { text, title, variant: "text" }),
    isPublished: true,
    kind: "static",
    lessonId: lesson.id,
    position: 0,
  });

  return lesson;
}

/** Returns completed streamed step names from the current workflow test run. */
function completedStreamedSteps() {
  return getStreamedEvents()
    .filter((event) => event.status === "completed")
    .map((event) => event.step);
}

describe(lessonGenerationWorkflow, () => {
  let organizationId: string;

  beforeAll(async () => {
    const org = await aiOrganizationFixture();
    organizationId = org.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    claimRaceMockState.completeBeforeClaim = null;

    languageMockState.words.splice(
      0,
      languageMockState.words.length,
      { translation: "cat", word: "猫" },
      { translation: "water", word: "水" },
    );

    languageMockState.distractors = Object.fromEntries([
      ["水", ["火", "土"]],
      ["猫", ["犬", "鳥"]],
    ]);
  });

  it("runs the explanation image workflow and saves images on static steps", async () => {
    const { chapter } = await createWorkflowTree({ organizationId });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      kind: "explanation",
      organizationId,
      title: `Explanation Lesson ${randomUUID()}`,
    });

    await lessonGenerationWorkflow(lesson.id);

    expect(generateLessonExplanation).toHaveBeenCalledOnce();
    expect(generateStepImagePrompts).toHaveBeenCalledOnce();
    expect(generateContentStepImage).toHaveBeenCalledTimes(3);

    expect(completedStreamedSteps()).toStrictEqual(
      expect.arrayContaining([
        "generateExplanationContent",
        "generateImagePrompts",
        "generateStepImages",
        "saveExplanationLesson",
        "generateLessonImage",
        "setLessonAsCompleted",
      ]),
    );

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: lesson.id },
    });

    const contents = steps.map((step) => parseStepContent("static", step.content));
    const imageUrls = contents.map((content) => content.image?.url);

    expect(steps).toHaveLength(3);

    expect(imageUrls).toStrictEqual([
      "https://example.com/content/first%20image%20prompt.webp",
      "https://example.com/content/second%20image%20prompt.webp",
      "https://example.com/content/anchor%20image%20prompt.webp",
    ]);

    const dbLesson = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });
    expect(dbLesson.generationStatus).toBe("completed");
    expect(dbLesson.generationRunId).toBe("test-run-id");

    expect(dbLesson.imageUrl).toBe(
      `https://example.com/thumbnail/${encodeURIComponent(lesson.title ?? "")}.webp`,
    );

    expect(generateContentThumbnailImage).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "lesson" }),
    );
  });

  it("runs the tutorial image workflow and saves generated procedural steps", async () => {
    const { chapter } = await createWorkflowTree({ organizationId });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      kind: "tutorial",
      organizationId,
      title: `Tutorial Lesson ${randomUUID()}`,
    });

    await lessonGenerationWorkflow(lesson.id);

    expect(generateLessonTutorial).toHaveBeenCalledOnce();

    expect(generateStepImagePrompts).toHaveBeenCalledWith(
      expect.objectContaining({
        steps: [
          { text: "Open the tool settings.", title: "Open settings" },
          { text: "Save the configured project.", title: "Save project" },
        ],
      }),
    );

    expect(generateContentStepImage).toHaveBeenCalledTimes(2);

    expect(completedStreamedSteps()).toStrictEqual(
      expect.arrayContaining([
        "generateTutorialContent",
        "generateImagePrompts",
        "generateStepImages",
        "saveTutorialLesson",
        "setLessonAsCompleted",
      ]),
    );

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: lesson.id },
    });

    const contents = steps.map((step) => parseStepContent("static", step.content));

    expect(contents.map((content) => ("title" in content ? content.title : null))).toStrictEqual([
      "Open settings",
      "Save project",
    ]);

    expect(contents.map((content) => content.image?.url)).toStrictEqual([
      "https://example.com/content/tutorial%20first%20image%20prompt.webp",
      "https://example.com/content/tutorial%20second%20image%20prompt.webp",
    ]);
  });

  it("practice generation uses the nearest previous explanation", async () => {
    const { chapter } = await createWorkflowTree({ organizationId });

    const [practice] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "pending",
        isPublished: true,
        kind: "practice",
        organizationId,
        position: 3,
        title: `Practice Lesson ${randomUUID()}`,
      }),
      completedExplanationLesson({
        chapterId: chapter.id,
        organizationId,
        position: 0,
        text: "Old explanation",
        title: "Old",
      }),
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        kind: "practice",
        organizationId,
        position: 1,
        title: `Completed Practice ${randomUUID()}`,
      }),
      completedExplanationLesson({
        chapterId: chapter.id,
        organizationId,
        position: 2,
        text: "New explanation",
        title: "New",
      }),
    ]);

    await lessonGenerationWorkflow(practice.id);

    expect(generateLessonPractice).toHaveBeenCalledWith(
      expect.objectContaining({ lesson: { description: "New explanation", title: "New" } }),
    );

    expect(generateContentStepImage).toHaveBeenCalledWith(
      expect.objectContaining({ preset: "practice", prompt: "practice question image" }),
    );

    expect(completedStreamedSteps()).toStrictEqual(
      expect.arrayContaining([
        "generatePracticeContent",
        "generateStepImages",
        "savePracticeLesson",
        "setLessonAsCompleted",
      ]),
    );

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: practice.id },
    });

    const question = parseStepContent("multipleChoice", steps[0]?.content);

    expect(steps.map((step) => [step.position, step.kind])).toStrictEqual([[0, "multipleChoice"]]);

    expect(question.image?.url).toBe(
      "https://example.com/content/practice%20question%20image.webp",
    );

    const dbLesson = await prisma.lesson.findUniqueOrThrow({ where: { id: practice.id } });

    expect(dbLesson.imageUrl).toBeNull();
    expect(dbLesson.description).toBe(practice.description);
    expect(dbLesson.title).toBe(practice.title);
    expect(generateContentThumbnailImage).not.toHaveBeenCalled();
  });

  it("practice generation uses source lesson metadata before explanations complete", async () => {
    const { chapter } = await createWorkflowTree({ organizationId });

    vi.mocked(generateLessonPractice).mockClear();

    const [practice] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "pending",
        isPublished: true,
        kind: "practice",
        organizationId,
        position: 2,
        title: `Blocked Practice ${randomUUID()}`,
      }),
      completedExplanationLesson({
        chapterId: chapter.id,
        organizationId,
        position: 0,
        text: "Generated explanation",
        title: "Generated",
      }),
      lessonFixture({
        chapterId: chapter.id,
        description: "Pending explanation metadata",
        generationStatus: "pending",
        isPublished: true,
        kind: "explanation",
        organizationId,
        position: 1,
        title: `Pending Explanation ${randomUUID()}`,
      }),
    ]);

    await expect(lessonGenerationWorkflow(practice.id)).resolves.toBe("ready");

    expect(generateLessonPractice).toHaveBeenCalledWith(
      expect.objectContaining({
        lesson: { description: "Pending explanation metadata", title: expect.any(String) },
      }),
    );

    const dbLesson = await prisma.lesson.findUniqueOrThrow({ where: { id: practice.id } });
    const steps = await prisma.step.findMany({ where: { lessonId: practice.id } });

    expect(dbLesson.generationStatus).toBe("completed");
    expect(dbLesson.generationRunId).toBe("test-run-id");
    expect(dbLesson.description).toBe(practice.description);
    expect(dbLesson.title).toBe(practice.title);
    expect(steps.length).toBeGreaterThan(0);
  });

  it("quiz generation uses the nearest previous explanation and saves select-image URLs", async () => {
    const { chapter } = await createWorkflowTree({ organizationId });

    const [quiz] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "pending",
        isPublished: true,
        kind: "quiz",
        organizationId,
        position: 3,
        title: `Quiz Lesson ${randomUUID()}`,
      }),
      completedExplanationLesson({
        chapterId: chapter.id,
        organizationId,
        position: 0,
        text: "Already quizzed explanation",
        title: "Old Quiz Scope",
      }),
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        kind: "quiz",
        organizationId,
        position: 1,
        title: `Completed Quiz ${randomUUID()}`,
      }),
      completedExplanationLesson({
        chapterId: chapter.id,
        organizationId,
        position: 2,
        text: "Unquizzed explanation",
        title: "New Quiz Scope",
      }),
    ]);

    await lessonGenerationWorkflow(quiz.id);

    expect(generateLessonQuiz).toHaveBeenCalledWith(
      expect.objectContaining({
        lesson: { description: "Unquizzed explanation", title: "New Quiz Scope" },
      }),
    );

    expect(generateStepImage).toHaveBeenCalledTimes(2);

    expect(completedStreamedSteps()).toStrictEqual(
      expect.arrayContaining([
        "generateQuizContent",
        "generateQuizImages",
        "saveQuizLesson",
        "setLessonAsCompleted",
      ]),
    );

    const [step] = await prisma.step.findMany({ where: { lessonId: quiz.id } });
    const content = parseStepContent("selectImage", step?.content);

    expect(content.options.map((option) => option.url)).toStrictEqual([
      "https://example.com/select/correct%20quiz%20option.webp",
      "https://example.com/select/wrong%20quiz%20option.webp",
    ]);
  });

  it("vocabulary generation keeps audio, pronunciation, romanization, and distractor enrichment", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const catWord = `猫-${uniqueId}`;
    const waterWord = `水-${uniqueId}`;
    const dogWord = `犬-${uniqueId}`;
    const birdWord = `鳥-${uniqueId}`;
    const fireWord = `火-${uniqueId}`;
    const earthWord = `土-${uniqueId}`;
    const targetWords = [catWord, waterWord];
    const distractorWords = [dogWord, birdWord, fireWord, earthWord];
    const allRenderedWords = [...targetWords, ...distractorWords];

    languageMockState.words.splice(
      0,
      languageMockState.words.length,
      { translation: `cat ${uniqueId}`, word: catWord },
      { translation: `water ${uniqueId}`, word: waterWord },
    );

    languageMockState.distractors = {
      [catWord]: [dogWord, birdWord],
      [waterWord]: [fireWord, earthWord],
    };

    const course = await courseFixture({
      isPublished: true,
      organizationId,
      targetLanguage: "ja",
      title: `Language Workflow Course ${uniqueId}`,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId,
      title: `Language Workflow Chapter ${uniqueId}`,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      kind: "vocabulary",
      organizationId,
      position: 0,
      title: `Vocabulary Lesson ${uniqueId}`,
    });

    const translationLesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      kind: "translation",
      organizationId,
      position: 1,
      title: `Translation Lesson ${uniqueId}`,
    });

    await lessonGenerationWorkflow(lesson.id);

    expect(generateLessonVocabulary).toHaveBeenCalledOnce();
    expect(generateLessonDistractors).toHaveBeenCalledTimes(2);
    expect(generateLanguageAudio).toHaveBeenCalledTimes(6);
    expect(generateLessonPronunciation).toHaveBeenCalledTimes(6);

    expect(generateLessonRomanization).toHaveBeenCalledWith(
      expect.objectContaining({ targetLanguage: "ja", texts: allRenderedWords }),
    );

    expect(completedStreamedSteps()).toStrictEqual(
      expect.arrayContaining([
        "generateVocabularyContent",
        "generateVocabularyDistractors",
        "generateVocabularyPronunciation",
        "generateVocabularyAudio",
        "generateVocabularyRomanization",
        "saveVocabularyLesson",
        "saveTranslationLesson",
        "setLessonAsCompleted",
      ]),
    );

    const lessonWords = await prisma.chapterWord.findMany({
      include: { word: { include: { pronunciations: true } } },
      orderBy: { word: { word: "asc" } },
      where: { sourceLessonId: lesson.id },
    });

    const words = lessonWords
      .map((row) => ({
        audioUrl: row.word.audioUrl,
        distractors: row.distractors,
        pronunciation: row.word.pronunciations[0]?.pronunciation,
        romanization: row.word.romanization,
        translation: row.translation,
        word: row.word.word,
      }))
      .toSorted((a, b) => a.translation.localeCompare(b.translation));

    expect(words).toStrictEqual([
      {
        audioUrl: `https://example.com/audio/${encodeURIComponent(catWord)}.mp3`,
        distractors: [dogWord, birdWord],
        pronunciation: `${catWord} pronunciation`,
        romanization: `${catWord} romanized`,
        translation: `cat ${uniqueId}`,
        word: catWord,
      },
      {
        audioUrl: `https://example.com/audio/${encodeURIComponent(waterWord)}.mp3`,
        distractors: [fireWord, earthWord],
        pronunciation: `${waterWord} pronunciation`,
        romanization: `${waterWord} romanized`,
        translation: `water ${uniqueId}`,
        word: waterWord,
      },
    ]);

    const translationSteps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: translationLesson.id },
    });

    expect(translationSteps.map((step) => step.kind)).toStrictEqual(["translation", "translation"]);

    const dbTranslationLesson = await prisma.lesson.findUniqueOrThrow({
      where: { id: translationLesson.id },
    });

    expect(dbTranslationLesson.generationStatus).toBe("completed");
  });

  it("alphabet generation saves writing-system cards and a final matching drill without vocabulary rows", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const { chapter } = await createLanguageWorkflowTree({ organizationId });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      kind: "alphabet",
      organizationId,
      title: `Alphabet Lesson ${uniqueId}`,
    });

    await lessonGenerationWorkflow(lesson.id);

    expect(generateLessonAlphabet).toHaveBeenCalledOnce();
    expect(generateLessonVocabulary).not.toHaveBeenCalled();

    expect(completedStreamedSteps()).toStrictEqual(
      expect.arrayContaining([
        "generateAlphabetContent",
        "generateAlphabetAudio",
        "saveAlphabetLesson",
        "setLessonAsCompleted",
      ]),
    );

    const [steps, lessonWords] = await Promise.all([
      prisma.step.findMany({ orderBy: { position: "asc" }, where: { lessonId: lesson.id } }),
      prisma.chapterWord.findMany({ where: { sourceLessonId: lesson.id } }),
    ]);

    expect(lessonWords).toStrictEqual([]);

    expect(steps.map((step) => [step.position, step.kind])).toStrictEqual([
      [0, "static"],
      [1, "alphabet"],
      [2, "alphabet"],
      [3, "matchColumns"],
    ]);

    expect(parseStepContent("static", steps[0]?.content)).toStrictEqual({
      text: "The vowels are あ (a) and い (i).",
      title: "Vowels",
      variant: "text",
    });

    expect(parseStepContent("alphabet", steps[1]?.content)).toMatchObject({
      audioUrl: "https://example.com/audio/%E3%81%82.mp3",
      readingAid: "a",
      symbol: "あ",
    });

    expect(parseStepContent("matchColumns", steps[3]?.content)).toStrictEqual({
      pairs: [
        { left: "あ", right: "a" },
        { left: "い", right: "i" },
      ],
    });
  });

  it("translation lessons are not standalone workflow targets", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const { chapter } = await createLanguageWorkflowTree({ organizationId });

    const translationLesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      kind: "translation",
      organizationId,
      position: 1,
      title: `Translation Lesson ${uniqueId}`,
    });

    await expect(lessonGenerationWorkflow(translationLesson.id)).resolves.toBe("filtered");

    const steps = await prisma.step.findMany({ where: { lessonId: translationLesson.id } });

    expect(steps).toStrictEqual([]);
    expect(completedStreamedSteps()).not.toContain("saveTranslationLesson");
  });

  it("completed vocabulary generation repairs a pending translation companion", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const { chapter } = await createLanguageWorkflowTree({ organizationId });

    const [vocabularyLesson, word] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        kind: "vocabulary",
        organizationId,
        position: 0,
        title: `Vocabulary Source ${uniqueId}`,
      }),
      wordFixture({ organizationId, targetLanguage: "ja", word: `猫-${uniqueId}` }),
    ]);

    const [translationLesson, chapterWord] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "pending",
        isPublished: true,
        kind: "translation",
        organizationId,
        position: 1,
        title: `Translation Lesson ${uniqueId}`,
      }),
      chapterWordFixture({
        sourceLessonId: vocabularyLesson.id,
        translation: `cat ${uniqueId}`,
        userLanguage: "en",
        wordId: word.id,
      }),
    ]);

    await stepFixture({
      chapterWordId: chapterWord.id,
      content: assertStepContent("vocabulary", {}),
      isPublished: true,
      kind: "vocabulary",
      lessonId: vocabularyLesson.id,
      position: 0,
      wordId: word.id,
    });

    await lessonGenerationWorkflow(vocabularyLesson.id);

    expect(generateLessonVocabulary).not.toHaveBeenCalled();

    expect(completedStreamedSteps()).toStrictEqual(
      expect.arrayContaining(["saveTranslationLesson", "setLessonAsCompleted"]),
    );

    const [translationStep] = await prisma.step.findMany({
      where: { lessonId: translationLesson.id },
    });

    expect(translationStep?.kind).toBe("translation");
    expect(translationStep?.chapterWordId).toBe(chapterWord.id);
    expect(translationStep?.wordId).toBe(word.id);

    const dbTranslationLesson = await prisma.lesson.findUniqueOrThrow({
      where: { id: translationLesson.id },
    });

    expect(dbTranslationLesson.generationStatus).toBe("completed");
  });

  it("reading generation uses vocabulary lesson metadata and saves enriched sentences", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const { chapter } = await createLanguageWorkflowTree({ organizationId });

    const vocabularyLesson = await lessonFixture({
      chapterId: chapter.id,
      description: `Reading source description ${uniqueId}`,
      generationStatus: "pending",
      isPublished: true,
      kind: "vocabulary",
      organizationId,
      position: 0,
      title: `Reading Source ${uniqueId}`,
    });

    const readingLesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      kind: "reading",
      organizationId,
      position: 1,
      title: `Reading Lesson ${uniqueId}`,
    });

    const listeningLesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      kind: "listening",
      organizationId,
      position: 2,
      title: `Listening Lesson ${uniqueId}`,
    });

    await lessonGenerationWorkflow(readingLesson.id);

    expect(generateLessonSentences).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceLessons: [
          {
            description: `Reading source description ${uniqueId}`,
            title: `Reading Source ${uniqueId}`,
          },
        ],
      }),
    );

    expect(vocabularyLesson.generationStatus).toBe("pending");

    expect(generateTranslation).toHaveBeenCalledWith(expect.objectContaining({ word: "猫" }));
    expect(generateTranslation).toHaveBeenCalledWith(expect.objectContaining({ word: "水" }));

    expect(completedStreamedSteps()).toStrictEqual(
      expect.arrayContaining([
        "generateReadingContent",
        "generateReadingAudio",
        "generateReadingRomanization",
        "generateSentenceDistractors",
        "generateSentenceWordMetadata",
        "generateSentenceWordAudio",
        "generateSentenceWordPronunciation",
        "saveReadingLesson",
        "saveListeningLesson",
        "setLessonAsCompleted",
      ]),
    );

    const [readingStep] = await prisma.step.findMany({
      include: { sentence: true },
      where: { lessonId: readingLesson.id },
    });

    const sentenceLink = await prisma.chapterSentence.findFirst({
      where: { sourceLessonId: readingLesson.id },
    });

    expect(readingStep?.kind).toBe("reading");
    expect(readingStep?.sentence?.sentence).toBe("猫と水");
    expect(sentenceLink?.translation).toBe("cat and water");

    const [listeningStep] = await prisma.step.findMany({ where: { lessonId: listeningLesson.id } });

    expect(listeningStep?.kind).toBe("listening");
    expect(listeningStep?.chapterSentenceId).toBe(readingStep?.chapterSentenceId);
    expect(listeningStep?.sentenceId).toBe(readingStep?.sentenceId);

    const dbListeningLesson = await prisma.lesson.findUniqueOrThrow({
      where: { id: listeningLesson.id },
    });

    expect(dbListeningLesson.generationStatus).toBe("completed");
  });

  it("listening lessons are not standalone workflow targets", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const { chapter } = await createLanguageWorkflowTree({ organizationId });

    const listeningLesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      kind: "listening",
      organizationId,
      position: 1,
      title: `Listening Lesson ${uniqueId}`,
    });

    await expect(lessonGenerationWorkflow(listeningLesson.id)).resolves.toBe("filtered");

    const steps = await prisma.step.findMany({ where: { lessonId: listeningLesson.id } });

    expect(steps).toStrictEqual([]);
    expect(completedStreamedSteps()).not.toContain("saveListeningLesson");
  });

  it("grammar generation keeps content, romanization, and saving phases", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const { chapter } = await createLanguageWorkflowTree({ organizationId });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      kind: "grammar",
      organizationId,
      title: `Grammar Lesson ${uniqueId}`,
    });

    await lessonGenerationWorkflow(lesson.id);

    expect(generateLessonGrammar).toHaveBeenCalledOnce();

    expect(generateLessonRomanization).toHaveBeenCalledWith(
      expect.objectContaining({ texts: expect.arrayContaining(["猫がいます", "猫", "犬", "鳥"]) }),
    );

    expect(completedStreamedSteps()).toStrictEqual(
      expect.arrayContaining([
        "generateGrammar",
        "generateGrammarRomanization",
        "saveGrammarLesson",
        "setLessonAsCompleted",
      ]),
    );

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: lesson.id },
    });

    expect(steps.map((step) => step.kind)).toStrictEqual(["static", "static", "fillBlank"]);
  });

  it("repairs a pending lesson with existing steps without calling AI", async () => {
    const { chapter } = await createWorkflowTree({ organizationId });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      kind: "explanation",
      organizationId,
      title: `Repair Lesson ${randomUUID()}`,
    });

    await stepFixture({
      content: assertStepContent("static", {
        text: "Already saved.",
        title: "Saved",
        variant: "text",
      }),
      isPublished: true,
      kind: "static",
      lessonId: lesson.id,
      position: 0,
    });

    await lessonGenerationWorkflow(lesson.id);

    expect(generateLessonExplanation).not.toHaveBeenCalled();

    const dbLesson = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });
    expect(dbLesson.generationStatus).toBe("completed");

    const completionEvent = getStreamedEvents().find(
      (event) => event.step === "setLessonAsCompleted" && event.status === "completed",
    );

    expect(completionEvent).toBeDefined();
  });

  it("streams completion when another run completes before this run claims the lesson", async () => {
    const { chapter } = await createWorkflowTree({ organizationId });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      kind: "explanation",
      organizationId,
      title: `Claim Race Lesson ${randomUUID()}`,
    });

    claimRaceMockState.completeBeforeClaim = async ({ lessonId }) => {
      await stepFixture({
        content: assertStepContent("static", {
          text: "Saved by another workflow run.",
          title: "Already complete",
          variant: "text",
        }),
        isPublished: true,
        kind: "static",
        lessonId,
        position: 0,
      });

      await prisma.lesson.update({
        data: { generationStatus: "completed" },
        where: { id: lessonId },
      });
    };

    await expect(lessonGenerationWorkflow(lesson.id)).resolves.toBe("ready");

    expect(generateLessonExplanation).not.toHaveBeenCalled();
    expect(completedStreamedSteps()).toContain("setLessonAsCompleted");
  });

  it("regenerates failed lessons with leftover steps instead of repairing them", async () => {
    const { chapter } = await createWorkflowTree({ organizationId });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "failed",
      isPublished: true,
      kind: "explanation",
      organizationId,
      title: `Failed Lesson ${randomUUID()}`,
    });

    await stepFixture({
      content: assertStepContent("static", {
        text: "Partial stale output.",
        title: "Stale",
        variant: "text",
      }),
      isPublished: true,
      kind: "static",
      lessonId: lesson.id,
      position: 0,
    });

    await lessonGenerationWorkflow(lesson.id);

    expect(generateLessonExplanation).toHaveBeenCalledOnce();

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: lesson.id },
    });

    const contents = steps.map((step) => parseStepContent("static", step.content));

    expect(contents.map((content) => ("title" in content ? content.title : null))).toStrictEqual([
      "First idea",
      "Second idea",
      "Transfer",
    ]);

    const dbLesson = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });
    expect(dbLesson.generationStatus).toBe("completed");
    expect(dbLesson.generationRunId).toBe("test-run-id");
  });
});
