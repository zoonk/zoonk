import "server-only";
import { type Attempt, type Mistake } from "@zoonk/db";
import { z } from "zod";
import { recordAnswerOnce } from "../../learner/_utils/answer-once";
import { getLearnerTimeZone } from "../../learner/_utils/goal-time-zone";
import { claimModelGrade } from "../../learner/_utils/model-grading";
import { toCheckResult } from "../../lesson-player/_utils/check-results";
import {
  type LessonAnswerVerdict,
  gradeLessonAnswer,
} from "../../lesson-player/_utils/grade-lesson-answer";
import { getStepQuestion } from "../../lesson-player/_utils/step-question";
import { getStepSampleAnswer } from "../../lesson-player/_utils/step-sample-answer";
import { lessonStepAnswerSchema, lessonStepCheckResultSchema } from "../../lesson-player/contract";
import { type PlayableLibraryStep } from "../../lesson-player/playable-lesson";
import { NOTHING_REACHED } from "../../sessions/reached";
import { type MistakePracticeAnswerResult } from "../answer-mistake-practice";
import { type MistakePracticeAnswerInput } from "../contract";
import { applyDrillRules } from "../drill-answer";
import { type MistakeDrillKind } from "../mistake-drills";
import { type MistakeReplay } from "../mistake-replay";
import { readMistakeSnapshot } from "../mistake-snapshot";
import { cachedGradeDuration } from "./cached-grade-duration";
import { runMistakeGrade } from "./mistake-grade";
import { finishPracticeAnswer } from "./practice-feedback";
import { readSavedPracticeAnswer } from "./saved-practice-answer";

const lessonAnswerVerdictSchema = lessonStepCheckResultSchema
  .omit({ savedMistake: true })
  .extend({ answerText: z.string().nullable() });

function skippedAnswer(step: PlayableLibraryStep, snapshot: unknown): LessonAnswerVerdict {
  return {
    answerText: null,
    checked: true,
    correctAnswer: getStepSampleAnswer(step) ?? readMistakeSnapshot(snapshot).correctAnswer ?? null,
    corrections: [],
    expected: null,
    feedback: null,
    isCorrect: false,
    keyPoints: null,
    score: null,
    spelling: null,
  };
}

type LessonPracticeAnswer = Extract<MistakePracticeAnswerInput, { stepId: string }>["answer"];

function usesModel({
  answer,
  step,
}: {
  answer: LessonPracticeAnswer;
  step: PlayableLibraryStep;
}): boolean {
  return step.kind === "typedAnswer" && "kind" in answer && answer.kind === "typedAnswer";
}

function recordedLessonAnswer({
  answer,
  verdict,
}: {
  answer: LessonPracticeAnswer;
  verdict: LessonAnswerVerdict;
}): LessonPracticeAnswer {
  return "kind" in answer && answer.kind === "typedAnswer" && verdict.answerText !== null
    ? { kind: "typedAnswer", text: verdict.answerText }
    : answer;
}

export async function answerLessonMistake({
  input,
  mistake,
  replay,
  userId,
  attemptId,
  saved,
  kind,
  timeLimitSeconds,
}: {
  input: Extract<MistakePracticeAnswerInput, { stepId: string }>;
  mistake: Mistake;
  replay: Extract<MistakeReplay, { kind: "lesson" }>;
  userId: string;
  attemptId: string;
  saved: Attempt | null;
  kind: MistakeDrillKind;
  timeLimitSeconds: number | null;
}): Promise<MistakePracticeAnswerResult> {
  const { lesson } = replay;

  const answer = saved
    ? z
        .union([lessonStepAnswerSchema, z.object({ dontKnow: z.literal(true) }).strict()])
        .parse(readSavedPracticeAnswer(saved.answer))
    : input.answer;

  const grade = async (useModel: boolean) =>
    "dontKnow" in answer
      ? skippedAnswer(lesson.step, mistake.snapshot)
      : gradeLessonAnswer({ answer, lesson, step: lesson.step, useModel, userId });

  const unknown = "dontKnow" in answer;
  const model = usesModel({ answer, step: lesson.step });

  const graded = model
    ? await runMistakeGrade({
        attemptId,
        grade: async () => ({
          durationMs: input.durationMs,
          verdict: await grade(
            !saved &&
              (await claimModelGrade({
                id: attemptId,
                question: { stepId: lesson.step.id },
                userId,
              })),
          ),
        }),
        questionId: lesson.step.id,
        userId,
      })
    : { result: { verdict: await grade(false) }, status: "ready" as const };

  if (graded.status !== "ready") {
    return graded;
  }

  const verdict = graded.result.verdict
    ? lessonAnswerVerdictSchema.parse(graded.result.verdict)
    : null;

  if (!verdict) {
    return { status: "invalidItem" };
  }

  if (!verdict.checked && !saved) {
    return {
      feedback: {
        answerId: null,
        correctAnswer: null,
        explanation: verdict.feedback,
        fixed: false,
        fixedMistakeIds: [],
        isCorrect: false,
        lessonResult: toCheckResult({ savedMistake: false, verdict }),
        mistakeStatus: mistake.status,
        reached: NOTHING_REACHED,
        trap: null,
        workedSteps: [],
      },
      status: "ready",
    };
  }

  const canonicalAnswer = recordedLessonAnswer({ answer, verdict });
  const durationMs = cachedGradeDuration({ fallback: input.durationMs, result: graded.result });

  const drilled = applyDrillRules({
    dontKnow: unknown,
    drill: { kind, timeLimitSeconds },
    durationMs,
    isCorrect: saved?.isCorrect ?? verdict.isCorrect,
    misconception: null,
  });

  const outcome = saved
    ? { saved, status: "saved" as const }
    : await recordAnswerOnce({
        answer: {
          answer: { ...canonicalAnswer, practiceMistakeId: mistake.id },
          attemptId,
          graded: { durationMs, isCorrect: drilled.isCorrect, score: verdict.score },
          language: lesson.language,
          mistake: {
            questionText:
              getStepQuestion(lesson.step) ?? readMistakeSnapshot(mistake.snapshot).question,
            snapshot: {
              ...readMistakeSnapshot(mistake.snapshot),
              answer: verdict.answerText,
              correctAnswer: verdict.correctAnswer,
              explanation: verdict.feedback,
              replay,
            },
            timeLimitMs: drilled.timeLimitMs,
          },
          practiceQuestion: { id: lesson.step.id, kind: "lesson" },
          practicedMistakeId: mistake.id,
          purpose: "learning",
          skillId: mistake.skillId,
          stepId: mistake.stepId,
          targetLanguage: lesson.targetLanguage,
          timeZone: await getLearnerTimeZone({ timeZone: input.timeZone, userId }),
          userId,
        },
      });

  const isCorrect =
    outcome.status === "saved" ? outcome.saved.isCorrect : outcome.recorded.attempt.isCorrect;

  const lessonResult = toCheckResult({
    savedMistake: !isCorrect,
    verdict: {
      ...verdict,
      checked: saved ? true : verdict.checked,
      correctAnswer: saved?.isCorrect ? null : verdict.correctAnswer,
      isCorrect,
    },
  });

  return {
    feedback: await finishPracticeAnswer({
      answerId: outcome.status === "saved" ? outcome.saved.id : outcome.recorded.attempt.id,
      feedback: {
        correctAnswer: null,
        explanation: verdict.feedback,
        isCorrect,
        lessonResult,
        trap: drilled.trap,
        workedSteps: [],
      },
      input,
      mistakeId: mistake.id,
    }),
    status: "ready",
  };
}
