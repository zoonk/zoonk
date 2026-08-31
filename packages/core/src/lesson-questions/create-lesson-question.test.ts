import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { chapterSentenceFixture, sentenceFixture } from "@zoonk/testing/fixtures/sentences";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { chapterWordFixture, wordFixture } from "@zoonk/testing/fixtures/words";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import {
  parseLessonQuestionContextSnapshot,
  toDatabaseLessonQuestionContextSnapshot,
} from "./_utils/context-snapshot-schema";
import { createLessonQuestion } from "./create-lesson-question";
import { getLessonQuestionThread } from "./get-lesson-question-thread";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

async function createPublishedCurriculum({
  lessonKind = "quiz",
  subscribed = true,
}: { lessonKind?: "quiz" | "review"; subscribed?: boolean } = {}) {
  const [organization, user] = await Promise.all([
    organizationFixture({ kind: "brand" }),
    userFixture(),
  ]);

  const [course] = await Promise.all([
    courseFixture({
      description: "A server-owned course description",
      isPublished: true,
      language: "en",
      organizationId: organization.id,
      targetLanguage: "de",
      title: "German foundations",
    }),
    subscribed
      ? prisma.subscription.create({
          data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
        })
      : Promise.resolve(null),
  ]);

  const chapter = await chapterFixture({
    courseId: course.id,
    description: "A server-owned chapter description",
    isPublished: true,
    organizationId: organization.id,
    position: 0,
    title: "Introductions",
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    description: "A server-owned lesson description",
    isPublished: true,
    kind: lessonKind,
    organizationId: organization.id,
    title: "Say hello",
  });

  return { chapter, course, lesson, organization, user };
}

const multipleChoiceContent = {
  context: "Choose the natural greeting.",
  options: [
    { feedback: "Exactly.", id: "hallo", isCorrect: true, text: "Hallo" },
    { feedback: "That is a farewell.", id: "tschuss", isCorrect: false, text: "Tschuss" },
  ],
  question: "How do you say hello?",
};

