import "server-only";
import {
  type TypedAnswerCorrection,
  gradeTypedAnswer,
} from "@zoonk/ai/tasks/v2/grading/grade-typed-answer";
import { matchTypedAnswer } from "@zoonk/ai/tasks/v2/grading/typed-answer-match";
import { gradeChallengePath } from "../../library/challenges/challenge-run";
import { matchSpokenAnswer } from "../../library/language/spoken-answer-match";
import { type LessonStepAnswer } from "../contract";
import { type GradedStepAnswer, gradeStepAnswer } from "../grade-step-answer";
import { type PlayableLibraryStep } from "../playable-lesson";

export type LessonAnswerVerdict = Pick<GradedStepAnswer, "expected"> & {
  answerText: string | null;
  /** False means not checked, never an incorrect verdict; show the sample answer. */
  checked: boolean;
  correctAnswer: string | null;
  /** A language course's typed answer: each form mistake, named so it isn't read as a missing idea. */
  corrections: TypedAnswerCorrection[];
  feedback: string | null;
  isCorrect: boolean;
  keyPoints: { met: boolean; text: string }[] | null;
  score: number | null;
  /** A right answer with a typo: the right spelling, shown so the slip isn't counted as a mistake. */
  spelling: string | null;
};

type LessonLanguage = { language: string; targetLanguage: string | null };

type OpenAnswerGrade = {
  answer: LessonStepAnswer;
  lesson: LessonLanguage;
  step: PlayableLibraryStep;
  /** Disable once the daily per-screen model-grading cap is reached. */
  useModel: boolean;
  userId: string;
};

function withContext(context: string | undefined, question: string): string {
  return context ? `${context}\n\n${question}` : question;
}

type TypedContent = Extract<PlayableLibraryStep, { kind: "typedAnswer" }>["content"];

/** Unrecognized paraphrases remain unchecked rather than wrong when no model grades them. */
function gradeTypedByCode({
  answer,
  content,
  lesson,
}: {
  answer: string;
  content: TypedContent;
  lesson: LessonLanguage;
}): LessonAnswerVerdict {
  const match = matchTypedAnswer({ acceptedAnswers: content.acceptedAnswers ?? [], answer });
  const isTypo = match.kind === "typo";
  const isClose = isTypo || match.kind === "rounded";
  const isCorrect = match.kind === "exact" || (isClose && !lesson.targetLanguage);

  return {
    answerText: answer,
    checked: isCorrect,
    correctAnswer: isCorrect ? null : content.sampleAnswer,
    corrections: [],
    expected: null,
    feedback: null,
    isCorrect,
    keyPoints: null,
    score: isCorrect ? 1 : null,
    spelling: isCorrect && isTypo ? match.acceptedAnswer : null,
  };
}

async function gradeTypedStep({
  answer,
  lesson,
  step,
  useModel,
  userId,
}: OpenAnswerGrade): Promise<LessonAnswerVerdict | null> {
  if (step.kind !== "typedAnswer" || answer.kind !== "typedAnswer") {
    return null;
  }

  const { content } = step;

  if (!useModel) {
    return gradeTypedByCode({ answer: answer.text, content, lesson });
  }

  const { data } = await gradeTypedAnswer({
    acceptedAnswers: content.acceptedAnswers,
    analytics: { contentScope: "personal", distinctId: userId },
    answer: answer.text,
    keyPoints: content.keyPoints,
    language: lesson.language,
    practicedLanguage: lesson.targetLanguage,
    question: withContext(content.context, content.question),
    sampleAnswer: content.sampleAnswer,
  });

  return {
    answerText: answer.text,
    checked: true,
    correctAnswer: data.isCorrect ? null : content.sampleAnswer,
    corrections: data.corrections,
    expected: null,
    feedback: data.feedback,
    isCorrect: data.isCorrect,
    keyPoints: data.keyPoints,
    score: data.score,
    spelling: data.isCorrect ? data.spelling : null,
  };
}

/** Typed speech fallback uses the same word-by-word code as recording grading; no model runs. */
function gradeSpokenFallback({ answer, step }: OpenAnswerGrade): LessonAnswerVerdict | null {
  if (step.kind !== "spokenAnswer" || answer.kind !== "spokenAnswer") {
    return null;
  }

  const { content } = step;

  const match = matchSpokenAnswer({
    expected: content.targetText,
    heard: answer.text,
    language: content.language,
  });

  return {
    answerText: answer.text,
    checked: true,
    correctAnswer: match.isCorrect ? null : content.targetText,
    corrections: match.isCorrect ? [] : [{ right: content.targetText, wrong: answer.text }],
    expected: null,
    feedback: null,
    isCorrect: match.isCorrect,
    keyPoints: null,
    score: match.score,
    spelling: null,
  };
}

function getChallengeScore({ answer, step }: OpenAnswerGrade): number | null {
  if (step.kind !== "challenge" || answer.kind !== "challenge") {
    return null;
  }

  return gradeChallengePath(step.content, answer.choiceIds)?.score ?? null;
}

/** Returns null when the answer does not fit the screen; typed answers may call a model. */
export async function gradeLessonAnswer(
  input: OpenAnswerGrade,
): Promise<LessonAnswerVerdict | null> {
  if (input.step.kind === "typedAnswer") {
    return gradeTypedStep(input);
  }

  if (input.step.kind === "spokenAnswer" && input.answer.kind === "spokenAnswer") {
    return gradeSpokenFallback(input);
  }

  const graded = gradeStepAnswer({
    answer: input.answer,
    language: input.lesson.language,
    step: input.step,
  });

  return graded
    ? {
        ...graded,
        checked: true,
        corrections: [],
        keyPoints: null,
        score: getChallengeScore(input),
        spelling: null,
      }
    : null;
}
