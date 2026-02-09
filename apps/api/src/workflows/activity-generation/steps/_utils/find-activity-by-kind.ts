import { type ActivityKind } from "@zoonk/db";
import { type LessonActivity } from "../get-lesson-activities-step";

export function findActivityByKind(activities: LessonActivity[], kind: ActivityKind) {
  return activities.find((act) => act.kind === kind);
}
