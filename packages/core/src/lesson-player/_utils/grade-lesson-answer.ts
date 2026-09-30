import "server-only";
import { gradeTypedAnswer } from "@zoonk/ai/tasks/v2/grading/grade-typed-answer";
import { matchTypedAnswer } from "@zoonk/ai/tasks/v2/grading/typed-answer-match";
import { gradeChallengePath } from "../../library/challenges/challenge-run";
import { matchSpokenAnswer } from "../../library/language/spoken-answer-match";
import { type LessonStepAnswer, type PlayableLibraryStep } from "../contract";
import { gradeStepAnswer } from "../grade-step-answer";

/** A graded answer with what the learner sees about it and what the notebook keeps. */
export type LessonAnswerVerdict = {
  answerText: string | null;
  correctAnswer: string | null;
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
  /** False when the learner's small AI help ran out: typed answers are then graded by code only. */
  useModel: boolean;
  userId: string;
};

function withContext(context: string | undefined, question: string): string {
  return context ? `${context}\n\n${question}` : question;
}

type TypedContent = Extract<PlayableLibraryStep, { kind: "typedAnswer" }>["content"];

/**
 * A written answer graded without a model, once the learner's small AI help is used up: an
 * accepted answer (or a typo of one, where spelling doesn't matter) is right, anything else isn't,
 * and the sample answer shows what was expected.
 */
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
  const isCorrect = match.kind === "exact" || (isTypo && !lesson.targetLanguage);

  return {
    answerText: answer,
    correctAnswer: isCorrect ? null : content.sampleAnswer,
    feedback: null,
    isCorrect,
    keyPoints: null,
    score: isCorrect ? 1 : 0,
    spelling: isCorrect && isTypo ? match.acceptedAnswer : null,
  };
}

/**
 * A written answer: code settles the accepted answers and a fast model grades the rest one key
 * point at a time, with feedback in the learner's language. In a language course, a spelling that
 * changes a word is a mistake; a typo that doesn't is right, with the spelling shown.
 */
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
    question: withContext(content.context, content.question),
    sampleAnswer: content.sampleAnswer,
    spellingMatters: Boolean(lesson.targetLanguage),
  });

  return {
    answerText: answer.text,
    correctAnswer: data.isCorrect ? null : content.sampleAnswer,
    feedback: data.feedback,
    isCorrect: data.isCorrect,
    keyPoints: data.keyPoints,
    score: data.score,
    spelling: data.isCorrect ? data.spelling : null,
  };
}

/**
 * The typed fallback of a spoken answer: the learner writes what they would say, compared word by
 * word with the target sentence by the same code that grades a recording, so no model runs.
 */
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
    correctAnswer: match.isCorrect ? null : content.targetText,
    feedback: null,
    isCorrect: match.isCorrect,
    keyPoints: null,
    score: match.score,
    spelling: null,
  };
}

/** A challenge keeps its share of good decisions; other code-graded answers have no partial credit. */
function getChallengeScore({ answer, step }: OpenAnswerGrade): number | null {
  if (step.kind !== "challenge" || answer.kind !== "challenge") {
    return null;
  }

  return gradeChallengePath(step.content, answer.choiceIds)?.score ?? null;
}

/**
 * Grades one answer on the server: typed and spoken answers with the grader, everything else with
 * the same code the player runs (a spoken screen answered as its listening exercise included).
 * Returns null when the answer doesn't fit the screen.
 */
export async function gradeLessonAnswer(
  input: OpenAnswerGrade,
): Promise<LessonAnswerVerdict | null> {
  if (input.step.kind === "typedAnswer") {
    return gradeTypedStep(input);
  }

  if (input.step.kind === "spokenAnswer" && input.answer.kind === "spokenAnswer") {
    return gradeSpokenFallback(input);
  }

  const graded = gradeStepAnswer({ answer: input.answer, step: input.step });

  return graded
    ? { ...graded, keyPoints: null, score: getChallengeScore(input), spelling: null }
    : null;
}
