import { type PlanItem } from "@zoonk/db";

/** A selected in-memory item can have a logical key without a persisted row ID. */
export type SessionPlanItem = Pick<
  PlanItem,
  | "chapterId"
  | "completedAt"
  | "facts"
  | "kind"
  | "lessonId"
  | "lessons"
  | "minutes"
  | "phase"
  | "position"
  | "scheduledFor"
  | "skillId"
  | "status"
  | "titleSnapshot"
> & { id: string | null; key?: string };

/** Only internal projection maps use a logical key in place of an absent row ID. */
export function getSessionItemIdentity(item: Pick<SessionPlanItem, "id" | "key">): string {
  if (item.id) {
    return item.id;
  }

  if (!item.key) {
    throw new Error("A selected item has neither a saved ID nor a logical key.");
  }

  return item.key;
}
