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

/**
 * The goal's next weekly checkpoint, the Big Challenge: when it is, what it asks (the exam's
 * mock conditions, or the mixed questions its bank holds on the week's skills), what it's worth
 * and the checklist to rehearse exam day. An exam's Big Challenge is a mock, which the free plan
 * doesn't include: it then says Plus is required instead of disappearing.
 */
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

/**
 * What a weekly challenge asks, as its intro says it: the mock's conditions, or the questions its
 * saved bank holds; null while its size is unknown.
 */
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

  const item = findNextWeeklyItem(items);

  if (!item) {
    return { challenge: null, status: "ready" };
  }

  const timeZone = getAnswerTimeZone({ goal, timeZone: requestTimeZone });
  const today = getDateInTimeZone({ date: new Date(), timeZone });
  const isMock = item.kind === "mock";

  const viewer = isMock ? await readEntitlementViewer() : null;

  const access = getExamPrepAccess({
    examPrep: viewer ? getTierExamPrep(viewer.tier) : null,
    goal,
    timeZone,
    today,
  });

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
