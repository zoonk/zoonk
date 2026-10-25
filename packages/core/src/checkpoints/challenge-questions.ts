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
import { parsePlanGraph, parsePlanSettings } from "../plans/planner/plan-state";
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

/**
 * A phase's challenge this close gets its missing questions written ahead: the learner usually
 * studies a few of these days, so they're in the bank before it opens.
 */
const BOSS_AHEAD_DAYS = 7;

/** A mixed weekly challenge asks the week's skills, so its questions are written the day before. */
const WEEKLY_AHEAD_DAYS = 1;

type ChallengeAnalytics = {
  distinctId: string;
  goalId: string;
  platform: AnalyticsPlatform | null;
};

/**
 * One challenge's missing questions (see `planChallengeWrites`). `key` names the skills it asks,
 * so runs writing for them join, however far the first one got (the session's preparation and
 * the learner's Start, or two learners of a course reaching the same phase); `later` when nobody
 * opens it today, so they're written at the background tier.
 */
type ChallengeQuestionsWrite = {
  key: string;
  later: boolean;
  planItemId: string;
  writes: ChallengeQuestionWrite[];
};

type Refused = { decision: RefusedUsage; status: "refused" };
type NotOwned = { status: "notFound" } | { status: "unauthorized" };

/**
 * `ready`: the bank holds the challenge's questions. `start`: the caller writes `writes` in
 * `quickFormat` (shared Library questions, no learner data), and starting it again asks them.
 */
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

/** The challenges coming up soon that the bank is short of, for the session's preparation. */
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

/**
 * What a goal's challenges ask about, as the session reads it: the plan's items, its skills
 * without areas the learner took out, the graph's (whose lessons size each skill's core), each
 * item's skills, the exam's listening skills (asked with recordings, never written questions) and
 * the goal's quick format, which its questions are written in.
 */
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
    goal,
    graphSkills: graph.skills,
    itemSkillIds: new Map(goalPlan.items.map((item) => [item.id, item.skillIds])),
    items,
    listeningSkillIds,
    quickFormat: getPlacementQuickFormat(structure),
    settings: parsePlanSettings(plan?.settings),
    skills: goalPlan.skills.filter((skill) => !skipped.has(skill.id)),
  };
}

/** The skills a challenge asks with written questions: a boss's phase, a mixed challenge's week. */
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
  const { goal, settings, graphSkills, itemSkillIds, items, listeningSkillIds, skills } = context;

  if (item.kind === "checkpoint") {
    const textSkillIds = skills.flatMap((skill) =>
      listeningSkillIds.has(skill.id) ? [] : [skill.id],
    );

    return loadWeekSkillIds({ now, skillIds: textSkillIds, userId });
  }

  return getBossSkillIds({
    boss: item,
    goal,
    graphSkills,
    itemSkillIds,
    items,
    settings,
    skills,
  }).filter((skillId) => !listeningSkillIds.has(skillId));
}

/** A run token's share of the hash: plenty to tell skill sets apart. */
const KEY_LENGTH = 32;

/** Names the skills a challenge asks, whichever learner's request writes for them. */
function toSkillsKey(skillIds: readonly string[]): string {
  return createHash("sha256")
    .update(skillIds.toSorted().join(","))
    .digest("hex")
    .slice(0, KEY_LENGTH);
}

/** What a challenge lacks of its ten questions, counted the way the challenge picks them. */
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

/**
 * Small AI help for the learner or guest asking, once per challenge: a second request for its
 * questions (Start while the session's preparation writes them, or a retry) is free. Refused when
 * their allowance doesn't cover it.
 */
async function claimWriting(planItemId: string): Promise<NotOwned | Refused | null> {
  const decision = await claimUsage({ kind: "assist", targetId: planItemId });

  if (decision.status === "unauthorized") {
    return decision;
  }

  return decision.status === "allowed" ? null : { decision, status: "refused" };
}

/**
 * A challenge whose questions aren't written here: a mock writes its own
 * (`requestMockQuestions`), a language goal's checkpoint is a call, and a finished one asks
 * nothing more.
 */
function needsNoWriting({ goal, item }: { goal: Goal; item: PlanItem }): boolean {
  return goal.kind === "language" || item.kind === "mock" || item.status !== "todo";
}

/**
 * Gets a challenge's questions ready when the learner starts it and the bank still holds too few
 * (`startChallenge` says `questionsNeeded`): what it lacks of its ten, on the skills it asks with
 * the fewest (`planChallengeWrites`). They join the shared bank, so every learner of those skills
 * reuses them. It counts as small AI help once per challenge (`claimWriting`), so a guest's or
 * free learner's allowance applies, and one their plan leaves to Plus writes nothing. Only a
 * learner's tap asks for it, never a page view.
 */
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

/**
 * The challenges a session's preparation writes ahead: each phase's challenge the learner reached
 * or that's due within `BOSS_AHEAD_DAYS`, and the week's mixed challenge from the day before. Due
 * today, nobody waits for long, so they're written at once; later, in the background.
 */
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

/**
 * Decides whether getting a learner's session ready also writes the questions of challenges
 * coming up soon (`findUpcomingChallenges`) that the bank is short of, so they open without a
 * wait: exactly what each lacks of its ten, joining the shared bank. Each counts as small AI help
 * once (`claimWriting`). Only the POSTs that build or move a session along ask for it, never a
 * page view; a guest's challenge gets its questions when they start it
 * (`requestChallengeQuestions`).
 */
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

  // Past a free exam plan's first week, its days hold no challenges: nothing to write ahead.
  if (access.trialEnded) {
    return { status: "ready" };
  }

  const items = await prisma.planItem.findMany({
    orderBy: { position: "asc" },
    where: { plan: { goalId } },
  });

  // Most preparations have no challenge coming up: they read nothing more.
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
