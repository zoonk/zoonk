import "server-only";
import { type MistakeStatus, prisma } from "@zoonk/db";
import {
  type ChoiceItem,
  getChoiceCorrectAnswer,
  getQuestionText,
  gradeChoiceAnswer,
  parseChoiceItem,
} from "../learner/_utils/choice-items";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { recordLearnerAnswer } from "../learner/record-learner-answer";
import { getSession } from "../users/get-session";
import { type MistakePracticeAnswerInput } from "./contract";
import { applyDrillRules } from "./drill-answer";
import { getDrillKind, getDrillTimeLimitSeconds } from "./mistake-drills";
import { scheduleMistakeCause } from "./resolve-mistake-cause";

/**
 * Feedback for one practice answer: the right answer, why, where the notebook entry stands, the
 * trap a trap drill names, and the answer's id, which finishing the run counts.
 */
type MistakePracticeFeedback = {
  answerId: string;
  correctAnswer: ReturnType<typeof getChoiceCorrectAnswer>;
  explanation: string | null;
  isCorrect: boolean;
  mistakeStatus: MistakeStatus;
  trap: string | null;
};

export type MistakePracticeAnswerResult =
  | { feedback: MistakePracticeFeedback; status: "ready" }
  | { status: "invalidItem" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/** Practice answers the mistake's own question or another question on the same skill. */
async function findPracticeItem({
  itemId,
  mistake,
}: {
  itemId: string;
  mistake: { itemId: string | null; skillId: string | null };
}): Promise<ChoiceItem | null> {
  const item = await prisma.item.findUnique({ where: { id: itemId } });

  const belongs =
    item &&
    (item.id === mistake.itemId || (mistake.skillId !== null && item.skillId === mistake.skillId));

  return belongs ? parseChoiceItem(item) : null;
}

/**
 * Grades one answer from "Practice mistakes" and records it as learning, by the rules of the
 * mistake's drill (a timed drill's answer that takes the whole time box is wrong). Right on a later
 * day than the mistake, it fixes the entry (and any open entry for the same question); wrong, it
 * goes back in the notebook, with a new entry only for a question that wasn't there yet. The run
 * counts toward today when it's finished (`finishMistakePractice`).
 */
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

  const item = await findPracticeItem({ itemId: input.itemId, mistake });

  if (!item) {
    return { status: "invalidItem" };
  }

  const graded = gradeChoiceAnswer({ answer: input.answer, item });
  const kind = getDrillKind(mistake.cause);

  const drilled = applyDrillRules({
    drill: { kind, timeLimitSeconds: getDrillTimeLimitSeconds(kind) },
    durationMs: input.durationMs,
    isCorrect: graded.isCorrect,
    item,
    misconception: graded.snapshot.misconception ?? null,
  });

  const recorded = await recordLearnerAnswer({
    answer: input.answer,
    graded: { durationMs: input.durationMs, isCorrect: drilled.isCorrect },
    itemId: item.id,
    language: item.language,
    mistake: {
      questionText: getQuestionText(item),
      snapshot: graded.snapshot,
      timeLimitMs: drilled.timeLimitMs,
    },
    practicedMistakeId: mistake.id,
    purpose: "learning",
    skillId: item.skillId,
    timeZone: getAnswerTimeZone({ goal: null, timeZone: input.timeZone }),
    userId,
  });

  scheduleMistakeCause(recorded.causeRequest);

  return {
    feedback: {
      answerId: recorded.attempt.id,
      correctAnswer: getChoiceCorrectAnswer(item),
      explanation: graded.snapshot.explanation ?? null,
      isCorrect: drilled.isCorrect,
      mistakeStatus: recorded.fixedMistakeIds.includes(mistake.id) ? "fixed" : mistake.status,
      trap: drilled.trap,
    },
    status: "ready",
  };
}
