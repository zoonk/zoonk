import { type StoredChange } from "../contract";

export function changesLearnerLesson(change: StoredChange): boolean {
  return change.model !== "Lesson" || change.op !== "setPlan" || change.fields.length > 1;
}
