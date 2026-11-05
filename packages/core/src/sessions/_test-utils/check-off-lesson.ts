import { writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { completeLessonPlanItems } from "../_utils/plan-items";

/** What a lesson's completion does to the learner's plans, in the transaction that closes its run. */
export function checkOffLesson({ lessonId, userId }: { lessonId: string; userId: string }) {
  return writeLearnerChange({ planInputs: true, userId }, (tx) =>
    completeLessonPlanItems(tx, { lessonId, now: new Date(), userId }),
  );
}
