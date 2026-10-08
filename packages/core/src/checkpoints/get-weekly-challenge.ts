import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAllowance } from "../entitlements/get-allowance";
import { findOwnedGoal, getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { getExamPrepAccess } from "../sessions/_utils/exam-access";
import { BRAIN_POWER_BONUS } from "../sessions/brain-power";
import { findNextWeeklyItem } from "./_utils/load-weekly-challenge";
import { loadMockCard } from "./_utils/mock-card";
import { CHECKPOINT_QUESTIONS } from "./checkpoint-rules";
import {
  EXAM_DAY_CHECKLIST,
  type ExamDayChecklistItem,
  type MockConditions,
} from "./weekly-challenge-rules";

/**
 * The goal's next weekly checkpoint, the Big Challenge: when it is, what it asks (the exam's
 * mock conditions, or ten mixed questions on the week's skills), what it's worth and the checklist
 * to rehearse exam day. An exam's Big Challenge is a mock, which the free plan doesn't include: it
 * then says Plus is required instead of disappearing.
 */
type WeeklyChallenge = {
  access: "open" | "plusRequired";
  brainPower: number;
  checklist: ExamDayChecklistItem[];
  conditions: MockConditions | null;
  date: Date | null;
  kind: "mixed" | "mock";
  planItemId: string;
  questions: number;
  /** The real exam's start time for a mock when the notice gives it; otherwise the study time. */
  startTime: string | null;
  /** The zone of an exam's start time; null for the learner's own study time. */
  timeZone: string | null;
  title: string;
};

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
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { goal } = owned;

  const [items, allowance, blueprint] = await Promise.all([
    prisma.planItem.findMany({ orderBy: { position: "asc" }, where: { plan: { goalId } } }),
    getAllowance(),
    goal.examBlueprintId
      ? prisma.examBlueprint.findUnique({ where: { id: goal.examBlueprintId } })
      : null,
  ]);

  const item = findNextWeeklyItem(items);

  if (!item) {
    return { challenge: null, status: "ready" };
  }

  const timeZone = getAnswerTimeZone({ goal, timeZone: requestTimeZone });
  const today = getDateInTimeZone({ date: new Date(), timeZone });
  const isMock = item.kind === "mock";

  const access = getExamPrepAccess({
    examPrep: allowance?.examPrep ?? null,
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
      questions: conditions?.questions ?? CHECKPOINT_QUESTIONS,
      startTime: card?.startTime ?? goal.studyTime,
      timeZone: card?.startTime ? card.timeZone : null,
      title: item.titleSnapshot,
    },
    status: "ready",
  };
}
