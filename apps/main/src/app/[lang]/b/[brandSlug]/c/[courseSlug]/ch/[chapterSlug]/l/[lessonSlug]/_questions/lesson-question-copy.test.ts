import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { type PlayerQuestionContext } from "@zoonk/player/provider";
import { describe, expect, it } from "vitest";
import { buildLessonQuestionCopy } from "./lesson-question-copy";

function multipleChoiceStep(): SerializedStep {
  return {
    content: {
      context: "Choose the best explanation.",
      options: [
        {
          feedback: "The orbit changes because velocity is tangent to gravity.",
          id: "correct-option-id",
          isCorrect: true,
          text: "Gravity continuously bends the path.",
        },
        {
          feedback: "Gravity does not disappear in orbit.",
          id: "wrong-option-id",
          isCorrect: false,
          text: "There is no gravity in space.",
        },
      ],
      question: "Why does a satellite stay in orbit?",
    },
    fillBlankOptions: [],
    id: "hidden-step-id",
    kind: "multipleChoice",
    matchColumnsRightItems: [],
    position: 0,
    sentence: null,
    sentenceWordOptions: [],
    sortOrderItems: [],
    translationOptions: [],
    vocabularyOptions: [],
    word: null,
    wordBankOptions: [],
  };
}

function staticStep(): SerializedStep {
  return {
    content: {
      text: "An orbit is continuous free fall.",
      title: "A second perspective",
      variant: "text",
    },
    fillBlankOptions: [],
    id: "second-hidden-step-id",
    kind: "static",
    matchColumnsRightItems: [],
    position: 1,
    sentence: null,
    sentenceWordOptions: [],
    sortOrderItems: [],
    translationOptions: [],
    vocabularyOptions: [],
    word: null,
    wordBankOptions: [],
  };
}

function buildCopy({
  context,
  lessonSteps = [multipleChoiceStep(), staticStep()],
  question = "Can you explain the idea?",
}: {
  context: PlayerQuestionContext;
  lessonSteps?: SerializedStep[];
  question?: string;
}) {
  return buildLessonQuestionCopy({
    chapterTitle: "Orbital motion",
    context,
    courseTitle: "Physics",
    labels: {
      audioExercise: "Audio exercise",
      correctAnswer: "Correct answer",
      currentStep: "Currently viewing",
      feedback: "Feedback",
      leftColumn: "Left column",
      options: "Options",
      question: "My question",
      rightColumn: "Right column",
      writeQuestion: "[Write your question]",
      yourAnswer: "Your answer",
    },
    lessonDescription: "Learn why falling can create an orbit.",
    lessonStepLabels: ["Part 1 of 2", "Part 2 of 2"],
    lessonSteps,
    lessonTitle: "Staying in orbit",
    question,
    stepLabel: context.kind === "lesson" ? null : `Part ${context.stepIndex + 1} of 2`,
  });
}

