import { randomUUID } from "node:crypto";
import { getStreamedEvents } from "@/workflows/_test-utils/parse-stream-events";
import { generateLessonExplanation } from "@zoonk/ai/tasks/lessons/core/explanation";
import { generateLessonPractice } from "@zoonk/ai/tasks/lessons/core/practice";
import { generateLessonQuiz } from "@zoonk/ai/tasks/lessons/core/quiz";
import { generateLessonDistractors } from "@zoonk/ai/tasks/lessons/language/distractors";
import { generateLessonGrammarContent } from "@zoonk/ai/tasks/lessons/language/grammar-content";
import { generateLessonGrammarUserContent } from "@zoonk/ai/tasks/lessons/language/grammar-user-content";
import { generateLessonPronunciation } from "@zoonk/ai/tasks/lessons/language/pronunciation";
import { generateLessonRomanization } from "@zoonk/ai/tasks/lessons/language/romanization";
import { generateLessonSentences } from "@zoonk/ai/tasks/lessons/language/sentences";
import { generateTranslation } from "@zoonk/ai/tasks/lessons/language/translation";
import { generateLessonVocabulary } from "@zoonk/ai/tasks/lessons/language/vocabulary";
import { generateLessonTutorial } from "@zoonk/ai/tasks/lessons/tutorial";
import { generateStepImagePrompts } from "@zoonk/ai/tasks/steps/image-prompts";
import { generateLanguageAudio } from "@zoonk/core/audio/generate";
import { generateContentStepImage } from "@zoonk/core/steps/content-image";
import { assertStepContent, parseStepContent } from "@zoonk/core/steps/contract/content";
import { generateStepImage } from "@zoonk/core/steps/image";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { lessonSentenceFixture, sentenceFixture } from "@zoonk/testing/fixtures/sentences";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { lessonWordFixture, wordFixture } from "@zoonk/testing/fixtures/words";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { lessonGenerationWorkflow } from "./lesson-generation-workflow";

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
      scenario: {
        imagePrompt: "practice scenario image",
        text: "A concrete situation for applying the explanations.",
        title: "Scenario",
      },
      steps: [
        {
          context: "Use the scenario details.",
          imagePrompt: "practice question image",
          options: [
            { feedback: "Correct.", isCorrect: true, text: "Use the rule." },
            { feedback: "Not yet.", isCorrect: false, text: "Ignore the rule." },
          ],
          question: "What should happen next?",
        },
      ],
      title: "Practice",
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
  generateLessonVocabulary: vi.fn().mockResolvedValue({
    data: {
      words: languageMockState.words,
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/lessons/language/distractors", () => ({
  generateLessonDistractors: vi.fn().mockImplementation(({ input }) =>
    Promise.resolve({
      data: { distractors: languageMockState.distractors[input] ?? [] },
    }),
  ),
}));

