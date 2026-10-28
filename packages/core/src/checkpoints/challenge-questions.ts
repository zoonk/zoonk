import "server-only";
import { createHash } from "node:crypto";
import { type Goal, type PlanItem, prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getRequestPlatform } from "../analytics/request-platform";
import { type AnalyticsPlatform } from "../analytics/shared-properties";
import { claimUsage } from "../entitlements/claim-usage";
import { type RefusedUsage } from "../entitlements/contract";
import { loadListeningSkillIds } from "../exams/listening/listening-skills";
import { loadGoalPlan } from "../learner/_utils/goal-skill-graph";
import { findOwnedGoal, getAnswerTimeZone } from "../learner/_utils/owned-goal";
import {
  type PlacementQuickFormat,
  getPlacementQuickFormat,
} from "../learner/placement/placement-quick-format";
import { parsePlanGraph } from "../plans/planner/plan-state";
import { loadExamStructure } from "../sessions/_utils/exam-structure";
import { loadExamPrepAccess } from "../sessions/_utils/plus-only-lessons";
import { getSkippedSkillIds } from "../sessions/_utils/review-skills";
import { isBossReached } from "./_utils/boss-reached";
import { needsPlus } from "./_utils/challenge-plus";
import { loadCheckpointCandidates } from "./_utils/checkpoint-candidates";
import { findNextWeeklyItem, loadWeekSkillIds } from "./_utils/load-weekly-challenge";
import { findOwnedChallenge } from "./_utils/owned-challenge";
import {
  type ChallengeQuestionWrite,
  getBossSkillIds,
  planChallengeWrites,
} from "./checkpoint-rules";

const BOSS_AHEAD_DAYS = 7;

const WEEKLY_AHEAD_DAYS = 1;

type ChallengeAnalytics = {
  distinctId: string;
  goalId: string;
  platform: AnalyticsPlatform | null;
};

type ChallengeQuestionsWrite = {
  key: string;
  later: boolean;
  planItemId: string;
  writes: ChallengeQuestionWrite[];
};

type Refused = { decision: RefusedUsage; status: "refused" };
type NotOwned = { status: "notFound" } | { status: "unauthorized" };

/** On start, the caller must write writes in quickFormat, then start the challenge again. */
export type ChallengeQuestionsRequest =
  | NotOwned
  | Refused
  | { status: "plusRequired" }
  | { status: "ready" }
  | (Omit<ChallengeQuestionsWrite, "later" | "planItemId"> & {
      analytics: ChallengeAnalytics;
      quickFormat: PlacementQuickFormat;
      status: "start";
    });

export type UpcomingChallengeQuestionsRequest =
  | NotOwned
  | Refused
  | { status: "ready" }
  | {
      analytics: ChallengeAnalytics;
      challenges: ChallengeQuestionsWrite[];
      quickFormat: PlacementQuickFormat;
      status: "start";
    };

type ChallengeContext = Awaited<ReturnType<typeof loadChallengeContext>>;

async function loadChallengeContext({ goal, items }: { goal: Goal; items: PlanItem[] }) {
  const [plan, goalPlan, listeningSkillIds, structure] = await Promise.all([
    prisma.plan.findUnique({ select: { graph: true, settings: true }, where: { goalId: goal.id } }),
    loadGoalPlan(goal.id),
    loadListeningSkillIds(goal.id),
    loadExamStructure(goal),
  ]);

  const graph = parsePlanGraph(plan?.graph);
  const skipped = getSkippedSkillIds({ graph, settings: plan?.settings });

  return {
    graphSkills: graph.skills,
    itemSkillIds: new Map(goalPlan.items.map((item) => [item.id, item.skillIds])),
    items,
    listeningSkillIds,
    quickFormat: getPlacementQuickFormat(structure),
    skills: goalPlan.skills.filter((skill) => !skipped.has(skill.id)),
    targetDate: goal.targetDate,
  };
}

async function loadAskedSkillIds({
  context,
  item,
  now,
  userId,
}: {
  context: ChallengeContext;
  item: PlanItem;
  now: Date;
  userId: string;
}): Promise<string[]> {
  const { graphSkills, itemSkillIds, items, listeningSkillIds, skills, targetDate } = context;

  if (item.kind === "checkpoint") {
    const textSkillIds = skills.flatMap((skill) =>
      listeningSkillIds.has(skill.id) ? [] : [skill.id],
    );

    return loadWeekSkillIds({ now, skillIds: textSkillIds, userId });
  }

  return getBossSkillIds({
    boss: item,
    graphSkills,
    itemSkillIds,
    items,
    skills,
    targetDate,
  }).filter((skillId) => !listeningSkillIds.has(skillId));
}

const KEY_LENGTH = 32;

function toSkillsKey(skillIds: readonly string[]): string {
  return createHash("sha256")
    .update(skillIds.toSorted().join(","))
    .digest("hex")
    .slice(0, KEY_LENGTH);
}

