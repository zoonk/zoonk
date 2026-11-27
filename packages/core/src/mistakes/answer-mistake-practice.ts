import "server-only";
import { prisma } from "@zoonk/db";
import { findSavedAttempt, getAnswerAttemptId } from "../learner/_utils/answer-once";
import { saveDayBeforeActivity } from "../sessions/ensure-study-session";
import { getSession } from "../users/get-session";
import { answerItemMistake } from "./_utils/answer-item-mistake";
import { answerLessonMistake } from "./_utils/answer-lesson-mistake";
import { getPracticeAnswerScope } from "./_utils/practice-answer-scope";
import { finishPracticeAnswer, readPracticeFeedback } from "./_utils/practice-feedback";
import { visibleMistakeWhere } from "./_utils/visible-mistake";
import { type MistakePracticeAnswerInput } from "./contract";
import { getDrillKind, getDrillTimeLimitSeconds } from "./mistake-drills";
import { type MistakeReplay, loadMistakeReplay } from "./mistake-replay";
import { type MistakePracticeFeedback } from "./practice-feedback";

export type MistakePracticeAnswerResult =
  | { feedback: MistakePracticeFeedback; status: "ready" }
  | { status: "invalidItem" | "notFound" | "unauthorized" | "retryable" };

function matchesQuestion({
  input,
  replay,
}: {
  input: MistakePracticeAnswerInput;
  replay: MistakeReplay;
}) {
  return replay.kind === "item"
    ? "itemId" in input && input.itemId === replay.item.id
    : "stepId" in input && input.stepId === replay.lesson.step.id;
}

/** A new answer must target the exact saved source of an open entry. */
export function answerMistakePractice(input: {
  input: Extract<MistakePracticeAnswerInput, { itemId: string }>;
  mistakeId: string;
}): Promise<
  | Exclude<MistakePracticeAnswerResult, { status: "ready" }>
  | { status: "ready"; feedback: MistakePracticeFeedback & { answerId: string } }
>;
export function answerMistakePractice(input: {
  input: MistakePracticeAnswerInput;
  mistakeId: string;
}): Promise<MistakePracticeAnswerResult>;
export async function answerMistakePractice({
  input,
  mistakeId,
}: {
  input: MistakePracticeAnswerInput;
  mistakeId: string;
}): Promise<MistakePracticeAnswerResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;

  const mistake = await prisma.mistake.findFirst({
    where: { ...visibleMistakeWhere, id: mistakeId, userId },
  });

  if (!mistake) {
    return { status: "notFound" };
  }

  const attemptId = getAnswerAttemptId({
    key: input.attemptId ?? crypto.randomUUID(),
    questionId: mistake.id,
    userId,
  });

  const [saved, scope] = await Promise.all([
    findSavedAttempt({ attemptId, userId }),
    getPracticeAnswerScope({
      blockId: input.run?.blockId,
      goalId: input.run?.goalId,
      mistakeId: mistake.id,
      timeZone: input.timeZone,
      userId,
    }),
  ]);

  if (!scope) {
    return { status: "notFound" };
  }

  const { goalId, timeZone } = scope;
  const feedback = saved && readPracticeFeedback(saved);

  if (saved && feedback) {
    return {
      feedback: await finishPracticeAnswer({ attempt: saved, feedback, input, mistakeId }),
      status: "ready",
    };
  }

  if (!saved && mistake.status !== "open") {
    return { status: "invalidItem" };
  }

  const replay = await loadMistakeReplay({ mistake, userId });

  if (!replay || !matchesQuestion({ input, replay })) {
    return { status: "invalidItem" };
  }

  const kind = getDrillKind(mistake.cause);
  const timeLimitSeconds = getDrillTimeLimitSeconds(kind);

  if (!saved) {
    await saveDayBeforeActivity({ goalId, timeZone, userId });
  }

  if (replay.kind === "item" && "itemId" in input) {
    return answerItemMistake({
      attemptId,
      input,
      kind,
      mistake,
      replay,
      saved,
      timeLimitSeconds,
      timeZone,
      userId,
    });
  }

  if (replay.kind !== "lesson" || !("stepId" in input)) {
    return { status: "invalidItem" };
  }

  return answerLessonMistake({
    attemptId,
    input,
    kind,
    mistake,
    replay,
    saved,
    timeLimitSeconds,
    timeZone,
    userId,
  });
}
