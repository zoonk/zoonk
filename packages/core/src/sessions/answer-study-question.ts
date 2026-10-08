import "server-only";
import { prisma } from "@zoonk/db";
import { checkReviewPace } from "../entitlements/check-review-pace";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { applyPlacement } from "../learner/placement/_utils/apply-placement";
import { recordLearnerAnswer } from "../learner/record-learner-answer";
import { applyDrillRules } from "../mistakes/drill-answer";
import { scheduleMistakeCause } from "../mistakes/resolve-mistake-cause";
import { isLeftBlank } from "./_utils/net-score";
import { loadSessionAnswers } from "./_utils/session-answers";
import { type SessionItem, gradeSessionAnswer, parseSessionItem } from "./_utils/session-items";
import { type StudySessionRow, findOwnedStudyBlock } from "./_utils/study-session-access";
import { type BlockDrill, getBlockItemIds, readBlockPayload } from "./block-payload";
import { getHyperdriveLevel, scoreAnswers } from "./brain-power";
import { type StudyAnswerInput, type StudyAnswerResult } from "./contract";
import { shouldSuggestPause } from "./pause-suggestion";

type StudyAnswerRecord = {
  /** A net-scored statement left blank: no notebook entry, since it isn't a mistake. */
  blank: boolean;
  drill: BlockDrill | undefined;
  drilled: ReturnType<typeof applyDrillRules>;
  graded: ReturnType<typeof gradeSessionAnswer>;
  input: StudyAnswerInput;
  item: SessionItem;
  /** A placement question of the goal's first week, rather than a learning question. */
  placement: boolean;
  session: StudySessionRow;
  sessionId: string;
  userId: string;
};

/**
 * Records the answer: as learning (memory, the notebook, a drilled mistake's fix), or as a
 * diagnostic placement answer, never a notebook entry, after which whatever placement is now sure
 * of skips what the plan no longer needs.
 */
async function recordStudyAnswer({
  blank,
  drill,
  drilled,
  graded,
  input,
  item,
  placement,
  session,
  sessionId,
  userId,
}: StudyAnswerRecord) {
  const timeZone = getAnswerTimeZone({ goal: session.goal, timeZone: input.timeZone });

  const recorded = await recordLearnerAnswer({
    answer: graded.recorded,
    graded: { durationMs: input.durationMs, isCorrect: drilled.isCorrect },
    itemId: item.id,
    language: item.language,
    mistake: blank
      ? null
      : {
          questionText: graded.snapshot.question,
          snapshot: graded.snapshot,
          timeLimitMs: drilled.timeLimitMs,
        },
    practicedMistakeId: drill?.mistakeId ?? null,
    purpose: placement ? "diagnostic" : "learning",
    skillId: item.skillId,
    studySessionId: sessionId,
    timeZone,
    userId,
  });

  scheduleMistakeCause(recorded.causeRequest);

  if (placement && session.goalId) {
    await applyPlacement({ goalId: session.goalId, now: new Date(), timeZone, userId });
  }

  return recorded;
}

/**
 * Grades one answer to a question of the learner's session (a math problem against the numbers its
 * block showed, which the attempt keeps) and records it as learning: the FSRS review of its skill,
 * a notebook entry when wrong (a statement left blank where wrong answers cost a point is neither),
 * and a fix for the drilled mistake when right on a later day. A
 * mistake's drill plays by its rules: a timed drill's answer that takes the whole time box is wrong,
 * and a trap drill names the trap after the answer. Reviews
 * only slow down at unusual volume. The feedback carries the session's Hyperdrive and a pause
 * suggestion when accuracy drops sharply. A placement question of the goal's first week is a
 * diagnostic answer instead: no notebook entry, and whatever placement is now sure of skips what the
 * plan no longer needs, as a change the plan announces with an undo.
 */
export async function answerStudyQuestion({
  blockId,
  input,
  sessionId,
}: {
  blockId: string;
  input: StudyAnswerInput;
  sessionId: string;
}): Promise<StudyAnswerResult> {
  const owned = await findOwnedStudyBlock({ blockId, sessionId });

  if (owned.status !== "ready") {
    return owned;
  }

  const { block, session, userId } = owned;
  const payload = readBlockPayload(block);

  if (block.status !== "active") {
    return { status: "blockNotActive" };
  }

  if (!getBlockItemIds(payload).includes(input.itemId)) {
    return { status: "invalidItem" };
  }

  const [row, previous] = await Promise.all([
    prisma.item.findUnique({ where: { id: input.itemId } }),
    prisma.attempt.count({ where: { itemId: input.itemId, studySessionId: sessionId, userId } }),
  ]);

  const item = row ? parseSessionItem(row) : null;

  if (!item) {
    return { status: "invalidItem" };
  }

  if (previous > 0) {
    return { status: "alreadyAnswered" };
  }

  if (block.kind === "review") {
    const pace = await checkReviewPace();

    if (pace.status === "slowDown") {
      return pace;
    }
  }

  const graded = gradeSessionAnswer({ answer: input.answer, blockId: block.id, item });
  const drill = payload.drills.find((candidate) => candidate.itemIds.includes(item.id));

  const drilled = applyDrillRules({
    drill: drill ?? null,
    durationMs: input.durationMs,
    isCorrect: graded.isCorrect,
    item,
    misconception: graded.snapshot.misconception ?? null,
  });

  const blank = isLeftBlank({ answer: input.answer, itemId: item.id, payload });

  const recorded = await recordStudyAnswer({
    blank,
    drill,
    drilled,
    graded,
    input,
    item,
    placement: payload.placementItemIds.includes(item.id),
    session,
    sessionId,
    userId,
  });

  const answers = await loadSessionAnswers({ blocks: session.blocks, sessionId, userId });
  const { streak } = scoreAnswers({ answers });
  const isCheckpoint = block.kind === "checkpoint";

  return {
    feedback: {
      blank,
      correctAnswer: isCheckpoint ? null : graded.correctAnswer,
      explanation: isCheckpoint ? null : graded.explanation,
      hyperdrive: { level: getHyperdriveLevel(streak), streak },
      isCorrect: drilled.isCorrect,
      mistakeFixed: drill !== undefined && recorded.fixedMistakeIds.includes(drill.mistakeId),
      pauseSuggested: shouldSuggestPause(answers.map((answer) => answer.isCorrect)),
      savedToNotebook: recorded.mistake !== null,
      trap: isCheckpoint ? null : drilled.trap,
      workedSteps: isCheckpoint ? [] : graded.workedSteps,
    },
    status: "ready",
  };
}