vi.mock("@zoonk/ai/tasks/lessons/language/grammar-content", () => ({
  generateLessonGrammarContent: vi.fn().mockResolvedValue({
    data: {
      examples: [{ highlight: "猫", sentence: "猫がいます" }],
      exercises: [{ answer: "猫", distractors: ["犬", "鳥"], template: "[BLANK]がいます" }],
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/lessons/language/grammar-user-content", () => ({
  generateLessonGrammarUserContent: vi.fn().mockResolvedValue({
    data: {
      discovery: {
        context: "Choose the sentence with the same pattern.",
        options: [
          { feedback: "Correct.", isCorrect: true, text: "It keeps the subject marker." },
          { feedback: "Not quite.", isCorrect: false, text: "It changes the marker." },
        ],
        question: "Which option matches the pattern?",
      },
      exampleTranslations: ["There is a cat."],
      exerciseFeedback: ["Use the noun before the marker."],
      exerciseQuestions: ["Which noun completes the sentence?"],
      exerciseTranslations: ["There is a cat."],
      ruleName: "Existence with がいます",
      ruleSummary: "Use がいます to say that a living thing exists.",
    },
  }),
}));

vi.mock("@zoonk/ai/tasks/lessons/language/sentences", () => ({
  generateLessonSentences: vi.fn().mockResolvedValue({
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
  generateTranslation: vi.fn().mockImplementation(({ word }) =>
    Promise.resolve({
      data: { translation: `${word} translated` },
    }),
  ),
}));

vi.mock("@zoonk/ai/tasks/lessons/language/pronunciation", () => ({
  generateLessonPronunciation: vi.fn().mockImplementation(({ word }) =>
    Promise.resolve({
      data: { pronunciation: `${word} pronunciation` },
    }),
  ),
}));

vi.mock("@zoonk/ai/tasks/lessons/language/romanization", () => ({
  generateLessonRomanization: vi.fn().mockImplementation(({ texts }) =>
    Promise.resolve({
      data: { romanizations: texts.map((text: string) => `${text} romanized`) },
    }),
  ),
}));

vi.mock("@zoonk/ai/tasks/steps/image-prompts", () => ({
  generateStepImagePrompts: vi.fn().mockImplementation(({ steps }) =>
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
  generateContentStepImage: vi.fn().mockImplementation(({ prompt }) =>
    Promise.resolve({
      data: `https://example.com/content/${encodeURIComponent(prompt)}.webp`,
      error: null,
    }),
  ),
}));

vi.mock("@zoonk/core/audio/generate", () => ({
  generateLanguageAudio: vi.fn().mockImplementation(({ text }) =>
    Promise.resolve({
      data: `https://example.com/audio/${encodeURIComponent(text)}.mp3`,
      error: null,
    }),
  ),
}));

vi.mock("@zoonk/core/steps/image", () => ({
  generateStepImage: vi.fn().mockImplementation(({ prompt }) =>
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
 * Persists one completed explanation lesson so practice and quiz generation
 * can read the same static steps they use in production.
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
    generationStatus: "completed",
    isPublished: true,
    kind: "explanation",
    organizationId,
    position,
    title: `Explanation ${randomUUID()}`,
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

  test("runs the explanation image workflow and saves images on static steps", async () => {
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
    expect(completedStreamedSteps()).toEqual(
      expect.arrayContaining([
        "generateExplanationContent",
        "generateImagePrompts",
        "generateStepImages",
        "saveExplanationLesson",
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
    expect(imageUrls).toEqual([
      "https://example.com/content/first%20image%20prompt.webp",
      "https://example.com/content/second%20image%20prompt.webp",
      "https://example.com/content/anchor%20image%20prompt.webp",
    ]);

    const dbLesson = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });
    expect(dbLesson.generationStatus).toBe("completed");
    expect(dbLesson.generationRunId).toBe("test-run-id");
  });

  test("runs the tutorial image workflow and saves generated procedural steps", async () => {
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
    expect(completedStreamedSteps()).toEqual(
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

    expect(contents.map((content) => ("title" in content ? content.title : null))).toEqual([
      "Open settings",
      "Save project",
    ]);
    expect(contents.map((content) => content.image?.url)).toEqual([
      "https://example.com/content/tutorial%20first%20image%20prompt.webp",
      "https://example.com/content/tutorial%20second%20image%20prompt.webp",
    ]);
  });

  test("practice generation uses only explanation steps since the previous practice", async () => {
    const { chapter } = await createWorkflowTree({ organizationId });

    await completedExplanationLesson({
      chapterId: chapter.id,
      organizationId,
      position: 0,
      text: "Old explanation",
      title: "Old",
    });
    await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      kind: "practice",
      organizationId,
      position: 1,
      title: `Completed Practice ${randomUUID()}`,
    });
    await completedExplanationLesson({
      chapterId: chapter.id,
      organizationId,
      position: 2,
      text: "New explanation",
      title: "New",
    });
    const practice = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      kind: "practice",
      organizationId,
      position: 3,
      title: `Practice Lesson ${randomUUID()}`,
    });

    await lessonGenerationWorkflow(practice.id);

    expect(generateLessonPractice).toHaveBeenCalledWith(
      expect.objectContaining({
        explanationSteps: [{ text: "New explanation", title: "New" }],
      }),
    );
    expect(generateContentStepImage).toHaveBeenCalledWith(
      expect.objectContaining({
        preset: "practice",
        prompt: "practice scenario image",
      }),
    );
    expect(completedStreamedSteps()).toEqual(
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
    const intro = parseStepContent("static", steps[0]?.content);
    const question = parseStepContent("multipleChoice", steps[1]?.content);

    expect(intro.variant).toBe("intro");
    expect(intro.image?.url).toBe("https://example.com/content/practice%20scenario%20image.webp");
    expect(question.image?.url).toBe(
      "https://example.com/content/practice%20question%20image.webp",
    );
  });

  test("quiz generation uses explanations since the previous quiz and saves select-image URLs", async () => {
    const { chapter } = await createWorkflowTree({ organizationId });

    await completedExplanationLesson({
      chapterId: chapter.id,
      organizationId,
      position: 0,
      text: "Already quizzed explanation",
      title: "Old Quiz Scope",
    });
    await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      kind: "quiz",
      organizationId,
      position: 1,
      title: `Completed Quiz ${randomUUID()}`,
    });
    await completedExplanationLesson({
      chapterId: chapter.id,
      organizationId,
      position: 2,
      text: "Unquizzed explanation",
      title: "New Quiz Scope",
    });
    const quiz = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      kind: "quiz",
      organizationId,
      position: 3,
      title: `Quiz Lesson ${randomUUID()}`,
    });

    await lessonGenerationWorkflow(quiz.id);

    expect(generateLessonQuiz).toHaveBeenCalledWith(
      expect.objectContaining({
        explanationSteps: [{ text: "Unquizzed explanation", title: "New Quiz Scope" }],
      }),
    );
    expect(generateStepImage).toHaveBeenCalledTimes(2);
    expect(completedStreamedSteps()).toEqual(
      expect.arrayContaining([
        "generateQuizContent",
        "generateQuizImages",
        "saveQuizLesson",
        "setLessonAsCompleted",
      ]),
    );

    const [step] = await prisma.step.findMany({ where: { lessonId: quiz.id } });
    const content = parseStepContent("selectImage", step?.content);

    expect(content.options.map((option) => option.url)).toEqual([
      "https://example.com/select/correct%20quiz%20option.webp",
      "https://example.com/select/wrong%20quiz%20option.webp",
    ]);
  });

  test("vocabulary generation keeps audio, pronunciation, romanization, and distractor enrichment", async () => {
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
      title: `Vocabulary Lesson ${uniqueId}`,
    });

    await lessonGenerationWorkflow(lesson.id);

    expect(generateLessonVocabulary).toHaveBeenCalledOnce();
    expect(generateLessonDistractors).toHaveBeenCalledTimes(2);
    expect(generateLanguageAudio).toHaveBeenCalledTimes(6);
    expect(generateLessonPronunciation).toHaveBeenCalledTimes(6);
    expect(generateLessonRomanization).toHaveBeenCalledWith(
      expect.objectContaining({
        targetLanguage: "ja",
        texts: allRenderedWords,
      }),
    );
    expect(completedStreamedSteps()).toEqual(
      expect.arrayContaining([
        "generateVocabularyContent",
        "generateVocabularyDistractors",
        "generateVocabularyPronunciation",
        "generateVocabularyAudio",
        "generateVocabularyRomanization",
        "saveVocabularyLesson",
        "setLessonAsCompleted",
      ]),
    );

    const lessonWords = await prisma.lessonWord.findMany({
      include: {
        word: {
          include: { pronunciations: true },
        },
      },
      orderBy: { word: { word: "asc" } },
      where: { lessonId: lesson.id },
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

    expect(words).toEqual([
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
  });

  test("translation generation creates translation steps from the previous vocabulary lesson", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const { chapter } = await createLanguageWorkflowTree({ organizationId });
    const vocabularyLesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      kind: "vocabulary",
      organizationId,
      position: 0,
      title: `Vocabulary Source ${uniqueId}`,
    });
    const word = await wordFixture({
      organizationId,
      targetLanguage: "ja",
      word: `猫-${uniqueId}`,
    });

    await lessonWordFixture({
      lessonId: vocabularyLesson.id,
      translation: `cat ${uniqueId}`,
      userLanguage: "en",
      wordId: word.id,
    });
    await stepFixture({
      content: assertStepContent("vocabulary", {}),
      isPublished: true,
      kind: "vocabulary",
      lessonId: vocabularyLesson.id,
      position: 0,
      wordId: word.id,
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

    await lessonGenerationWorkflow(translationLesson.id);

    expect(completedStreamedSteps()).toEqual(
      expect.arrayContaining(["saveTranslationLesson", "setLessonAsCompleted"]),
    );

    const [translationStep] = await prisma.step.findMany({
      where: { lessonId: translationLesson.id },
    });

    expect(translationStep?.kind).toBe("translation");
    expect(translationStep?.wordId).toBe(word.id);
    expect(parseStepContent("translation", translationStep?.content)).toEqual({});
  });

  test("reading generation uses vocabulary since the previous reading and saves enriched sentences", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const { chapter } = await createLanguageWorkflowTree({ organizationId });
    const vocabularyLesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      kind: "vocabulary",
      organizationId,
      position: 0,
      title: `Reading Source ${uniqueId}`,
    });
    const [catWord, waterWord] = await Promise.all([
      wordFixture({ organizationId, targetLanguage: "ja", word: `猫-${uniqueId}` }),
      wordFixture({ organizationId, targetLanguage: "ja", word: `水-${uniqueId}` }),
    ]);

    await Promise.all([
      lessonWordFixture({
        lessonId: vocabularyLesson.id,
        translation: `cat ${uniqueId}`,
        userLanguage: "en",
        wordId: catWord.id,
      }),
      lessonWordFixture({
        lessonId: vocabularyLesson.id,
        translation: `water ${uniqueId}`,
        userLanguage: "en",
        wordId: waterWord.id,
      }),
    ]);

    const readingLesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      kind: "reading",
      organizationId,
      position: 1,
      title: `Reading Lesson ${uniqueId}`,
    });

    await lessonGenerationWorkflow(readingLesson.id);

    expect(generateLessonSentences).toHaveBeenCalledWith(
      expect.objectContaining({
        words: expect.arrayContaining([catWord.word, waterWord.word]),
      }),
    );
    expect(generateTranslation).toHaveBeenCalledWith(expect.objectContaining({ word: "猫" }));
    expect(generateTranslation).toHaveBeenCalledWith(expect.objectContaining({ word: "水" }));
    expect(completedStreamedSteps()).toEqual(
      expect.arrayContaining([
        "generateReadingContent",
        "generateReadingAudio",
        "generateReadingRomanization",
        "generateSentenceDistractors",
        "generateSentenceWordMetadata",
        "generateSentenceWordAudio",
        "generateSentenceWordPronunciation",
        "saveReadingLesson",
        "setLessonAsCompleted",
      ]),
    );

    const [readingStep] = await prisma.step.findMany({
      include: { sentence: true },
      where: { lessonId: readingLesson.id },
    });
    const sentenceLink = await prisma.lessonSentence.findFirst({
      where: { lessonId: readingLesson.id },
    });

    expect(readingStep?.kind).toBe("reading");
    expect(readingStep?.sentence?.sentence).toBe("猫と水");
    expect(sentenceLink?.translation).toBe("cat and water");
  });

  test("listening generation copies sentence steps from the previous reading lesson", async () => {
    const uniqueId = randomUUID().slice(0, 8);
    const { chapter } = await createLanguageWorkflowTree({ organizationId });
    const readingLesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      kind: "reading",
      organizationId,
      position: 0,
      title: `Reading Source ${uniqueId}`,
    });
    const sentence = await sentenceFixture({
      organizationId,
      sentence: `猫と水 ${uniqueId}`,
      targetLanguage: "ja",
    });

    await lessonSentenceFixture({
      lessonId: readingLesson.id,
      sentenceId: sentence.id,
      translation: `cat and water ${uniqueId}`,
      userLanguage: "en",
    });
    await stepFixture({
      content: assertStepContent("reading", {}),
      isPublished: true,
      kind: "reading",
      lessonId: readingLesson.id,
      position: 0,
      sentenceId: sentence.id,
    });

    const listeningLesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      kind: "listening",
      organizationId,
      position: 1,
      title: `Listening Lesson ${uniqueId}`,
    });

    await lessonGenerationWorkflow(listeningLesson.id);

    expect(completedStreamedSteps()).toEqual(
      expect.arrayContaining(["saveListeningLesson", "setLessonAsCompleted"]),
    );

    const [listeningStep] = await prisma.step.findMany({
      where: { lessonId: listeningLesson.id },
    });

    expect(listeningStep?.kind).toBe("listening");
    expect(listeningStep?.sentenceId).toBe(sentence.id);
    expect(parseStepContent("listening", listeningStep?.content)).toEqual({});
  });

  test("grammar generation keeps content, user-language exercises, romanization, and saving phases", async () => {
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

    expect(generateLessonGrammarContent).toHaveBeenCalledOnce();
    expect(generateLessonGrammarUserContent).toHaveBeenCalledWith(
      expect.objectContaining({
        examples: [{ highlight: "猫", sentence: "猫がいます" }],
      }),
    );
    expect(generateLessonRomanization).toHaveBeenCalledWith(
      expect.objectContaining({
        texts: expect.arrayContaining(["猫がいます", "猫", "犬", "鳥"]),
      }),
    );
    expect(completedStreamedSteps()).toEqual(
      expect.arrayContaining([
        "generateGrammarContent",
        "generateGrammarUserContent",
        "generateGrammarRomanization",
        "saveGrammarLesson",
        "setLessonAsCompleted",
      ]),
    );

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: lesson.id },
    });

    expect(steps.map((step) => step.kind)).toEqual([
      "static",
      "multipleChoice",
      "static",
      "fillBlank",
    ]);
  });

  test("repairs a pending lesson with existing steps without calling AI", async () => {
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

  test("regenerates failed lessons with leftover steps instead of repairing them", async () => {
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

    expect(contents.map((content) => ("title" in content ? content.title : null))).toEqual([
      "First idea",
      "Second idea",
      "Transfer",
    ]);

    const dbLesson = await prisma.lesson.findUniqueOrThrow({ where: { id: lesson.id } });
    expect(dbLesson.generationStatus).toBe("completed");
    expect(dbLesson.generationRunId).toBe("test-run-id");
  });
});
