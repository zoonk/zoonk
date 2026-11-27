import { type AttemptEvidence, type StudySessionBlock } from "@zoonk/db";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { applyPlacement } from "../../learner/placement/_utils/apply-placement";
import { type LearnerAnswer } from "../../learner/record-learner-answer";
import { type applyDrillRules } from "../../mistakes/drill-answer";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { type StudyAnswerInput } from "../contract";
import { recordSessionAttempt } from "./record-session-attempt";
import { refreshAfterPlacementAnswer } from "./refresh-plan";
import { type GradedSessionAnswer, type SessionItem } from "./session-items";
import { settleSavedSessionRecheck } from "./settle-saved-session-recheck";
import { type StudySessionRow } from "./study-session-access";

type StudyAnswerRecord = {
  block: StudySessionBlock;
  /** A net-scored statement left blank: no notebook entry, since it isn't a mistake. */
  blank: boolean;
  drilled: ReturnType<typeof applyDrillRules>;
  graded: GradedSessionAnswer;
  input: StudyAnswerInput;
  item: SessionItem;
  passedOverMiss: boolean;
  /** A placement question of the goal's first week, rather than a learning question. */
  placement: boolean;
  recheck: boolean;
  session: StudySessionRow;
  sessionId: string;
  userId: string;
};

/** A placement question or a net-scored blank says nothing about what the learner can do alone. */
export function getStudyAnswerEvidence({
  blank,
  placement,
}: Pick<StudyAnswerRecord, "blank" | "placement">): AttemptEvidence | null {
  return blank || placement ? null : "independent";
}

/** Placement answers skip notebook writes; learning misses on unconfirmed known topics restore their lessons. */
export async function recordStudyAnswer({
  blank,
  block,
  drilled,
  graded,
  input,
  item,
  passedOverMiss,
  placement,
  recheck,
  session,
  sessionId,
  userId,
}: StudyAnswerRecord) {
  const timeZone = getAnswerTimeZone({ goal: session.goal, timeZone: input.timeZone });

  const learnerAnswer = {
    answer: {
      ...graded.recorded,
      ...(passedOverMiss && { passedOverMiss: true }),
      ...(recheck && { placementRecheck: true }),
    },
    evidence: getStudyAnswerEvidence({ blank, placement }),
    graded: { durationMs: input.durationMs, isCorrect: drilled.isCorrect },
    isPlacement: placement,
    itemId: item.id,
    language: item.language,
    mistake: getAnswerMistake({ blank, drilled, graded }),
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
    return { created: false, recorded: claimed.recorded, status: "ready" as const };
  }

  const { recorded } = claimed;
  const livingPlanDay = toIsoDate(session.localDate);

  if (placement && !recheck && session.goalId) {
    const { changeId } = await applyPlacement({
      followToday: false,
      goalId: session.goalId,
      livingPlanDay,
      now: new Date(),
      timeZone,
      userId,
    });

    if (!changeId && item.skillId) {
      refreshAfterPlacementAnswer({
        answeredAt: recorded.attempt.answeredAt,
        goalId: session.goalId,
        skillId: item.skillId,
        userId,
      });
    }
  }

  if (recheck || passedOverMiss) {
    await settleSavedSessionRecheck({ attempt: recorded.attempt, session, timeZone });
  }

  return { created: true, recorded, status: "ready" as const };
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
