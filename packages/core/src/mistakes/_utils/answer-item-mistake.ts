import "server-only";
import { type Attempt, type Mistake } from "@zoonk/db";
import { z } from "zod";
import { recordAnswerOnce } from "../../learner/_utils/answer-once";
import { gradeTypedItemAnswer } from "../../learner/_utils/typed-grading";
import { readRecordedAnswer } from "../../sessions/_utils/session-items";
import { type MistakePracticeAnswerResult } from "../answer-mistake-practice";
import { type MistakePracticeAnswerInput } from "../contract";
import { applyDrillRules } from "../drill-answer";
import { type MistakeDrillKind } from "../mistake-drills";
import { getAnsweredShowing, getPracticeAnswerKeys, gradeMistakeItem } from "../mistake-item";
import { type MistakeReplay } from "../mistake-replay";
import { cachedGradeDuration } from "./cached-grade-duration";
import { runMistakeGrade } from "./mistake-grade";
import { refuseClosedMistake } from "./practice-claim";
import { finishPracticeAnswer } from "./practice-feedback";

const typedVerdictSchema = z.object({ feedback: z.string().nullable(), isCorrect: z.boolean() });

export async function answerItemMistake({
  input,
  mistake,
  replay,
  userId,
  attemptId,
  saved,
  kind,
  timeLimitSeconds,
  timeZone,
}: {
  input: Extract<MistakePracticeAnswerInput, { itemId: string }>;
  mistake: Mistake;
  replay: Extract<MistakeReplay, { kind: "item" }>;
  userId: string;
  attemptId: string;
  saved: Attempt | null;
  kind: MistakeDrillKind;
  timeLimitSeconds: number | null;
  timeZone: string;
}): Promise<MistakePracticeAnswerResult> {
  const { item } = replay;
  const answer = saved ? (readRecordedAnswer(saved.answer) ?? input.answer) : input.answer;

  const showing = saved ? getAnsweredShowing({ answer: saved.answer, mistake }) : input.showing;
  const graded = gradeMistakeItem({ answer, replay, showing });
  const model = item.format === "typed" && "text" in answer && !graded.isCorrect;

  if (model && !input.attemptId) {
    return { status: "invalidItem" };
  }

  const checked =
    model && item.format === "typed" && "text" in answer
      ? await runMistakeGrade({
          attemptId,
          grade: async () => ({
            durationMs: input.durationMs,
            text: answer.text,
            verdict: saved
              ? { feedback: null, isCorrect: saved.isCorrect }
              : await gradeTypedItemAnswer({
                  claimId: attemptId,
                  item,
                  practicedLanguage: null,
                  text: answer.text,
                  userId,
                }),
          }),
          questionId: item.id,
          userId,
        })
      : {
          result: { verdict: { feedback: graded.explanation, isCorrect: graded.isCorrect } },
          status: "ready" as const,
        };

  if (checked.status !== "ready") {
    return checked;
  }

  const verdict = typedVerdictSchema.parse(checked.result.verdict);

  const text =
    "text" in checked.result && typeof checked.result.text === "string"
      ? checked.result.text
      : null;

  const canonical =
    item.format === "typed" && text !== null
      ? gradeMistakeItem({ answer: { text }, replay, showing })
      : graded;

  const durationMs = cachedGradeDuration({ fallback: input.durationMs, result: checked.result });

  const drilled = applyDrillRules({
    dontKnow: "dontKnow" in answer,
    drill: { kind, timeLimitSeconds },
    durationMs,
    isCorrect: verdict.isCorrect,
    misconception: graded.snapshot.misconception ?? null,
  });

  const feedback = {
    correctAnswer: graded.correctAnswer,
    explanation: verdict.feedback,
    lessonResult: null,
    trap: drilled.trap,
    workedSteps: graded.workedSteps,
  };

  const outcome = saved
    ? { saved, status: "saved" as const }
    : await recordAnswerOnce({
        answer: {
          answer: {
            ...canonical.recorded,
            ...getPracticeAnswerKeys({ feedback, mistake, showing }),
          },
          attemptId,
          graded: { durationMs, isCorrect: drilled.isCorrect },
          itemId: mistake.itemId,
          language: replay.item.language,
          mistake: {
            questionText: graded.snapshot.question,
            snapshot: { ...canonical.snapshot, explanation: verdict.feedback },
            timeLimitMs: drilled.timeLimitMs,
          },
          practiceQuestion: { id: replay.item.id, kind: "item" },
          practicedMistakeId: mistake.id,
          purpose: "learning",
          skillId: mistake.skillId,
          timeZone,
          userId,
        },
        refuse: refuseClosedMistake({ mistakeId: mistake.id, userId }),
      });

  if (outcome.status === "refused") {
    return { status: "invalidItem" };
  }

  return {
    feedback: await finishPracticeAnswer({
      attempt: outcome.status === "saved" ? outcome.saved : outcome.recorded.attempt,
      feedback,
      input,
      mistakeId: mistake.id,
    }),
    status: "ready",
  };
}
