import { type PlanItem, type PlanItemKind } from "@zoonk/db";

export const LEARN_KINDS: ReadonlySet<PlanItemKind> = new Set(["chapter", "lesson"]);
export const PHASE_WORK_KINDS: ReadonlySet<PlanItemKind> = new Set(["boss", ...LEARN_KINDS]);
const CHALLENGE_KINDS: ReadonlySet<PlanItemKind> = new Set(["boss", "checkpoint", "mock"]);

type LessonIdentity = Pick<PlanItem, "kind" | "lessonId">;
type StandInIdentity = LessonIdentity & Pick<PlanItem, "chapterId" | "skillId">;

export function hasTakenChallenge(items: readonly Pick<PlanItem, "kind" | "status">[]): boolean {
  return items.some((item) => CHALLENGE_KINDS.has(item.kind) && item.status === "done");
}

export function isUnwrittenLesson(item: LessonIdentity): boolean {
  return item.kind === "lesson" && item.lessonId === null;
}

export function isWritingItem(item: LessonIdentity & Pick<PlanItem, "chapterId">): boolean {
  return isUnwrittenLesson(item) && item.chapterId === null;
}

export function isStandInUnit(item: LessonIdentity & Pick<PlanItem, "skillId">): boolean {
  return isUnwrittenLesson(item) && item.skillId !== null;
}

export function hasUnwrittenSkill(item: Omit<StandInIdentity, "kind">): boolean {
  return item.lessonId === null && item.chapterId === null && item.skillId !== null;
}

export function isStandIn(item: StandInIdentity): boolean {
  return item.kind === "lesson" && hasUnwrittenSkill(item);
}
