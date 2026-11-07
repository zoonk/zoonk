import "server-only";
import { z } from "zod";
import { type LessonStepAnswer, type LibraryLessonRun, lessonStepAnswerSchema } from "../contract";
import { type PlayableLibraryLesson, type PlayableLibraryStep } from "../playable-lesson";
import { toCheckResult, toSavedVerdict } from "./check-results";
import { type LessonAnswerVerdict, gradeLessonAnswer } from "./grade-lesson-answer";
import { type ProgressAttempt } from "./lesson-runs";

type RestoringLesson = Pick<PlayableLibraryLesson, "language" | "steps" | "targetLanguage">;

type RegradedAnswer = {
  answer: LessonStepAnswer | null;
  fromCode: boolean;
  verdict: LessonAnswerVerdict;
};

const recordingSchema = z.object({ kind: z.literal("spoken"), transcript: z.string() });

const UNGRADED_VERDICT: LessonAnswerVerdict = {
  answerText: null,
  checked: false,
  correctAnswer: null,
  corrections: [],
  expected: null,
  feedback: null,
  isCorrect: false,
  keyPoints: null,
  score: null,
  spelling: null,
};

const UNGRADED: RegradedAnswer = { answer: null, fromCode: false, verdict: UNGRADED_VERDICT };

function readRecording({
  saved,
  step,
}: {
  saved: ProgressAttempt["answer"];
  step: PlayableLibraryStep | undefined;
}): RegradedAnswer | null {
  const recording = recordingSchema.safeParse(saved);

  if (!recording.success) {
    return null;
  }

  const targetText = step?.kind === "spokenAnswer" ? step.content.targetText : null;

  return {
    ...UNGRADED,
    verdict: {
      ...UNGRADED_VERDICT,
      answerText: recording.data.transcript,
      correctAnswer: targetText,
    },
  };
}

async function regrade({
  attempt,
  lesson,
  userId,
}: {
  attempt: ProgressAttempt;
  lesson: RestoringLesson | null;
  userId: string;
}): Promise<RegradedAnswer> {
  const step = lesson?.steps.find((item) => item.id === attempt.stepId);
  const recording = readRecording({ saved: attempt.answer, step });

  if (recording) {
    return recording;
  }

  const parsed = lessonStepAnswerSchema.safeParse(attempt.answer);

  if (!parsed.success || !lesson || !step) {
    return UNGRADED;
  }

  const verdict = await gradeLessonAnswer({
    answer: parsed.data,
    lesson,
    step,
    useModel: false,
    userId,
  });

  return verdict ? { answer: parsed.data, fromCode: true, verdict } : UNGRADED;
}

async function restoreRunAnswer({
  attempt,
  lesson,
  userId,
}: {
  attempt: ProgressAttempt;
  lesson: RestoringLesson | null;
  userId: string;
}): Promise<LibraryLessonRun["answers"][number]> {
  const { answer, fromCode, verdict } = await regrade({ attempt, lesson, userId });
  const saved = toSavedVerdict({ fromCode, saved: attempt, verdict });

  return {
    answer,
    answeredAt: attempt.answeredAt.toISOString(),
    isCorrect: attempt.isCorrect,
    result: {
      ...toCheckResult({ nextReviewAt: null, savedMistake: false, verdict: saved }),
      answerText: saved.answerText,
    },
    stepId: attempt.stepId,
  };
}

/** Rebuilds each answer's result from what was saved, by code alone: no model call and no writes. */
export function restoreRunAnswers({
  attempts,
  lesson,
  userId,
}: {
  attempts: readonly ProgressAttempt[];
  lesson: RestoringLesson | null;
  userId: string;
}): Promise<LibraryLessonRun["answers"]> {
  return Promise.all(attempts.map((attempt) => restoreRunAnswer({ attempt, lesson, userId })));
}
