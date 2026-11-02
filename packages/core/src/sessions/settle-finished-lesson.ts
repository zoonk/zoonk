import "server-only";
import { finishExplanations } from "../goals/_utils/finish-explanations";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { findDayLessonBlock } from "./_utils/day-lesson-block";
import { completeLessonPlanItems, scheduleLessonCanDos } from "./_utils/plan-items";
import { type ProgressChange } from "./_utils/session-progress";
import { type StudyBlockCompletion } from "./completion-contract";
import { finishLessonBlock } from "./finish-study-block";

/** Internal authenticated caller, after closing the lesson ledger; checks off all plans and returns session completion only for its unfinished block. */
export async function settleFinishedLesson({
  blockId,
  energy,
  lessonId,
  runStartedAt,
  timeZone,
  userId,
}: {
  blockId?: string;
  /** Energy before and after the lesson, when its completion just added it (not on a replay). */
  energy?: ProgressChange | null;
  lessonId: string;
  runStartedAt?: Date;
  timeZone: string;
  userId: string;
}): Promise<StudyBlockCompletion | null> {
  const languageGoals = await writeLearnerChange({ planInputs: true, userId }, async (tx) => {
    // Lock the items still to do: a test-out that takes one meanwhile is seen, not raced.
    const open = await tx.$queryRaw<{ id: string }[]>`
      SELECT item.id FROM plan_items AS item
      JOIN plans AS plan ON plan.id = item.plan_id
      JOIN goals AS goal ON goal.id = plan.goal_id
      WHERE item.lesson_id = ${lessonId}::uuid AND goal.user_id = ${userId}::uuid
        AND item.status = 'todo'
      ORDER BY item.id FOR UPDATE OF item
    `;

    return open.length > 0
      ? completeLessonPlanItems(tx, { lessonId, now: new Date(), userId })
      : unchanged([]);
  });

  scheduleLessonCanDos({ goals: languageGoals, lessonId, userId });

  const [found] = await Promise.all([
    findDayLessonBlock({ blockId, lessonId, runStartedAt, timeZone, userId }),
    finishExplanations({ lessonId, userId }),
  ]);

  if (!found) {
    return null;
  }

  const { session, ...block } = found;
  const result = await finishLessonBlock({ block, energy, session, timeZone, userId });

  return result.status === "ready" ? result.completion : null;
}
