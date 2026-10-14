import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { describe, expect, it } from "vitest";
import { parseStepContent } from "../library/steps/contract/step-contract";
import { serializeExerciseSteps } from "../player/contracts/prepare-lesson-data";
import {
  type PlayableLanguageStep,
  type PlayableTeachingStepOf,
  type TeachingStepKind,
} from "./contract";
import { gradeStepAnswer } from "./grade-step-answer";

function teachingStep<TKind extends TeachingStepKind>(
  kind: TKind,
  content: unknown,
): PlayableTeachingStepOf<TKind> {
  return {
    citation: null,
    content: parseStepContent(kind, content),
    id: `${kind}-step`,
    image: null,
    imagePending: false,
    kind,
    position: 0,
    skillId: null,
  };
}

function exerciseStep(kind: PlayableLanguageStep["kind"], content: object): PlayableLanguageStep {
  const [exercise] = serializeExerciseSteps({
    resources: { distractorWords: [], lessonSentences: [], lessonWords: [], sentenceWords: [] },
    steps: [{ content, id: `${kind}-step`, kind, position: 0, sentence: null, word: null }],
  });

  if (!exercise) {
    throw new Error("Expected valid exercise content");
  }

  return { exercise, id: exercise.id, kind, position: 0, skillId: null, wordHints: null };
}

describe(gradeStepAnswer, () => {
  const check = teachingStep("check", playableStepContent.check);

  it("grades a check with the chosen option's reason and the right answer when missed", () => {
    expect(
      gradeStepAnswer({ answer: { kind: "check", optionId: "path" }, language: "en", step: check }),
    ).toStrictEqual({
      answerText: "The electron's exact path",
      correctAnswer: "Where the electron is most likely to be found",
      feedback: "There is no exact path to show: the electron doesn't follow one.",
      isCorrect: false,
    });

    expect(
      gradeStepAnswer({
        answer: { kind: "check", optionId: "likely" },
        language: "en",
        step: check,
      }),
    ).toMatchObject({ correctAnswer: null, isCorrect: true });
  });

  it("refuses an option the screen doesn't have or an answer of another kind", () => {
    expect(
      gradeStepAnswer({ answer: { kind: "check", optionId: "nope" }, language: "en", step: check }),
    ).toBeNull();

    expect(
      gradeStepAnswer({
        answer: { kind: "typedAnswer", text: "cloud" },
        language: "en",
        step: check,
      }),
    ).toBeNull();
  });

  it("grades a numeric activity within its tolerance with the check's explanation", () => {
    const activity = teachingStep("activity", playableStepContent.activity);

    const right = gradeStepAnswer({
      answer: { answer: { kind: "numeric", value: 5 }, kind: "activity" },
      language: "en",
      step: activity,
    });

    const wrong = gradeStepAnswer({
      answer: { answer: { kind: "numeric", value: 4 }, kind: "activity" },
      language: "en",
      step: activity,
    });

    expect(right).toMatchObject({ correctAnswer: null, isCorrect: true });

    // A unit follows its number after a non-breaking space, so "4 °C" never wraps between them.
    expect(wrong).toStrictEqual({
      answerText: "4 °C",
      correctAnswer: "5 °C",
      feedback: "−3 + 8 = 5, so it's 5 °C at noon.",
      isCorrect: false,
    });

    expect(
      gradeStepAnswer({
        answer: { answer: { kind: "choice", optionId: "o1" }, kind: "activity" },
        language: "en",
        step: activity,
      }),
    ).toBeNull();
  });

  it("writes a money answer the way the lesson's language does, for the mistakes notebook", () => {
    const { activity } = playableStepContent;

    const step = teachingStep("activity", {
      ...activity,
      check: { ...activity.check, answer: 52, explanation: "0,65 × 80 = R$ 52.", unit: "R$" },
    });

    const graded = gradeStepAnswer({
      answer: { answer: { kind: "numeric", value: 28 }, kind: "activity" },
      language: "pt",
      step,
    });

    expect(graded).toMatchObject({ answerText: "R$ 28", correctAnswer: "R$ 52" });
  });

  it.each([
    { answerText: "0.1254", correctAnswer: "0.125", language: "en", value: 0.1254 },
    { answerText: "0,1254", correctAnswer: "0,125", language: "pt", value: 0.1254 },
    { answerText: "0.126", correctAnswer: "0.125", language: "en", value: 0.126 },
  ])(
    "keeps a close wrong answer distinct in $language",
    ({ answerText, correctAnswer, language, value }) => {
      const { activity } = playableStepContent;

      const step = teachingStep("activity", {
        ...activity,
        check: {
          ...activity.check,
          answer: 0.125,
          tolerance: { kind: "absolute", value: 0.0001 },
          unit: undefined,
        },
      });

      const graded = gradeStepAnswer({
        answer: { answer: { kind: "numeric", value }, kind: "activity" },
        language,
        step,
      });

      expect(graded).toMatchObject({ answerText, correctAnswer, isCorrect: false });
    },
  );

  it("grades language exercises with today's check code", () => {
    const multipleChoice = exerciseStep("multipleChoice", playableStepContent.multipleChoice);
    const fillBlank = exerciseStep("fillBlank", playableStepContent.fillBlank);

    expect(
      gradeStepAnswer({
        answer: { kind: "multipleChoice", selectedOptionId: "orbit" },
        language: "en",
        step: multipleChoice,
      }),
    ).toStrictEqual({
      answerText: "An orbit",
      correctAnswer: "A cloud",
      feedback: "That's the old planet picture.",
      isCorrect: false,
    });

    expect(
      gradeStepAnswer({
        answer: { kind: "fillBlank", userAnswers: ["cloud"] },
        language: "en",
        step: fillBlank,
      }),
    ).toMatchObject({ answerText: "cloud", isCorrect: true });
  });

  it("grades a challenge by its path: the ending reached, and right when half or more was good", () => {
    const challenge = teachingStep("challenge", playableStepContent.challenge);

    expect(
      gradeStepAnswer({
        answer: { choiceIds: ["ask-ai", "explain-plain", "ship"], kind: "challenge" },
        language: "en",
        step: challenge,
      }),
    ).toStrictEqual({
      answerText:
        "Ask the AI to check if the difference is real → A gap this small shows up by chance all the time. One more week will tell us. → Launch B for everyone",
      correctAnswer: null,
      feedback: "Version B went to everyone: 3.1% → 3.7%, or 19% more purchases per visit.",
      isCorrect: true,
    });

    expect(
      gradeStepAnswer({
        answer: { choiceIds: ["launch", "keep-live"], kind: "challenge" },
        language: "en",
        step: challenge,
      }),
    ).toMatchObject({ isCorrect: false });

    expect(
      gradeStepAnswer({
        answer: { choiceIds: ["ask-ai"], kind: "challenge" },
        language: "en",
        step: challenge,
      }),
    ).toBeNull();
  });

  it("leaves typed and spoken answers and reading screens to the server or to nobody", () => {
    const typed = teachingStep("typedAnswer", playableStepContent.typedAnswer);
    const hook = teachingStep("hook", playableStepContent.hook);

    expect(
      gradeStepAnswer({
        answer: { kind: "typedAnswer", text: "a cloud" },
        language: "en",
        step: typed,
      }),
    ).toBeNull();

    expect(
      gradeStepAnswer({ answer: { kind: "check", optionId: "no" }, language: "en", step: hook }),
    ).toBeNull();
  });
});
