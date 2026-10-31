import "server-only";
import { createHash } from "node:crypto";
import { type MemoryInsightSkill, generateMemoryInsight } from "@zoonk/ai/tasks/memory/insight";
import {
  type MemoryInsight as InsightProposal,
  type MemoryInsightKindName,
  toMemoryInsight,
} from "@zoonk/ai/tasks/memory/insight-rules";
import { type MemoryInsight, isPrismaUniqueConstraintError, prisma } from "@zoonk/db";
import { MS_PER_DAY, parseLocalDate } from "@zoonk/utils/date";
import { safeAsync } from "@zoonk/utils/error";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getMemoryCacheTag } from "../../cache/tags";
import { toProvenanceData } from "../../library/_utils/library-rows";
import { isMemoryEnabled } from "../_utils/memory-access";
import { getMemoryForTask } from "../get-memory-for-task";
import { type GoalActivity, hasEnoughActivity, loadGoalActivity } from "./_utils/goal-activity";
import { type InsightPlanChange, proposeInsightGap } from "./_utils/insight-plan-change";
import { type InsightPayload } from "./_utils/insight-view";
import { type PrerequisiteGap } from "./_utils/prerequisite-gaps";

const INSIGHT_FACT_CATEGORIES = ["goals", "routine", "learning", "preferences"] as const;

const RECENT_INSIGHT_DAYS = 7;

type InsightProvenance = ReturnType<typeof toProvenanceData>;

export type InsightDay = {
  date: string;
  endedAt: string;
  goalId: string;
  timeZone: string;
  userId: string;
};

export type InsightClaim = { goalId: string; id: string };

export type WrittenInsight = {
  gap: PrerequisiteGap | null;
  proposal: InsightProposal | null;
  provenance: InsightProvenance;
};

function getKinds(activity: GoalActivity): MemoryInsightKindName[] {
  return activity.gaps.length > 0 ? ["tip", "planChange", "scheduleIdea"] : ["tip", "scheduleIdea"];
}

function toInsightSkill(gap: PrerequisiteGap): MemoryInsightSkill {
  return {
    chapter: gap.chapter?.title ?? null,
    covers: gap.skills.map((skill) => skill.name),
    lessons: gap.lessons,
    name: gap.skill.name,
    prepares: gap.beforeSkill.name,
  };
}