describe(createLessonQuestion, () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("does not create question history for a guest", async () => {
    const { lesson } = await createPublishedCurriculum();

    const result = await createLessonQuestion({
      input: {
        context: { kind: "lesson" },
        question: "Can you summarize this?",
        requestId: randomUUID(),
      },
      lessonId: lesson.id,
    });

    expect(result).toStrictEqual({ status: "unauthorized" });

    await expect(
      prisma.lessonQuestionThread.count({ where: { lessonId: lesson.id } }),
    ).resolves.toBe(0);
  });

  it("requires an active subscription even for the first chapter", async () => {
    const { lesson, user } = await createPublishedCurriculum({ subscribed: false });
    mockSession(user.id);

    const input = {
      context: { kind: "lesson" as const },
      question: "Can you summarize this?",
      requestId: randomUUID(),
    };

    await expect(createLessonQuestion({ input, lessonId: lesson.id })).resolves.toStrictEqual({
      status: "subscriptionRequired",
    });

    await expect(
      prisma.lessonQuestionThread.count({ where: { lessonId: lesson.id, userId: user.id } }),
    ).resolves.toBe(0);
  });

  it("returns one durable question for concurrent request replays", async () => {
    const { lesson, user } = await createPublishedCurriculum();

    const input = {
      context: { kind: "lesson" as const },
      question: "Can you summarize this?",
      requestId: randomUUID(),
    };

    mockSession(user.id);

    const [first, replay] = await Promise.all([
      createLessonQuestion({ input, lessonId: lesson.id }),
      createLessonQuestion({ input, lessonId: lesson.id }),
    ]);

    expect(first.status).toBe("created");
    expect(replay.status).toBe("created");

    if (first.status !== "created" || replay.status !== "created") {
      throw new Error("Expected both request replays to resolve the durable question");
    }

    expect(replay.question).toStrictEqual(first.question);

    await expect(
      prisma.lessonQuestion.count({ where: { thread: { lessonId: lesson.id, userId: user.id } } }),
    ).resolves.toBe(1);
  });

  it("atomically rejects a second unfinished turn", async () => {
    const { lesson, user } = await createPublishedCurriculum();
    mockSession(user.id);

    const [first, second] = await Promise.all([
      createLessonQuestion({
        input: {
          context: { kind: "lesson" },
          question: "What is the first example?",
          requestId: randomUUID(),
        },
        lessonId: lesson.id,
      }),
      createLessonQuestion({
        input: {
          context: { kind: "lesson" },
          question: "What is the second example?",
          requestId: randomUUID(),
        },
        lessonId: lesson.id,
      }),
    ]);

    expect([first.status, second.status].toSorted()).toStrictEqual(["conflict", "created"]);

    await expect(
      prisma.lessonQuestion.findMany({
        where: { thread: { lessonId: lesson.id, userId: user.id } },
      }),
    ).resolves.toHaveLength(1);
  });

  it("rejects request ID reuse with a different selected answer", async () => {
    const { lesson, user } = await createPublishedCurriculum();

    const content = {
      ...multipleChoiceContent,
      options: [
        ...multipleChoiceContent.options,
        {
          feedback: "That greeting is too formal for this example.",
          id: "guten-tag",
          isCorrect: false,
          text: "Guten Tag",
        },
      ],
    };

    const step = await stepFixture({
      content,
      isPublished: true,
      kind: "multipleChoice",
      lessonId: lesson.id,
    });

    const requestId = randomUUID();
    mockSession(user.id);

    const first = await createLessonQuestion({
      input: {
        context: {
          answer: { kind: "multipleChoice", selectedOptionId: "tschuss" },
          kind: "answer",
          stepId: step.id,
          stepNumber: 1,
        },
        question: "Why was my answer wrong?",
        requestId,
      },
      lessonId: lesson.id,
    });

    const conflict = await createLessonQuestion({
      input: {
        context: {
          answer: { kind: "multipleChoice", selectedOptionId: "guten-tag" },
          kind: "answer",
          stepId: step.id,
          stepNumber: 1,
        },
        question: "Why was my answer wrong?",
        requestId,
      },
      lessonId: lesson.id,
    });

    expect(first.status).toBe("created");
    expect(conflict).toStrictEqual({ status: "conflict" });

    await expect(
      prisma.lessonQuestion.count({ where: { thread: { lessonId: lesson.id, userId: user.id } } }),
    ).resolves.toBe(1);
  });

  it("keeps one lesson thread and snapshots authoritative lesson and step context", async () => {
    const { lesson, user } = await createPublishedCurriculum();

    const step = await stepFixture({
      content: multipleChoiceContent,
      isPublished: true,
      kind: "multipleChoice",
      lessonId: lesson.id,
      position: 2,
    });

    mockSession(user.id);

    const stepQuestion = await createLessonQuestion({
      input: {
        context: { kind: "step", stepId: step.id, stepNumber: 1 },
        question: "Why is this natural?",
        requestId: randomUUID(),
      },
      lessonId: lesson.id,
    });

    if (stepQuestion.status !== "created") {
      throw new Error("Expected the step question to be created");
    }

    await prisma.lessonQuestion.update({
      data: { answer: "Because it matches this context.", status: "completed" },
      where: { id: stepQuestion.question.id },
    });

    const lessonQuestion = await createLessonQuestion({
      input: {
        context: { kind: "lesson" },
        question: "What should I remember?",
        requestId: randomUUID(),
      },
      lessonId: lesson.id,
    });

    if (lessonQuestion.status !== "created") {
      throw new Error("Expected the lesson question to be created");
    }

    await expect(
      prisma.lessonQuestionThread.count({ where: { lessonId: lesson.id, userId: user.id } }),
    ).resolves.toBe(1);

    const [storedStepQuestion, storedLessonQuestion] = await Promise.all([
      prisma.lessonQuestion.findUniqueOrThrow({ where: { id: stepQuestion.question.id } }),
      prisma.lessonQuestion.findUniqueOrThrow({ where: { id: lessonQuestion.question.id } }),
    ]);

    expect(storedStepQuestion.contextSnapshot).toMatchObject({
      chapter: { title: "Introductions" },
      course: { targetLanguage: "de", title: "German foundations" },
      lesson: { title: "Say hello" },
      scope: { kind: "step" },
      step: { content: multipleChoiceContent, kind: "multipleChoice", stepNumber: 1 },
      version: 1,
    });

    expect(storedLessonQuestion.contextSnapshot).toMatchObject({
      lessonSteps: [expect.objectContaining({ content: multipleChoiceContent, stepNumber: 1 })],
      scope: { kind: "lesson" },
      step: null,
    });

    await prisma.lessonQuestion.update({
      data: { contextSnapshot: { corruptedForResourceRead: true } },
      where: { id: storedStepQuestion.id },
    });

    const thread = await getLessonQuestionThread({ lessonId: lesson.id });

    expect(thread).toMatchObject({
      status: "ready",
      thread: {
        lessonId: lesson.id,
        questions: expect.arrayContaining([
          expect.objectContaining({
            answer: "Because it matches this context.",
            context: { kind: "step", stepId: step.id, stepNumber: 1 },
            question: "Why is this natural?",
            status: "completed",
          }),
          expect.objectContaining({
            context: { kind: "lesson" },
            question: "What should I remember?",
          }),
        ]),
      },
    });
  });

  it("numbers lesson context in the learner's requested display order", async () => {
    const { lesson, user } = await createPublishedCurriculum();
    const firstContent = { ...multipleChoiceContent, question: "First displayed concept" };
    const secondContent = { ...multipleChoiceContent, question: "Second displayed concept" };

    const [firstStep, secondStep] = await Promise.all([
      stepFixture({
        content: firstContent,
        isPublished: true,
        kind: "multipleChoice",
        lessonId: lesson.id,
        position: 4,
      }),
      stepFixture({
        content: secondContent,
        isPublished: true,
        kind: "multipleChoice",
        lessonId: lesson.id,
        position: 8,
      }),
    ]);

    mockSession(user.id);

    const created = await createLessonQuestion({
      input: {
        context: { kind: "lesson", stepIds: [secondStep.id, firstStep.id] },
        question: "How do these ideas connect?",
        requestId: randomUUID(),
      },
      lessonId: lesson.id,
    });

    expect(created.status).toBe("created");

    if (created.status !== "created") {
      throw new Error(`Expected a created question, received ${created.status}`);
    }

    const stored = await prisma.lessonQuestion.findUniqueOrThrow({
      where: { id: created.question.id },
    });

    expect(stored.contextSnapshot).toMatchObject({
      lessonSteps: [
        { content: secondContent, stepNumber: 1 },
        { content: firstContent, stepNumber: 2 },
      ],
    });
  });

  it("reconstructs authoritative context for correct and incorrect answers", async () => {
    const { lesson, user } = await createPublishedCurriculum();

    const step = await stepFixture({
      content: multipleChoiceContent,
      isPublished: true,
      kind: "multipleChoice",
      lessonId: lesson.id,
    });

    mockSession(user.id);

    const unknown = await createLessonQuestion({
      input: {
        context: {
          answer: { kind: "multipleChoice", selectedOptionId: "fabricated-option" },
          kind: "answer",
          stepId: step.id,
          stepNumber: 1,
        },
        question: "Why was my answer wrong?",
        requestId: randomUUID(),
      },
      lessonId: lesson.id,
    });

    const incorrect = await createLessonQuestion({
      input: {
        context: {
          answer: { kind: "multipleChoice", selectedOptionId: "tschuss" },
          kind: "answer",
          stepId: step.id,
          stepNumber: 1,
        },
        question: "Why was my answer wrong?",
        requestId: randomUUID(),
      },
      lessonId: lesson.id,
    });

    if (incorrect.status !== "created") {
      throw new Error(`Expected a created question, received ${incorrect.status}`);
    }

    await prisma.lessonQuestion.update({
      data: { answer: "A completed explanation", status: "completed" },
      where: { id: incorrect.question.id },
    });

    const correct = await createLessonQuestion({
      input: {
        context: {
          answer: { kind: "multipleChoice", selectedOptionId: "hallo" },
          kind: "answer",
          stepId: step.id,
          stepNumber: 1,
        },
        question: "Why is this answer correct?",
        requestId: randomUUID(),
      },
      lessonId: lesson.id,
    });

    expect(incorrect.status).toBe("created");
    expect(correct.status).toBe("created");
    expect(unknown).toStrictEqual({ status: "invalidContext" });

    const stored = await prisma.lessonQuestion.findUniqueOrThrow({
      where: { id: incorrect.question.id },
    });

    expect(stored.contextSnapshot).toMatchObject({
      answer: {
        correctAnswer: "Hallo",
        feedback: "That is a farewell.",
        isCorrect: false,
        selectedAnswer: "Tschuss",
      },
      scope: { kind: "answer" },
    });

    if (correct.status !== "created") {
      throw new Error(`Expected a created question, received ${correct.status}`);
    }

    await expect(
      prisma.lessonQuestion.findUniqueOrThrow({ where: { id: correct.question.id } }),
    ).resolves.toMatchObject({
      contextSnapshot: expect.objectContaining({
        answer: expect.objectContaining({ isCorrect: true, selectedAnswer: "Hallo" }),
        scope: { kind: "answer" },
      }),
    });
  });

  it("snapshots image and ordered answer corrections from authoritative content", async () => {
    const { lesson, user } = await createPublishedCurriculum();

    const [imageStep, orderStep] = await Promise.all([
      stepFixture({
        content: {
          options: [
            { feedback: "Yes.", id: "cat", isCorrect: true, prompt: "A cat" },
            { feedback: "That is a dog.", id: "dog", isCorrect: false, prompt: "A dog" },
          ],
          question: "Which image shows a cat?",
        },
        isPublished: true,
        kind: "selectImage",
        lessonId: lesson.id,
      }),
      stepFixture({
        content: {
          feedback: "Breakfast comes before work.",
          items: ["Wake up", "Eat breakfast", "Start work"],
          question: "Order the routine.",
        },
        isPublished: true,
        kind: "sortOrder",
        lessonId: lesson.id,
        position: 1,
      }),
    ]);

    mockSession(user.id);

    const imageQuestion = await createLessonQuestion({
      input: {
        context: {
          answer: { kind: "selectImage", selectedOptionId: "dog" },
          kind: "answer",
          stepId: imageStep.id,
          stepNumber: 1,
        },
        question: "Why is this not the cat?",
        requestId: randomUUID(),
      },
      lessonId: lesson.id,
    });

    const unknownImage = await createLessonQuestion({
      input: {
        context: {
          answer: { kind: "selectImage", selectedOptionId: "fabricated-image" },
          kind: "answer",
          stepId: imageStep.id,
          stepNumber: 1,
        },
        question: "Why is this image wrong?",
        requestId: randomUUID(),
      },
      lessonId: lesson.id,
    });

    if (imageQuestion.status !== "created") {
      throw new Error(`Expected an image answer, received ${imageQuestion.status}`);
    }

    expect(unknownImage).toStrictEqual({ status: "invalidContext" });

    await prisma.lessonQuestion.update({
      data: { answer: "The dog is the other image.", status: "completed" },
      where: { id: imageQuestion.question.id },
    });

    const orderQuestion = await createLessonQuestion({
      input: {
        context: {
          answer: { kind: "sortOrder", userOrder: ["Start work", "Eat breakfast", "Wake up"] },
          kind: "answer",
          stepId: orderStep.id,
          stepNumber: 2,
        },
        question: "What should come first?",
        requestId: randomUUID(),
      },
      lessonId: lesson.id,
    });

    const fabricatedOrder = await createLessonQuestion({
      input: {
        context: {
          answer: { kind: "sortOrder", userOrder: ["Wake up", "Invented", "Start work"] },
          kind: "answer",
          stepId: orderStep.id,
          stepNumber: 2,
        },
        question: "Why is this order wrong?",
        requestId: randomUUID(),
      },
      lessonId: lesson.id,
    });

    if (orderQuestion.status !== "created") {
      throw new Error(`Expected an ordered answer, received ${orderQuestion.status}`);
    }

    expect(fabricatedOrder).toStrictEqual({ status: "invalidContext" });

    const [storedImage, storedOrder] = await Promise.all([
      prisma.lessonQuestion.findUniqueOrThrow({ where: { id: imageQuestion.question.id } }),
      prisma.lessonQuestion.findUniqueOrThrow({ where: { id: orderQuestion.question.id } }),
    ]);

    expect(storedImage.contextSnapshot).toMatchObject({
      answer: {
        correctAnswer: "A cat",
        feedback: "That is a dog.",
        isCorrect: false,
        selectedAnswer: "A dog",
      },
    });

    expect(storedOrder.contextSnapshot).toMatchObject({
      answer: {
        correctAnswer: "Wake up → Eat breakfast → Start work",
        feedback: "Breakfast comes before work.",
        isCorrect: false,
        selectedAnswer: "Start work → Eat breakfast → Wake up",
      },
    });
  });

  it("resolves translation option IDs to learner-visible text and rejects unknown IDs", async () => {
    const { chapter, lesson, organization, user } = await createPublishedCurriculum();

    const [correctWord, distractorWord] = await Promise.all([
      wordFixture({ organizationId: organization.id, targetLanguage: "de", word: "hallo" }),
      wordFixture({ organizationId: organization.id, targetLanguage: "de", word: "tschüss" }),
    ]);

    const chapterWord = await chapterWordFixture({
      chapterId: chapter.id,
      distractors: ["tschüss"],
      sourceLessonId: lesson.id,
      translation: "hello",
      userLanguage: "en",
      wordId: correctWord.id,
    });

    const step = await stepFixture({
      chapterWordId: chapterWord.id,
      content: {},
      isPublished: true,
      kind: "translation",
      lessonId: lesson.id,
      wordId: correctWord.id,
    });

    mockSession(user.id);

    const mistake = await createLessonQuestion({
      input: {
        context: {
          answer: { kind: "translation", selectedOptionId: distractorWord.id },
          kind: "answer",
          stepId: step.id,
          stepNumber: 1,
        },
        question: "Why is this translation wrong?",
        requestId: randomUUID(),
      },
      lessonId: lesson.id,
    });

    const fabricated = await createLessonQuestion({
      input: {
        context: {
          answer: { kind: "translation", selectedOptionId: randomUUID() },
          kind: "answer",
          stepId: step.id,
          stepNumber: 1,
        },
        question: "Why is this translation wrong?",
        requestId: randomUUID(),
      },
      lessonId: lesson.id,
    });

    expect(mistake.status).toBe("created");
    expect(fabricated).toStrictEqual({ status: "invalidContext" });

    if (mistake.status !== "created") {
      throw new Error(`Expected a translation mistake, received ${mistake.status}`);
    }

    await expect(
      prisma.lessonQuestion.findUniqueOrThrow({ where: { id: mistake.question.id } }),
    ).resolves.toMatchObject({
      contextSnapshot: {
        answer: {
          correctAnswer: "hallo",
          feedback: null,
          isCorrect: false,
          selectedAnswer: "Tschüss",
        },
      },
    });
  });

  it("rejects fabricated reading tiles while preserving a visible wrong arrangement", async () => {
    const { chapter, lesson, organization, user } = await createPublishedCurriculum();

    const sentence = await sentenceFixture({
      organizationId: organization.id,
      sentence: "Ich lerne heute",
      targetLanguage: "de",
    });

    const chapterSentence = await chapterSentenceFixture({
      chapterId: chapter.id,
      distractors: ["Morgen"],
      sentenceId: sentence.id,
      sourceLessonId: lesson.id,
      translation: "I study today",
      userLanguage: "en",
    });

    const step = await stepFixture({
      chapterSentenceId: chapterSentence.id,
      content: {},
      isPublished: true,
      kind: "reading",
      lessonId: lesson.id,
      sentenceId: sentence.id,
    });

    mockSession(user.id);

    const mistake = await createLessonQuestion({
      input: {
        context: {
          answer: { arrangedWords: ["morgen", "lerne", "heute"], kind: "reading" },
          kind: "answer",
          stepId: step.id,
          stepNumber: 1,
        },
        question: "Why is this sentence wrong?",
        requestId: randomUUID(),
      },
      lessonId: lesson.id,
    });

    const fabricated = await createLessonQuestion({
      input: {
        context: {
          answer: { arrangedWords: ["invented", "lerne", "heute"], kind: "reading" },
          kind: "answer",
          stepId: step.id,
          stepNumber: 1,
        },
        question: "Why is this sentence wrong?",
        requestId: randomUUID(),
      },
      lessonId: lesson.id,
    });

    expect(mistake.status).toBe("created");
    expect(fabricated).toStrictEqual({ status: "invalidContext" });

    if (mistake.status !== "created") {
      throw new Error(`Expected a reading mistake, received ${mistake.status}`);
    }

    await expect(
      prisma.lessonQuestion.findUniqueOrThrow({ where: { id: mistake.question.id } }),
    ).resolves.toMatchObject({
      contextSnapshot: {
        answer: {
          correctAnswer: "Ich lerne heute",
          isCorrect: false,
          selectedAnswer: "morgen lerne heute",
        },
      },
    });
  });

  it("preserves bounded match mistakes and rejects fabricated column labels", async () => {
    const { lesson, user } = await createPublishedCurriculum();

    const step = await stepFixture({
      content: {
        pairs: [
          { left: "Day", right: "Tag" },
          { left: "Night", right: "Nacht" },
        ],
        question: "Match the translations.",
      },
      isPublished: true,
      kind: "matchColumns",
      lessonId: lesson.id,
    });

    mockSession(user.id);

    const mistake = await createLessonQuestion({
      input: {
        context: {
          answer: {
            incorrectPair: { left: "Day", right: "Nacht" },
            kind: "matchColumns",
            mistakes: 1,
            userPairs: [
              { left: "Day", right: "Tag" },
              { left: "Night", right: "Nacht" },
            ],
          },
          kind: "answer",
          stepId: step.id,
          stepNumber: 1,
        },
        question: "Where did I get confused?",
        requestId: randomUUID(),
      },
      lessonId: lesson.id,
    });

    const fabricated = await createLessonQuestion({
      input: {
        context: {
          answer: {
            incorrectPair: { left: "Invented", right: "Tag" },
            kind: "matchColumns",
            mistakes: 1,
            userPairs: [
              { left: "Day", right: "Tag" },
              { left: "Night", right: "Nacht" },
            ],
          },
          kind: "answer",
          stepId: step.id,
          stepNumber: 1,
        },
        question: "Where did I get confused?",
        requestId: randomUUID(),
      },
      lessonId: lesson.id,
    });

    const correctPair = await createLessonQuestion({
      input: {
        context: {
          answer: {
            incorrectPair: { left: "Day", right: "Tag" },
            kind: "matchColumns",
            mistakes: 1,
            userPairs: [
              { left: "Day", right: "Tag" },
              { left: "Night", right: "Nacht" },
            ],
          },
          kind: "answer",
          stepId: step.id,
          stepNumber: 1,
        },
        question: "Was this pair actually wrong?",
        requestId: randomUUID(),
      },
      lessonId: lesson.id,
    });

    const missingIncorrectPair = await createLessonQuestion({
      input: {
        context: {
          answer: {
            kind: "matchColumns",
            mistakes: 1,
            userPairs: [
              { left: "Day", right: "Tag" },
              { left: "Night", right: "Nacht" },
            ],
          },
          kind: "answer",
          stepId: step.id,
          stepNumber: 1,
        },
        question: "Which pair did I get wrong?",
        requestId: randomUUID(),
      },
      lessonId: lesson.id,
    });

    const incorrectPairWithoutMistake = await createLessonQuestion({
      input: {
        context: {
          answer: {
            incorrectPair: { left: "Day", right: "Nacht" },
            kind: "matchColumns",
            mistakes: 0,
            userPairs: [
              { left: "Day", right: "Tag" },
              { left: "Night", right: "Nacht" },
            ],
          },
          kind: "answer",
          stepId: step.id,
          stepNumber: 1,
        },
        question: "Why is this marked correct?",
        requestId: randomUUID(),
      },
      lessonId: lesson.id,
    });

    expect(mistake.status).toBe("created");
    expect(fabricated).toStrictEqual({ status: "invalidContext" });
    expect(correctPair).toStrictEqual({ status: "invalidContext" });
    expect(missingIncorrectPair).toStrictEqual({ status: "invalidContext" });
    expect(incorrectPairWithoutMistake).toStrictEqual({ status: "invalidContext" });

    if (mistake.status !== "created") {
      throw new Error(`Expected a matching mistake, received ${mistake.status}`);
    }

    await expect(
      prisma.lessonQuestion.findUniqueOrThrow({ where: { id: mistake.question.id } }),
    ).resolves.toMatchObject({
      contextSnapshot: {
        answer: {
          correctAnswer: null,
          isCorrect: false,
          selectedAnswer: "Day → Nacht; Recorded mistakes: 1",
        },
      },
    });
  });

  it("accepts only the current lesson step, except for reviewable steps in the same chapter", async () => {
    const { chapter, course, lesson, organization, user } = await createPublishedCurriculum();

    const [otherLesson, reviewLesson, otherChapter] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        kind: "practice",
        organizationId: organization.id,
        position: 1,
      }),
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        kind: "review",
        organizationId: organization.id,
        position: 2,
      }),
      chapterFixture({
        courseId: course.id,
        isPublished: true,
        organizationId: organization.id,
        position: 1,
      }),
    ]);

    const outsideChapterLesson = await lessonFixture({
      chapterId: otherChapter.id,
      isPublished: true,
      kind: "practice",
      organizationId: organization.id,
    });

    const [answerableStep, staticStep, unpublishedStep, outsideChapterStep] = await Promise.all([
      stepFixture({
        content: multipleChoiceContent,
        isPublished: true,
        kind: "multipleChoice",
        lessonId: otherLesson.id,
      }),
      stepFixture({
        content: { text: "Read this", title: "Note", variant: "text" },
        isPublished: true,
        kind: "static",
        lessonId: otherLesson.id,
        position: 1,
      }),
      stepFixture({
        content: multipleChoiceContent,
        isPublished: false,
        kind: "multipleChoice",
        lessonId: otherLesson.id,
        position: 2,
      }),
      stepFixture({
        content: multipleChoiceContent,
        isPublished: true,
        kind: "multipleChoice",
        lessonId: outsideChapterLesson.id,
      }),
    ]);

    mockSession(user.id);

    const [
      outsideNormalLesson,
      reviewable,
      nonAnswerableReview,
      unpublishedReview,
      outsideChapterReview,
    ] = await Promise.all([
      createLessonQuestion({
        input: {
          context: { kind: "step", stepId: answerableStep.id, stepNumber: 1 },
          question: "Can this normal lesson use it?",
          requestId: randomUUID(),
        },
        lessonId: lesson.id,
      }),
      createLessonQuestion({
        input: {
          context: { kind: "step", stepId: answerableStep.id, stepNumber: 7 },
          question: "Can this review use it?",
          requestId: randomUUID(),
        },
        lessonId: reviewLesson.id,
      }),
      createLessonQuestion({
        input: {
          context: { kind: "step", stepId: staticStep.id, stepNumber: 2 },
          question: "Can a review use static content?",
          requestId: randomUUID(),
        },
        lessonId: reviewLesson.id,
      }),
      createLessonQuestion({
        input: {
          context: { kind: "step", stepId: unpublishedStep.id, stepNumber: 3 },
          question: "Can a review use unpublished content?",
          requestId: randomUUID(),
        },
        lessonId: reviewLesson.id,
      }),
      createLessonQuestion({
        input: {
          context: { kind: "step", stepId: outsideChapterStep.id, stepNumber: 4 },
          question: "Can a review use another chapter?",
          requestId: randomUUID(),
        },
        lessonId: reviewLesson.id,
      }),
    ]);

    expect(outsideNormalLesson).toStrictEqual({ status: "invalidContext" });
    expect(reviewable.status).toBe("created");

    expect(reviewable).toMatchObject({
      question: { context: { kind: "step", stepId: answerableStep.id, stepNumber: 7 } },
    });

    if (reviewable.status !== "created") {
      throw new Error(`Expected a created review question, received ${reviewable.status}`);
    }

    await expect(
      prisma.lessonQuestion.findUniqueOrThrow({ where: { id: reviewable.question.id } }),
    ).resolves.toMatchObject({
      contextSnapshot: {
        lessonSteps: [expect.objectContaining({ stepNumber: 7 })],
        step: expect.objectContaining({ stepNumber: 7 }),
      },
    });

    expect(nonAnswerableReview).toStrictEqual({ status: "invalidContext" });
    expect(unpublishedReview).toStrictEqual({ status: "invalidContext" });
    expect(outsideChapterReview).toStrictEqual({ status: "invalidContext" });
  });

  it("preserves questions and snapshots when their curriculum rows are deleted", async () => {
    const { lesson, user } = await createPublishedCurriculum();

    const step = await stepFixture({
      content: multipleChoiceContent,
      isPublished: true,
      kind: "multipleChoice",
      lessonId: lesson.id,
    });

    mockSession(user.id);

    const created = await createLessonQuestion({
      input: {
        context: { kind: "step", stepId: step.id, stepNumber: 1 },
        question: "Keep this context for my history",
        requestId: randomUUID(),
      },
      lessonId: lesson.id,
    });

    if (created.status !== "created") {
      throw new Error(`Expected a created question, received ${created.status}`);
    }

    await prisma.lesson.delete({ where: { id: lesson.id } });

    const question = await prisma.lessonQuestion.findUniqueOrThrow({
      include: { thread: true },
      where: { id: created.question.id },
    });

    expect(question.stepId).toBeNull();
    expect(question.thread.lessonId).toBeNull();

    expect(question.contextSnapshot).toMatchObject({
      lesson: { title: "Say hello" },
      step: { content: multipleChoiceContent },
    });
  });

  it("requires an active subscription for questions in later chapters", async () => {
    const { course, organization, user } = await createPublishedCurriculum({ subscribed: false });

    const paidChapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 1,
    });

    const paidLesson = await lessonFixture({
      chapterId: paidChapter.id,
      isPublished: true,
      organizationId: organization.id,
    });

    mockSession(user.id);

    const input = {
      context: { kind: "lesson" as const },
      question: "Help me study this",
      requestId: randomUUID(),
    };

    await expect(createLessonQuestion({ input, lessonId: paidLesson.id })).resolves.toStrictEqual({
      status: "subscriptionRequired",
    });

    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    });

    await expect(createLessonQuestion({ input, lessonId: paidLesson.id })).resolves.toMatchObject({
      status: "created",
    });
  });
});

