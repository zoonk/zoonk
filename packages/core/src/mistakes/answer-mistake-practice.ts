import "server-only";
import { prisma } from "@zoonk/db";
import { getAnswerAttemptId } from "../learner/_utils/answer-once";
import { saveDayBeforeActivity } from "../sessions/ensure-study-session";
import { getSession } from "../users/get-session";
import { answerItemMistake } from "./_utils/answer-item-mistake";
import { answerLessonMistake } from "./_utils/answer-lesson-mistake";
import { readPracticeClaim } from "./_utils/practice-claim";
import { type MistakePracticeAnswerInput } from "./contract";
import { getDrillKind, getDrillTimeLimitSeconds } from "./mistake-drills";
import { loadMistakeReplay } from "./mistake-replay";
import { type MistakePracticeFeedback } from "./practice-feedback";

export type MistakePracticeAnswerResult =
  | { feedback: MistakePracticeFeedback; status: "ready" }
  | { status: "invalidItem" | "notFound" | "unauthorized" | "retryable" };

/** The answer must target the exact saved source; skill membership never substitutes for identity. A mistake that isn't ready returns the answer that counted for it today. */
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
  const mistake = await prisma.mistake.findFirst({ where: { id: mistakeId, userId } });

  if (!mistake) {
    return { status: "notFound" };
  }

  const replay = await loadMistakeReplay({ mistake, userId });

  if (
    !replay ||
    (replay.kind === "item"
      ? !("itemId" in input) || input.itemId !== replay.item.id
      : !("stepId" in input) || input.stepId !== replay.lesson.step.id)
  ) {
    return { status: "invalidItem" };
  }

  const attemptId = getAnswerAttemptId({
    key: input.attemptId ?? crypto.randomUUID(),
    questionId: mistake.id,
    userId,
  });

  const claim = await readPracticeClaim({
    attemptId,
    goalId: input.run?.goalId,
    mistakeId: mistake.id,
    timeZone: input.timeZone,
    userId,
  });

  if (!claim) {
    return { status: "invalidItem" };
  }

  const { saved, timeZone } = claim;

  const kind = getDrillKind(mistake.cause);
  const timeLimitSeconds = getDrillTimeLimitSeconds(kind);
  await saveDayBeforeActivity({ goalId: input.run?.goalId, timeZone: input.timeZone, userId });

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
