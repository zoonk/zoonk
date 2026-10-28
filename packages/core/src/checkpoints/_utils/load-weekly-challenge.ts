import { type Goal, type PlanItem, prisma } from "@zoonk/db";
import "server-only";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { planWeeklyMock } from "../../exams/mocks/_utils/plan-weekly-mock";
import { loadScheduledMock } from "../../exams/mocks/_utils/scheduled-mock";
import { getPlannedItemIds } from "../../exams/mocks/mock-plan";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { type MockIdentity, findScheduledMock } from "../../plans/planner/mock-identity";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { getItemKey } from "../../plans/planner/plan-items";
import { type PlanSettings } from "../../plans/planner/plan-state";
import { type SessionPlanItem } from "../../sessions/_utils/session-plan-item";
import { type PlannedCheckpoint } from "../../sessions/session-builder";
import { getCheckpointMinutes } from "../checkpoint-minutes";
import {
  MIN_CHECKPOINT_QUESTIONS,
  getPassMark,
  getPlannedQuestions,
  selectCheckpointItems,
} from "../checkpoint-rules";
import { loadCheckpointCandidates } from "./checkpoint-candidates";

const WEEK_DAYS = 7;

export const WEEKLY_CHALLENGE_KINDS = ["checkpoint", "mock"] as const satisfies PlanItem["kind"][];

const WEEKLY_KINDS = new Set<PlanItem["kind"]>(WEEKLY_CHALLENGE_KINDS);

export function isWeeklyChallengeItem(item: Pick<PlanItem, "kind">): boolean {
  return WEEKLY_KINDS.has(item.kind);
}

export function findNextWeeklyItem<Item extends Pick<PlanItem, "kind" | "status">>(
  items: readonly Item[],
): Item | undefined {
  return items.find((item) => isWeeklyChallengeItem(item) && item.status === "todo");
}

async function loadMockItems({
  goal,
  identity: selectedIdentity,
  planItemId,
  skillIds,
  structure,
  today,
  userId,
}: {
  goal: Pick<Goal, "examBlueprintId" | "id" | "targetDate">;
  identity?: MockIdentity | null;
  planItemId: string | null;
  skillIds: readonly string[];
  structure: ExamStructure | null;
  today: Date;
  userId: string;
}) {
  const identity =
    selectedIdentity === undefined
      ? await loadScheduledMock({ date: today, goalId: goal.id, planItemId })
      : selectedIdentity;

  const plan = await planWeeklyMock({ goal, identity, skillIds, structure, today, userId });

  return {
    itemIds: getPlannedItemIds(plan),
    minutes: plan.minutes,
    mockIdentity: { day: plan.day, fullLength: plan.fullLength },
    timeLimitMinutes: plan.minutes,
  };
}

/** Returns skills in plan order so rebuilding keeps the same questions. */
export async function loadWeekSkillIds({
  now,
  skillIds,
  userId,
}: {
  now: Date;
  skillIds: readonly string[];
  userId: string;
}): Promise<string[]> {
  const rows = await prisma.attempt.findMany({
    distinct: ["skillId"],
    select: { skillId: true },
    where: {
      answeredAt: { gte: new Date(now.getTime() - WEEK_DAYS * MS_PER_DAY) },
      skillId: { in: [...skillIds] },
      userId,
    },
  });

  const answered = new Set(rows.map((row) => row.skillId));
  return skillIds.filter((skillId) => answered.has(skillId));
}

export async function loadMixedItems({
  examBlueprintId,
  now,
  skillIds,
  userId,
}: {
  examBlueprintId: string | null;
  now: Date;
  skillIds: readonly string[];
  userId: string;
}) {
  const weekSkills = await loadWeekSkillIds({ now, skillIds, userId });

  const candidates = await loadCheckpointCandidates({
    examBlueprintId,
    skillIds: weekSkills,
    userId,
  });

  const itemIds = selectCheckpointItems({ candidates, skillIds: weekSkills });

  return {
    itemIds,
    minutes: getCheckpointMinutes(getPlannedQuestions(itemIds.length)),
    timeLimitMinutes: null,
    writable: weekSkills.length > 0,
  };
}

export type SessionWeeklyChallenge = {
  checkpoint: PlannedCheckpoint | null;
  plusRequired: boolean;
};

export async function loadSessionWeeklyChallenge({
  goal,
  includesMockExams,
  items,
  mockFunding,
  mockSkillIds,
  now,
  skillIds,
  structure,
  today,
  userId,
}: {
  goal: Pick<Goal, "examBlueprintId" | "id" | "targetDate">;
  includesMockExams: boolean;
  items: readonly SessionPlanItem[];
  mockFunding?: PlanSettings["mockFunding"];
  /** Include every exam topic, even those omitted from the plan's teaching days. */
  mockSkillIds: readonly string[];
  now: Date;
  skillIds: readonly string[];
  structure: ExamStructure | null;
  today: Date;
  userId: string;
}): Promise<SessionWeeklyChallenge> {
  const item = findNextWeeklyItem(items);

  if (!item || !item.scheduledFor || item.scheduledFor > today) {
    return { checkpoint: null, plusRequired: false };
  }

  const isMock = item.kind === "mock";

  if (isMock && !includesMockExams) {
    return { checkpoint: null, plusRequired: true };
  }

  const asked = isMock ? mockSkillIds : skillIds;

  const { writable, ...picked } = isMock
    ? {
        ...(await loadMockItems({
          goal,
          identity: mockFunding
            ? findScheduledMock({ date: toIsoDate(item.scheduledFor), funding: mockFunding })
            : undefined,
          planItemId: item.id,
          skillIds: asked,
          structure,
          today,
          userId,
        })),
        writable: false,
      }
    : await loadMixedItems({ examBlueprintId: goal.examBlueprintId, now, skillIds, userId });

  if (picked.itemIds.length < MIN_CHECKPOINT_QUESTIONS && !writable) {
    return { checkpoint: null, plusRequired: false };
  }

  const questions = isMock ? picked.itemIds.length : getPlannedQuestions(picked.itemIds.length);

  return {
    checkpoint: {
      ...picked,
      kind: "weekly",
      mock: isMock,
      passMark: getPassMark(questions),
      phase: item.phase,
      planItemId: item.id,
      planItemKey: getItemKey(item),
      rematch: false,
      skillIds: [...asked],
      title: item.titleSnapshot,
    },
    plusRequired: false,
  };
}
