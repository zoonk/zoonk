import { type ActivityKind } from "@zoonk/db";
import { type LessonActivity } from "../get-lesson-activities-step";

export function findActivityByKind(activities: LessonActivity[], kind: ActivityKind) {
  return activities.find((act) => act.kind === kind);
}

export function findActivitiesByKind(activities: LessonActivity[], kind: ActivityKind) {
  return activities.filter((activity) => activity.kind === kind);
}

export function findActivityById(
  activities: LessonActivity[],
  activityId: bigint | number,
): LessonActivity | undefined {
  const normalizedId = String(activityId);
  return activities.find((activity) => String(activity.id) === normalizedId);
}