function hashInput(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function toPayload({
  gap,
  planChange,
  proposal,
}: {
  gap: PrerequisiteGap | null;
  planChange: InsightPlanChange | null;
  proposal: InsightProposal | null;
}): InsightPayload {
  if (proposal?.kind === "scheduleIdea") {
    return { studyTime: proposal.studyTime };
  }

  if (proposal?.kind === "planChange" && planChange) {
    return { lessonFocus: proposal.lessonFocus, skillId: gap?.skill.id, ...planChange };
  }

  return {};
}

/** Provenance marks a finished check, including one that found nothing worth saying. */
function toOpenClaim(row: MemoryInsight): InsightClaim | null {
  return row.generatedAt === null && row.goalId ? { goalId: row.goalId, id: row.id } : null;
}

function loadActivity({ endedAt, goalId, timeZone, userId }: Omit<InsightDay, "date">) {
  return loadGoalActivity({ goalId, now: new Date(endedAt), timeZone, userId });
}

async function loadCoachContext({ activity, userId }: { activity: GoalActivity; userId: string }) {
  const since = new Date(activity.localDate.getTime() - RECENT_INSIGHT_DAYS * MS_PER_DAY);

  const [recent, facts] = await Promise.all([
    prisma.memoryInsight.findMany({
      orderBy: [{ localDate: "desc" }, { createdAt: "desc" }],
      where: { localDate: { gte: since }, userId },
    }),
    getMemoryForTask({
      categories: INSIGHT_FACT_CATEGORIES,
      language: activity.goal.language,
      userId,
    }),
  ]);

  return { facts, recent };
}

async function claimNewDay({
  activity,
  localDate,
  userId,
}: {
  activity: GoalActivity;
  localDate: Date;
  userId: string;
}): Promise<InsightClaim | null> {
  const context = await loadCoachContext({ activity, userId });

  const inputHash = hashInput({
    facts: context.facts.map((fact) => fact.statement),
    signals: activity.signals.text,
    studyTime: activity.goal.studyTime,
  });

  if (context.recent[0]?.inputHash === inputHash) {
    return null;
  }

  const claim = await safeAsync(() =>
    prisma.memoryInsight.create({
      data: { goalId: activity.goal.id, inputHash, localDate, userId },
    }),
  );

  if (claim.error && isPrismaUniqueConstraintError(claim.error)) {
    return null;
  }

  if (claim.error) {
    throw claim.error;
  }

  return { goalId: activity.goal.id, id: claim.data.id };
}

/**
 * At most one insight a day: the first session's goal claims the day, and a claim whose check
 * never finished is resumed with its own goal. Null when there is nothing to check.
 */
export async function claimDailyInsight(day: InsightDay): Promise<InsightClaim | null> {
  const { date, userId } = day;
  const localDate = parseLocalDate(date);

  const [enabled, claimed] = await Promise.all([
    isMemoryEnabled(userId),
    prisma.memoryInsight.findUnique({ where: { userLocalDate: { localDate, userId } } }),
  ]);

  if (!enabled) {
    return null;
  }

  if (claimed) {
    return toOpenClaim(claimed);
  }

  const activity = await loadActivity(day);

  if (!activity || !hasEnoughActivity(activity.signals)) {
    return null;
  }

  return claimNewDay({ activity, localDate, userId });
}

/** The model call; it saves nothing, so a failure throws and its step retries. */
export async function writeDailyInsight({
  claim,
  endedAt,
  timeZone,
  userId,
}: Omit<InsightDay, "date" | "goalId"> & { claim: InsightClaim }): Promise<WrittenInsight | null> {
  const activity = await loadActivity({ endedAt, goalId: claim.goalId, timeZone, userId });

  if (!activity) {
    return null;
  }

  const { facts, recent } = await loadCoachContext({ activity, userId });
  const { gaps, goal, signals } = activity;
  const kinds = getKinds(activity);

  const { data, provenance } = await generateMemoryInsight({
    analytics: { contentScope: "personal", distinctId: userId, goalId: goal.id },
    facts,
    goal: goal.title,
    kinds,
    language: goal.language,
    recentInsights: recent.flatMap((insight) => insight.message ?? []),
    signals: signals.text,
    skills: gaps.map((gap) => toInsightSkill(gap)),
    studyTime: goal.studyTime,
  });

  const proposal = toMemoryInsight({
    context: { kinds, skillCount: gaps.length, studyTime: goal.studyTime },
    output: data,
  });

  const gap = proposal?.kind === "planChange" ? (gaps[proposal.skillIndex] ?? null) : null;

  return { gap, proposal, provenance: toProvenanceData(provenance) };
}

type PlanChangeAsk = {
  claim: InsightClaim;
  gap: PrerequisiteGap;
  proposal: InsightProposal;
  provenance: InsightProvenance;
};

/** A retried step finds the plan change its earlier attempt made by the model run that wrote it. */
async function findOrProposePlanChange({
  claim,
  gap,
  proposal,
  provenance,
}: PlanChangeAsk): Promise<InsightPlanChange | null> {
  const made = await prisma.planChange.findFirst({
    where: { plan: { goalId: claim.goalId }, runId: provenance.runId },
  });

  if (made) {
    return {
      planChangeId: made.id,
      planChangeStatus: made.status === "applied" ? "applied" : "proposed",
    };
  }

  return proposeInsightGap({ gap, goalId: claim.goalId, provenance, reason: proposal.message });
}

/** An insight whose plan change the planner wouldn't make says nothing, as if it had found nothing. */
async function linkPlanChange({ claim, gap, proposal, provenance }: PlanChangeAsk): Promise<void> {
  const planChange = await findOrProposePlanChange({ claim, gap, proposal, provenance });

  await prisma.memoryInsight.update({
    data: planChange
      ? { payload: toPayload({ gap, planChange, proposal }) }
      : { kind: null, message: null, payload: {} },
    where: { id: claim.id },
  });
}

/**
 * Ends the day's claim with what the coach wrote, or drops it when its goal is gone. The insight is
 * saved before the plan change it proposes, so the plan never changes without it.
 */
export async function saveDailyInsight({
  claim,
  userId,
  written,
}: {
  claim: InsightClaim;
  userId: string;
  written: WrittenInsight | null;
}): Promise<void> {
  if (!written) {
    await prisma.memoryInsight.deleteMany({ where: { generatedAt: null, id: claim.id } });
    return;
  }

  const { gap, proposal, provenance } = written;

  await prisma.memoryInsight.updateMany({
    data: {
      ...provenance,
      kind: proposal?.kind ?? null,
      message: proposal?.message ?? null,
      payload: toPayload({ gap, planChange: null, proposal }),
    },
    where: { generatedAt: null, id: claim.id },
  });

  if (proposal?.kind === "planChange" && gap) {
    await linkPlanChange({ claim, gap, proposal, provenance });
  }

  revalidateCacheTags([getMemoryCacheTag(userId)]);
}