describe(buildLessonQuestionCopy, () => {
  it("copies learner-visible step material without leaking answer metadata", () => {
    const copy = buildCopy({ context: { kind: "step", step: multipleChoiceStep(), stepIndex: 0 } });

    expect(copy).toContain("Physics");
    expect(copy).toContain("Orbital motion");
    expect(copy).toContain("Staying in orbit");
    expect(copy).toContain("Currently viewing: Part 1 of 2");
    expect(copy).toContain("Part 2 of 2");
    expect(copy).toContain("An orbit is continuous free fall.");
    expect(copy).toContain("Why does a satellite stay in orbit?");
    expect(copy).toContain("Gravity continuously bends the path.");
    expect(copy).toContain("There is no gravity in space.");
    expect(copy).toContain("Can you explain the idea?");
    expect(copy).not.toContain("correct-option-id");
    expect(copy).not.toContain("wrong-option-id");
    expect(copy).not.toContain("hidden-step-id");
    expect(copy).not.toContain("Gravity does not disappear in orbit.");
    expect(copy).not.toContain("isCorrect");
  });

  it("adds the submitted answer, correction, and existing feedback for an answered step", () => {
    const step = multipleChoiceStep();

    const copy = buildCopy({
      context: {
        kind: "answer",
        result: {
          answer: { kind: "multipleChoice", selectedOptionId: "wrong-option-id" },
          result: {
            correctAnswer: "Gravity continuously bends the path.",
            feedback: "Gravity does not disappear in orbit.",
            isCorrect: false,
          },
          stepId: step.id,
        },
        selectedAnswer: { kind: "multipleChoice", selectedOptionId: "wrong-option-id" },
        step,
        stepIndex: 0,
      },
    });

    expect(copy).toContain("Your answer: There is no gravity in space.");
    expect(copy).toContain("Correct answer: Gravity continuously bends the path.");
    expect(copy).toContain("Feedback: Gravity does not disappear in orbit.");
    expect(copy).not.toContain("wrong-option-id");
  });

  it("does not reveal pair mappings for an unfinished match-columns step", () => {
    const step: SerializedStep = {
      content: {
        pairs: [
          { left: "Earth", right: "planet" },
          { left: "Sun", right: "star" },
        ],
        question: "Match each object to its type.",
      },
      fillBlankOptions: [],
      id: "match-step-id",
      kind: "matchColumns",
      matchColumnsRightItems: ["star", "planet"],
      position: 1,
      sentence: null,
      sentenceWordOptions: [],
      sortOrderItems: [],
      translationOptions: [],
      vocabularyOptions: [],
      word: null,
      wordBankOptions: [],
    };

    const copy = buildCopy({
      context: { kind: "step", step, stepIndex: 1 },
      lessonSteps: [multipleChoiceStep(), step],
      question: "",
    });

    expect(copy).toContain("Left column: Earth, Sun");
    expect(copy).toContain("Right column: star, planet");
    expect(copy).not.toContain("Earth → planet");
    expect(copy).not.toContain("Sun → star");
    expect(copy).toContain("[Write your question]");
  });

  it("copies the actual incorrect pair from an answered match-columns step", () => {
    const step: SerializedStep = {
      content: {
        pairs: [
          { left: "Earth", right: "planet" },
          { left: "Sun", right: "star" },
        ],
        question: "Match each object to its type.",
      },
      fillBlankOptions: [],
      id: "answered-match-step-id",
      kind: "matchColumns",
      matchColumnsRightItems: ["star", "planet"],
      position: 1,
      sentence: null,
      sentenceWordOptions: [],
      sortOrderItems: [],
      translationOptions: [],
      vocabularyOptions: [],
      word: null,
      wordBankOptions: [],
    };

    const selectedAnswer = {
      incorrectPair: { left: "Earth", right: "star" },
      kind: "matchColumns" as const,
      mistakes: 1,
      userPairs: [
        { left: "Earth", right: "planet" },
        { left: "Sun", right: "star" },
      ],
    };

    const copy = buildCopy({
      context: {
        kind: "answer",
        result: {
          answer: selectedAnswer,
          result: { correctAnswer: null, feedback: null, isCorrect: false },
          stepId: step.id,
        },
        selectedAnswer,
        step,
        stepIndex: 1,
      },
      lessonSteps: [multipleChoiceStep(), step],
    });

    expect(copy).toContain("Your answer: Earth ↔ star");
    expect(copy).not.toContain("Your answer: Earth ↔ planet, Sun ↔ star");
  });

  it("copies the displayed lesson material on completion without answer metadata", () => {
    const copy = buildCopy({ context: { kind: "lesson" } });

    expect(copy).toContain("Learn why falling can create an orbit.");
    expect(copy).toContain("Part 1 of 2");
    expect(copy).toContain("Part 2 of 2");
    expect(copy).toContain("Why does a satellite stay in orbit?");
    expect(copy).not.toContain("Gravity does not disappear in orbit.");
  });
});
