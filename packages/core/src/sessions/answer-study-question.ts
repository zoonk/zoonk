import "server-only";
import { type ItemFormat, prisma } from "@zoonk/db";
import { loadSkillsToRelearn } from "../learner/_utils/load-skill-claims";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { gradeTypedItemAnswer } from "../learner/_utils/typed-grading";
import { applyPlacement } from "../learner/placement/_utils/apply-placement";
import { recordLearnerAnswer } from "../learner/record-learner-answer";
import { applyDrillRules } from "../mistakes/drill-answer";
import { scheduleMistakeCause } from "../mistakes/resolve-mistake-cause";
import { bringBackMissedLessons } from "../plans/bring-back-missed-lessons";
import { isLeftBlank } from "./_utils/net-score";
import { refreshAfterPlacementAnswer } from "./_utils/refresh-plan";
import { loadSessionAnswers } from "./_utils/session-answers";
import {
  type GradedSessionAnswer,
  type SessionItem,
  gradeSessionAnswer,
  parseSessionItem,
} from "./_utils/session-items";
import { loadAnsweredTranscript } from "./_utils/set-transcript";
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
  /** The question's format: how much a right placement answer tells (see `meetsKnownBar`). */
  format: ItemFormat;
  graded: GradedSessionAnswer;
  input: StudyAnswerInput;
  item: SessionItem;
  /** A placement question of the goal's first week, rather than a learning question. */
  placement: boolean;
  /**
   * A miss on a topic the learner was taken to know and practice hadn't confirmed: its lessons
   * come back (see `SkillClaim`).
   */
  relearn: boolean;
  session: StudySessionRow;
  sessionId: string;
  userId: string;
};

/**
 * Records the answer: as learning (memory, the notebook, a drilled mistake's fix), or as a
 * diagnostic placement answer, never a notebook entry, after which whatever placement is now sure
 * of skips what the plan no longer needs. A learning answer that misses a topic the plan skipped
 * as known puts its lessons back.
 */
async function recordStudyAnswer({
  blank,
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

  const recorded = await recordLearnerAnswer({
    answer: graded.recorded,
    graded: { durationMs: input.durationMs, isCorrect: drilled.isCorrect },
    isPlacement: placement,
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
    const { changeId } = await applyPlacement({
      answer: item.skillId
        ? { format, outcome: drilled.isCorrect ? "correct" : "wrong", skillId: item.skillId }
        : null,
      goalId: session.goalId,
      now: new Date(),
      timeZone,
      userId,
    });

    // A skip re-plans as it's announced, and a miss on a topic taken to know brings its lessons back.
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

  return recorded;
}

/**
 * Whether an answer misses a topic the learner was taken to know without studying it (see
 * `loadSkillsToRelearn`), even one practice confirmed once: a first-week placement question on it
 * too, since one right answer may have skipped its lessons.
 */
async function isRelearnMiss({
  isCorrect,
  item,
  session,
}: {
  isCorrect: boolean;
  item: SessionItem;
  session: StudySessionRow;
}): Promise<boolean> {
  if (isCorrect || !session.goalId || !item.skillId) {
    return false;
  }

  const taken = await loadSkillsToRelearn({
    goalId: session.goalId,
    skillIds: [item.skillId],
    userId: session.userId,
  });

  return taken.has(item.skillId);
}

/**
 * Grades an answer (`gradeSessionAnswer`). A typed answer code can't match goes to a model
 * (`gradeTypedItemAnswer`), whose feedback explains the verdict.
 */
async function gradeStudyAnswer({
  answer,
  blockId,
  item,
  userId,
}: {
  answer: StudyAnswerInput["answer"];
  blockId: string;
  item: SessionItem;
  userId: string;
}): Promise<GradedSessionAnswer> {
  const graded = gradeSessionAnswer({ answer, blockId, item });

  if (item.format !== "typed" || graded.isCorrect || !("text" in answer)) {
    return graded;
  }

  const verdict = await gradeTypedItemAnswer({ item, text: answer.text, userId });

  return {
    ...graded,
    explanation: verdict.feedback,
    isCorrect: verdict.isCorrect,
    snapshot: { ...graded.snapshot, explanation: verdict.feedback },
  };
}

/**
 * Grades one answer to a question of the learner's session (a math problem against the numbers its
 * block showed, which the attempt keeps) and records it as learning: the FSRS review of its skill,
 * a notebook entry when wrong (a statement left blank where wrong answers cost a point is neither),
 * and a fix for the drilled mistake when right on a later day. A mistake's drill plays by its
 * rules: a timed drill's answer that takes the whole time box is wrong, and a trap drill names the
 * trap after the answer. The feedback carries the session's Hyperdrive and a pause suggestion when
 * accuracy drops sharply. A placement question of the goal's first week is a diagnostic answer
 * instead: no notebook entry, and whatever placement is now sure of skips what the plan no longer
 * needs, as a change the plan announces with an undo.
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

  // A mock is sat on the mock screen (`saveMockAnswer`), never answered as a study block.
  if (payload.checkpoint?.mock || !getBlockItemIds(payload).includes(input.itemId)) {
    return { status: "invalidItem" };
  }

  const [row, previous] = await Promise.all([
    prisma.item.findUnique({ where: { id: input.itemId } }),
    prisma.attempt.count({ where: { itemId: input.itemId, studySessionId: sessionId, userId } }),
  ]);

  const item = row ? parseSessionItem(row) : null;

  if (!row || !item) {
    return { status: "invalidItem" };
  }

  if (previous > 0) {
    return { status: "alreadyAnswered" };
  }

  const graded = await gradeStudyAnswer({ answer: input.answer, blockId: block.id, item, userId });

  const drill = payload.drills.find((candidate) => candidate.itemIds.includes(item.id));

  const drilled = applyDrillRules({
    drill: drill ?? null,
    durationMs: input.durationMs,
    isCorrect: graded.isCorrect,
    item,
    misconception: graded.snapshot.misconception ?? null,
  });

  const blank = isLeftBlank({ answer: input.answer, itemId: item.id, payload });
  const placement = payload.placementItemIds.includes(item.id);

  const recorded = await recordStudyAnswer({
    blank,
    drill,
    drilled,
    format: row.format,
    graded,
    input,
    item,
    placement,
    relearn: await isRelearnMiss({ isCorrect: drilled.isCorrect, item, session }),
    session,
    sessionId,
    userId,
  });

  const [answers, transcript] = await Promise.all([
    loadSessionAnswers({ blocks: session.blocks, sessionId, userId }),
    loadAnsweredTranscript({
      blockItemIds: getBlockItemIds(payload),
      itemId: item.id,
      sessionId,
      setId: row.setId,
      userId,
    }),
  ]);

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
      transcript,
      trap: isCheckpoint ? null : drilled.trap,
      workedSteps: isCheckpoint ? [] : graded.workedSteps,
    },
    status: "ready",
  };
}