describe(getLessonQuestionThread, () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("returns null before the learner asks a question", async () => {
    const { lesson, user } = await createPublishedCurriculum();
    mockSession(user.id);

    await expect(getLessonQuestionThread({ lessonId: lesson.id })).resolves.toStrictEqual({
      status: "ready",
      thread: null,
    });
  });

  it("requires a current subscription to read an existing first-chapter thread", async () => {
    const { lesson, user } = await createPublishedCurriculum();
    mockSession(user.id);

    const created = await createLessonQuestion({
      input: {
        context: { kind: "lesson" },
        question: "Keep this private",
        requestId: randomUUID(),
      },
      lessonId: lesson.id,
    });

    expect(created.status).toBe("created");

    await prisma.subscription.updateMany({
      data: { status: "canceled" },
      where: { referenceId: user.id },
    });

    await expect(getLessonQuestionThread({ lessonId: lesson.id })).resolves.toStrictEqual({
      status: "subscriptionRequired",
    });
  });

  it("does not expose another learner's thread", async () => {
    const { lesson, user } = await createPublishedCurriculum();
    const otherUser = await userFixture();

    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: otherUser.id, status: "active" },
    });

    mockSession(user.id);

    const privateQuestion = await createLessonQuestion({
      input: {
        context: { kind: "lesson" },
        question: "Private learner question",
        requestId: randomUUID(),
      },
      lessonId: lesson.id,
    });

    mockSession(otherUser.id);

    await expect(getLessonQuestionThread({ lessonId: lesson.id })).resolves.toStrictEqual({
      status: "ready",
      thread: null,
    });

    if (privateQuestion.status !== "created") {
      throw new Error("Expected the private question to be created");
    }

    await expect(
      getLessonQuestionThread({ cursor: privateQuestion.question.id, lessonId: lesson.id }),
    ).resolves.toStrictEqual({ status: "invalidCursor" });
  });

  it("paginates the latest fifty questions without losing older turns", async () => {
    const { lesson, user } = await createPublishedCurriculum();
    mockSession(user.id);

    const created = await createLessonQuestion({
      input: { context: { kind: "lesson" }, question: "Question 1", requestId: randomUUID() },
      lessonId: lesson.id,
    });

    if (created.status !== "created") {
      throw new Error(`Expected a created question, received ${created.status}`);
    }

    const firstQuestion = await prisma.lessonQuestion.findUniqueOrThrow({
      where: { id: created.question.id },
    });

    const contextSnapshot = toDatabaseLessonQuestionContextSnapshot(
      parseLessonQuestionContextSnapshot(firstQuestion.contextSnapshot),
    );

    const firstCreatedAt = new Date("2026-01-01T00:00:00.000Z");

    await prisma.$transaction([
      prisma.lessonQuestion.update({
        data: { createdAt: firstCreatedAt, updatedAt: firstCreatedAt },
        where: { id: firstQuestion.id },
      }),
      prisma.lessonQuestion.createMany({
        data: Array.from({ length: 54 }, (_, index) => {
          const questionNumber = index + 2;
          const createdAt = new Date(firstCreatedAt.getTime() + questionNumber * 1000);

          return {
            contextKind: "lesson",
            contextSnapshot,
            createdAt,
            question: `Question ${questionNumber}`,
            requestFingerprint: `history-question-${questionNumber}`,
            requestId: randomUUID(),
            threadId: firstQuestion.threadId,
            updatedAt: createdAt,
          };
        }),
      }),
    ]);

    const result = await getLessonQuestionThread({ lessonId: lesson.id });

    if (result.status !== "ready" || !result.thread) {
      throw new Error("Expected the learner's question thread");
    }

    expect(result.thread.questions).toHaveLength(50);

    expect(result.thread.questions.map((question) => question.question)).toStrictEqual(
      Array.from({ length: 50 }, (_, index) => `Question ${index + 6}`),
    );

    expect(result.thread).toMatchObject({ hasMore: true });
    expect(result.thread.nextCursor).not.toBeNull();

    const earlier = await getLessonQuestionThread({
      cursor: result.thread.nextCursor ?? undefined,
      lessonId: lesson.id,
    });

    if (earlier.status !== "ready" || !earlier.thread) {
      throw new Error("Expected the earlier question page");
    }

    expect(earlier.thread).toMatchObject({ hasMore: false, nextCursor: null });

    expect(earlier.thread.questions.map((question) => question.question)).toStrictEqual(
      Array.from({ length: 5 }, (_, index) => `Question ${index + 1}`),
    );
  });
});
