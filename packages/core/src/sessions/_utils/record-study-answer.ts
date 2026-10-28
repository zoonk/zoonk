import { type ItemFormat, type StudySessionBlock } from "@zoonk/db";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { applyPlacement } from "../../learner/placement/_utils/apply-placement";
import { type LearnerAnswer } from "../../learner/record-learner-answer";
import { type applyDrillRules } from "../../mistakes/drill-answer";
import { scheduleMistakeCause } from "../../mistakes/resolve-mistake-cause";
import { bringBackMissedLessons } from "../../plans/bring-back-missed-lessons";
import { type BlockDrill } from "../block-payload";
import { type StudyAnswerInput } from "../contract";
import { recordSessionAttempt } from "./record-session-attempt";
import { refreshAfterPlacementAnswer } from "./refresh-plan";
import { type GradedSessionAnswer, type SessionItem } from "./session-items";
import { type StudySessionRow } from "./study-session-access";

type StudyAnswerRecord = {
  block: StudySessionBlock;
  /** A net-scored statement left blank: no notebook entry, since it isn't a mistake. */
  blank: boolean;
  drill: BlockDrill | undefined;
  drilled: ReturnType<typeof applyDrillRules>;
  format: ItemFormat;
  graded: GradedSessionAnswer;
  input: StudyAnswerInput;
  item: SessionItem;
  /** A placement question of the goal's first week, rather than a learning question. */
  placement: boolean;
  /** A miss on an unconfirmed known claim restores its lessons. */
  relearn: boolean;
  session: StudySessionRow;
  sessionId: string;
  userId: string;
};

/** Placement answers skip notebook writes; learning misses on unconfirmed known topics restore their lessons. */
export async function recordStudyAnswer({
  blank,
  block,
  drill,
  drilled,
  format,
  graded,
  input,
  item,
  placement,
  relearn,
  session,
  sessionId,
  userId,
}: StudyAnswerRecord) {
  const timeZone = getAnswerTimeZone({ goal: session.goal, timeZone: input.timeZone });

  const learnerAnswer = {
    answer: graded.recorded,
    graded: { durationMs: input.durationMs, isCorrect: drilled.isCorrect },
    isPlacement: placement,
    itemId: item.id,
    language: item.language,
    mistake: getAnswerMistake({ blank, drilled, graded }),
    practicedMistakeId: drill?.mistakeId ?? null,
    purpose: placement ? "diagnostic" : "learning",
    skillId: item.skillId,
    studySessionId: sessionId,
    timeZone,
    userId,
  } satisfies LearnerAnswer;

  const claimed = await recordSessionAttempt({ blockId: block.id, input: learnerAnswer });

  if (claimed.status !== "ready") {
    return claimed;
  }

  if (!claimed.created) {
    return { recorded: claimed.recorded, status: "ready" as const };
  }

  const { recorded } = claimed;

  scheduleMistakeCause(recorded.causeRequest);

  if (placement && session.goalId) {
    const { changeId } = await applyPlacement({
      answer: item.skillId
        ? { format, outcome: drilled.isCorrect ? "correct" : "wrong", skillId: item.skillId }
        : null,
      goalId: session.goalId,
      now: new Date(),
      timeZone,
      userId,
    });

    if (!changeId && !relearn && item.skillId) {
      refreshAfterPlacementAnswer({
        answeredAt: recorded.attempt.answeredAt,
        goalId: session.goalId,
        skillId: item.skillId,
        userId,
      });
    }
  }

  if (relearn && session.goalId && item.skillId) {
    await bringBackMissedLessons({
      goalId: session.goalId,
      now: new Date(),
      skillIds: [item.skillId],
      timeZone,
    });
  }

  return { recorded, status: "ready" as const };
}

function getAnswerMistake({
  blank,
  drilled,
  graded,
}: Pick<StudyAnswerRecord, "blank" | "drilled" | "graded">) {
  if (blank) {
    return null;
  }

  return {
    questionText: graded.snapshot.question,
    snapshot: graded.snapshot,
    timeLimitMs: drilled.timeLimitMs,
  };
}
