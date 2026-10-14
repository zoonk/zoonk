import { type Goal, type PlanItem, prisma } from "@zoonk/db";
import "server-only";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { planWeeklyMock } from "../../exams/mocks/_utils/plan-weekly-mock";
import { loadScheduledMock } from "../../exams/mocks/_utils/scheduled-mock";
import { getPlannedItemIds } from "../../exams/mocks/mock-plan";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
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

/** The plan's weekly checkpoints: an exam's mock, or a mixed challenge for other goals. */
export const WEEKLY_CHALLENGE_KINDS = ["checkpoint", "mock"] as const satisfies PlanItem["kind"][];

const WEEKLY_KINDS = new Set<PlanItem["kind"]>(WEEKLY_CHALLENGE_KINDS);

export function isWeeklyChallengeItem(item: Pick<PlanItem, "kind">): boolean {
  return WEEKLY_KINDS.has(item.kind);
}

/** The plan's next weekly checkpoint that isn't done yet. */
export function findNextWeeklyItem(items: readonly PlanItem[]): PlanItem | undefined {
  return items.find((item) => isWeeklyChallengeItem(item) && item.status === "todo");
}

/**
 * The week's mock in real conditions, planned by the exam module: one exam day's sections at the
 * real pace, from questions the learner has never seen, so its score says something new.
 */
async function loadMockItems({
  goal,
  planItemId,
  skillIds,
  structure,
  today,
  userId,
}: {
  goal: Pick<Goal, "examBlueprintId" | "id" | "targetDate">;
  planItemId: string;
  skillIds: readonly string[];
  structure: ExamStructure | null;
  today: Date;
  userId: string;
}) {
  // The mock sits the exam day and length its plan saved for it (see `MockIdentity`).
  const identity = await loadScheduledMock({ date: today, goalId: goal.id, planItemId });
  const plan = await planWeeklyMock({ goal, identity, skillIds, structure, today, userId });

  return {
    itemIds: getPlannedItemIds(plan),
    minutes: plan.minutes,
    timeLimitMinutes: plan.minutes,
  };
}

/** Skills the learner answered on in the last week: what a weekly challenge brings together. */
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

  return rows.flatMap((row) => (row.skillId ? [row.skillId] : []));
}

/**
 * A mixed challenge's questions on the week's skills (`loadWeekSkillIds`), planned at its full
 * size while the bank holds too few (see `getPlannedQuestions`); none to write without a week's
 * skills.
 */
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
  /** An exam's Big Challenge is a mock, which the free plan doesn't include: offer Plus. */
  plusRequired: boolean;
};

/**
 * Today's weekly checkpoint when the plan scheduled one: a mock in the exam's conditions (when the
 * learner's plan includes mocks) on every topic of the test, or a mixed challenge on the week's
 * skills outside exams.
 */
export async function loadSessionWeeklyChallenge({
  goal,
  includesMockExams,
  items,
  mockSkillIds,
  now,
  skillIds,
  structure,
  today,
  userId,
}: {
  goal: Pick<Goal, "examBlueprintId" | "id" | "targetDate">;
  includesMockExams: boolean;
  items: readonly PlanItem[];
  /**
   * The skills a mock asks: every topic of the test, the ones the plan's days left out too, as the
   * real test does and as the full review a free plan gets in its place does.
   */
  mockSkillIds: readonly string[];
  now: Date;
  /** The plan's skills, which a mixed challenge brings together. */
  skillIds: readonly string[];
  structure: ExamStructure | null;
  today: Date;
  userId: string;
}): Promise<SessionWeeklyChallenge> {
  const item = findNextWeeklyItem(items);

  if (!item || !item.scheduledFor || item.scheduledFor > today) {
    return { checkpoint: null, plusRequired: false };
  }

  // The plan's `mock` items are an exam's weekly mock; `checkpoint` items a mixed challenge.
  const isMock = item.kind === "mock";

  if (isMock && !includesMockExams) {
    return { checkpoint: null, plusRequired: true };
  }

  const asked = isMock ? mockSkillIds : skillIds;

  // A mock's missing questions are written by its own start (`requestMockQuestions`).
  const { writable, ...picked } = isMock
    ? {
        ...(await loadMockItems({
          goal,
          planItemId: item.id,
          skillIds: asked,
          structure,
          today,
          userId,
        })),
        writable: false,
      }
    : await loadMixedItems({ examBlueprintId: goal.examBlueprintId, now, skillIds, userId });

  // A mixed challenge short of questions keeps its day: they're written when it starts.
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
      rematch: false,
      skillIds: [...asked],
      title: item.titleSnapshot,
    },
    plusRequired: false,
  };
}
