import "server-only";
import { type PlanItem } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { readEntitlementViewer } from "../entitlements/_utils/entitlement-viewer";
import { getExamPrepAccess as getTierExamPrep } from "../entitlements/limits";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { readSavedPlan } from "../learner/facts/saved-plan";
import { getOwnedGoal } from "../learner/get-owned-goal";
import { readExamBlueprint } from "../library/exams/read-exam-blueprint";
import { getExamPrepAccess } from "../sessions/_utils/exam-access";
import { BRAIN_POWER_BONUS } from "../sessions/brain-power";
import { getOfferQuestions, readBossOffer } from "./_utils/challenge-offer";
import { findNextWeeklyItem } from "./_utils/load-weekly-challenge";
import { loadMockCard } from "./_utils/mock-card";
import {
  EXAM_DAY_CHECKLIST,
  type ExamDayChecklistItem,
  type MockConditions,
} from "./weekly-challenge-rules";

type WeeklyChallenge = {
  access: "open" | "plusRequired";
  brainPower: number;
  checklist: ExamDayChecklistItem[];
  conditions: MockConditions | null;
  date: Date | null;
  kind: "mixed" | "mock";
  planItemId: string;
  questions: number | null;
  /** The real exam's start time for a mock when the notice gives it; otherwise the study time. */
  startTime: string | null;
  /** The zone of an exam's start time; null for the learner's own study time. */
  timeZone: string | null;
  title: string | null;
};

/** Returns null while the saved question count is unknown. */
export function getWeeklyQuestions({
  conditions,
  item,
}: {
  conditions?: Pick<MockConditions, "questions"> | null;
  item: Pick<PlanItem, "facts" | "kind">;
}): number | null {
  return conditions?.questions ?? getOfferQuestions(readBossOffer({ item }));
}

export type WeeklyChallengeResult =
  | { challenge: WeeklyChallenge | null; status: "ready" }
  | { status: "notFound" }
  | { status: "unauthorized" };

export async function getWeeklyChallenge({
  goalId,
  timeZone: requestTimeZone,
}: {
  goalId: string;
  timeZone?: string;
}): Promise<WeeklyChallengeResult> {
  const owned = await getOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { goal } = owned;

  const [items, blueprint] = await Promise.all([
    readSavedPlan(owned.userId, goalId).then((plan) => plan?.items ?? []),
    goal.examBlueprintId ? readExamBlueprint(goal.examBlueprintId) : null,
  ]);

  const timeZone = getAnswerTimeZone({ goal, timeZone: requestTimeZone });
  const today = getDateInTimeZone({ date: new Date(), timeZone });
  const hasMock = items.some((item) => item.kind === "mock" && item.status === "todo");

  const viewer = hasMock ? await readEntitlementViewer() : null;

  const access = getExamPrepAccess({
    examPrep: viewer ? getTierExamPrep(viewer.tier) : null,
    goal,
  });

  const item = findNextWeeklyItem({ includesMockExams: access.includesMockExams, items, today });

  if (!item) {
    return { challenge: null, status: "ready" };
  }

  const isMock = item.kind === "mock";

  const card = isMock
    ? await loadMockCard({ blueprint, date: item.scheduledFor ?? today, goal, today })
    : null;

  const conditions = card?.conditions ?? null;

  return {
    challenge: {
      access: isMock && !access.includesMockExams ? "plusRequired" : "open",
      brainPower: BRAIN_POWER_BONUS.weeklyChallenge,
      checklist: isMock ? [...EXAM_DAY_CHECKLIST] : [],
      conditions,
      date: item.scheduledFor,
      kind: isMock ? "mock" : "mixed",
      planItemId: item.id,
      questions: getWeeklyQuestions({ conditions, item }),
      startTime: card?.startTime ?? goal.studyTime,
      timeZone: card?.startTime ? card.timeZone : null,
      title: item.titleSnapshot.trim() || null,
    },
    status: "ready",
  };
}
