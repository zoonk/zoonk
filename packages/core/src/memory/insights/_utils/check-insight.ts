import "server-only";
import { createHash } from "node:crypto";
import { type MemoryInsightSkill, generateMemoryInsight } from "@zoonk/ai/tasks/v2/memory/insight";
import {
  type MemoryInsight as InsightProposal,
  type MemoryInsightKindName,
  toMemoryInsight,
} from "@zoonk/ai/tasks/v2/memory/insight-rules";
import { type MemoryInsight, isPrismaUniqueConstraintError, prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { safeAsync } from "@zoonk/utils/error";
import { type LibraryProvenance, toProvenanceData } from "../../../library/_utils/library-rows";
import { getMemoryForTask } from "../../get-memory-for-task";
import { type GoalActivity, hasEnoughActivity } from "./goal-activity";
import { type InsightPlanChange, proposeInsightGap } from "./insight-plan-change";
import { type InsightPayload } from "./insight-view";
import { type PrerequisiteGap } from "./prerequisite-gaps";

/** The coach reads what shapes a study tip or plan: goals, routine, learning and preferences. */
const INSIGHT_FACT_CATEGORIES = ["goals", "routine", "learning", "preferences"] as const;

/** A week of past insights, so the coach doesn't say the same thing twice. */
const RECENT_INSIGHT_DAYS = 7;

/** A plan change is offered only when there is a gap the plan could fill. */
function getKinds(activity: GoalActivity): MemoryInsightKindName[] {
  return activity.gaps.length > 0 ? ["tip", "planChange", "scheduleIdea"] : ["tip", "scheduleIdea"];
}

/** What the coach reads about a gap: the prerequisite, what it prepares for and its real size. */
function toInsightSkill(gap: PrerequisiteGap): MemoryInsightSkill {
  return {
    chapter: gap.chapter?.title ?? null,
    covers: gap.skills.map((skill) => skill.name),
    lessons: gap.lessons,
    name: gap.skill.name,
    prepares: gap.beforeSkill.name,
  };
}

export type InsightCheck =
  | { insight: MemoryInsight; status: "checked" }
  | { reason: "alreadyChecked" | "notEnoughActivity" | "unchanged"; status: "skipped" };

function hashInput(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function toPayload({
  activity,
  planChange,
  proposal,
}: {
  activity: GoalActivity;
  planChange: InsightPlanChange | null;
  proposal: InsightProposal | null;
}): InsightPayload {
  if (proposal?.kind === "scheduleIdea") {
    return { studyTime: proposal.studyTime };
  }

  if (proposal?.kind === "planChange" && planChange) {
    const gap = activity.gaps[proposal.skillIndex];
    return { lessonFocus: proposal.lessonFocus, skillId: gap?.skill.id, ...planChange };
  }

  return {};
}

/** Claims the learner's day before any model runs, so two sessions ending together pay for one call. */
async function claimDay({
  activity,
  inputHash,
  userId,
}: {
  activity: GoalActivity;
  inputHash: string;
  userId: string;
}): Promise<MemoryInsight | null> {
  const claim = await safeAsync(() =>
    prisma.memoryInsight.create({
      data: { goalId: activity.goal.id, inputHash, localDate: activity.localDate, userId },
    }),
  );

  if (claim.error && isPrismaUniqueConstraintError(claim.error)) {
    return null;
  }

  if (claim.error) {
    throw claim.error;
  }

  return claim.data;
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

/** Fills a plan change's gap through the planner; without it, the insight isn't shown. */
async function applyProposal({
  activity,
  proposal,
  provenance,
}: {
  activity: GoalActivity;
  proposal: InsightProposal | null;
  provenance: LibraryProvenance;
}): Promise<{ planChange: InsightPlanChange | null; proposal: InsightProposal | null }> {
  const gap = proposal?.kind === "planChange" ? activity.gaps[proposal.skillIndex] : null;

  if (!proposal || proposal.kind !== "planChange" || !gap) {
    return { planChange: null, proposal };
  }

  const planChange = await proposeInsightGap({
    gap,
    goalId: activity.goal.id,
    provenance: toProvenanceData(provenance),
    reason: proposal.message,
  });

  return { planChange, proposal: planChange ? proposal : null };
}

async function proposeInsight({
  activity,
  context,
  userId,
}: {
  activity: GoalActivity;
  context: Awaited<ReturnType<typeof loadCoachContext>>;
  userId: string;
}) {
  const { gaps, goal, signals } = activity;
  const kinds = getKinds(activity);

  const { data, provenance } = await generateMemoryInsight({
    analytics: { contentScope: "personal", distinctId: userId, goalId: goal.id },
    facts: context.facts,
    goal: goal.title,
    kinds,
    language: goal.language,
    recentInsights: context.recent.flatMap((insight) => insight.message ?? []),
    signals: signals.text,
    skills: gaps.map((gap) => toInsightSkill(gap)),
    studyTime: goal.studyTime,
  });

  const proposal = toMemoryInsight({
    context: { kinds, skillCount: gaps.length, studyTime: goal.studyTime },
    output: data,
  });

  return { ...(await applyProposal({ activity, proposal, provenance })), provenance };
}

/**
 * The daily insight check: at most one per learner and local day, skipped without a model call
 * when the week has too few answers or nothing changed since the last check. It claims the day
 * first, asks the coach for one insight (a plan change goes to the planner right away: one lesson
 * applies with an undo, anything bigger waits for the learner's OK), and keeps the row even when
 * the coach had nothing to say, so the day's call is spent once. A failed call releases the day
 * for the next session.
 */
export async function checkDailyInsight({
  activity,
  userId,
}: {
  activity: GoalActivity;
  userId: string;
}): Promise<InsightCheck> {
  if (!hasEnoughActivity(activity.signals)) {
    return { reason: "notEnoughActivity", status: "skipped" };
  }

  const context = await loadCoachContext({ activity, userId });
  const [latest] = context.recent;

  if (latest && latest.localDate.getTime() === activity.localDate.getTime()) {
    return { reason: "alreadyChecked", status: "skipped" };
  }

  const inputHash = hashInput({
    facts: context.facts.map((fact) => fact.statement),
    signals: activity.signals.text,
    studyTime: activity.goal.studyTime,
  });

  if (latest?.inputHash === inputHash) {
    return { reason: "unchanged", status: "skipped" };
  }

  const claim = await claimDay({ activity, inputHash, userId });

  if (!claim) {
    return { reason: "alreadyChecked", status: "skipped" };
  }

  const proposed = await safeAsync(() => proposeInsight({ activity, context, userId }));

  if (proposed.error) {
    await prisma.memoryInsight.delete({ where: { id: claim.id } });
    throw proposed.error;
  }

  const { planChange, proposal, provenance } = proposed.data;

  const insight = await prisma.memoryInsight.update({
    data: {
      ...toProvenanceData(provenance),
      kind: proposal?.kind ?? null,
      message: proposal?.message ?? null,
      payload: toPayload({ activity, planChange, proposal }),
    },
    where: { id: claim.id },
  });

  return { insight, status: "checked" };
}