async function planWrites({
  context,
  goal,
  item,
  now,
  userId,
}: {
  context: ChallengeContext;
  goal: Goal;
  item: PlanItem;
  now: Date;
  userId: string;
}): Promise<{ key: string; writes: ChallengeQuestionWrite[] }> {
  const skillIds = await loadAskedSkillIds({ context, item, now, userId });
  const key = toSkillsKey(skillIds);

  if (skillIds.length === 0) {
    return { key, writes: [] };
  }

  const candidates = await loadCheckpointCandidates({
    examBlueprintId: goal.examBlueprintId,
    skillIds,
    userId,
  });

  const writes = planChallengeWrites(
    skillIds.map((skillId) => ({
      questions: candidates.filter((candidate) => candidate.skillId === skillId).length,
      skillId,
    })),
  );

  return { key, writes };
}

async function claimWriting(planItemId: string): Promise<NotOwned | Refused | null> {
  const decision = await claimUsage({ kind: "assist", targetId: planItemId });

  if (decision.status === "unauthorized") {
    return decision;
  }

  return decision.status === "allowed" ? null : { decision, status: "refused" };
}

function needsNoWriting({ goal, item }: { goal: Goal; item: PlanItem }): boolean {
  return goal.kind === "language" || item.kind === "mock" || item.status !== "todo";
}

/** Learner POSTs only; claims AI help once per challenge and refuses challenges gated by Plus. */
export async function requestChallengeQuestions({
  planItemId,
}: {
  planItemId: string;
}): Promise<ChallengeQuestionsRequest> {
  const owned = await findOwnedChallenge({ planItemId });

  if (owned.status !== "ready") {
    return owned;
  }

  const { goal, item, items, userId } = owned.challenge;

  if (await needsPlus(owned.challenge)) {
    return { status: "plusRequired" };
  }

  if (needsNoWriting({ goal, item })) {
    return { status: "ready" };
  }

  const context = await loadChallengeContext({ goal, items });
  const { key, writes } = await planWrites({ context, goal, item, now: new Date(), userId });

  if (writes.length === 0) {
    return { status: "ready" };
  }

  const refused = await claimWriting(item.id);

  if (refused) {
    return refused;
  }

  return {
    analytics: { distinctId: userId, goalId: goal.id, platform: await getRequestPlatform() },
    key,
    quickFormat: context.quickFormat,
    status: "start",
    writes,
  };
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function findUpcomingChallenges({ items, today }: { items: readonly PlanItem[]; today: Date }) {
  const isDueBy = (item: PlanItem, days: number) =>
    item.scheduledFor !== null && item.scheduledFor <= addDays(today, days);

  const bosses = items
    .filter((item) => item.kind === "boss" && item.status === "todo")
    .flatMap((boss) => {
      const reached = isBossReached({ boss, today });
      return reached || isDueBy(boss, BOSS_AHEAD_DAYS) ? [{ item: boss, later: !reached }] : [];
    });

  const weekly = findNextWeeklyItem(items);

  const mixed =
    weekly?.kind === "checkpoint" && isDueBy(weekly, WEEKLY_AHEAD_DAYS)
      ? [{ item: weekly, later: !isDueBy(weekly, 0) }]
      : [];

  return [...bosses, ...mixed];
}

/** Session POSTs only; each challenge claims AI help once, and guests request writing on Start instead. */
export async function requestUpcomingChallengeQuestions({
  goalId,
}: {
  goalId: string;
}): Promise<UpcomingChallengeQuestionsRequest> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { goal, userId } = owned;

  if (goal.kind === "language" || goal.status !== "active") {
    return { status: "ready" };
  }

  const now = new Date();
  const timeZone = getAnswerTimeZone({ goal, timeZone: null });
  const today = getDateInTimeZone({ date: now, timeZone });

  const access = await loadExamPrepAccess({ goal, timeZone, today });

  if (access.trialEnded) {
    return { status: "ready" };
  }

  const items = await prisma.planItem.findMany({
    orderBy: { position: "asc" },
    where: { plan: { goalId } },
  });

  const upcoming = findUpcomingChallenges({ items, today });

  if (upcoming.length === 0) {
    return { status: "ready" };
  }

  const context = await loadChallengeContext({ goal, items });

  const planned = await Promise.all(
    upcoming.map(async ({ item, later }) => ({
      later,
      planItemId: item.id,
      ...(await planWrites({ context, goal, item, now, userId })),
    })),
  );

  const challenges = planned.filter((challenge) => challenge.writes.length > 0);

  if (challenges.length === 0) {
    return { status: "ready" };
  }

  const claims = await Promise.all(
    challenges.map((challenge) => claimWriting(challenge.planItemId)),
  );

  const allowed = challenges.filter((_, index) => claims[index] === null);
  const refused = claims.find((claim) => claim !== null);

  if (allowed.length === 0 && refused) {
    return refused;
  }

  return {
    analytics: { distinctId: userId, goalId, platform: await getRequestPlatform() },
    challenges: allowed,
    quickFormat: context.quickFormat,
    status: "start",
  };
}
