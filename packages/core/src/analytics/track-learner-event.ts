import "server-only";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { findActiveGoalId, loadCurrentPhases } from "../goals/_utils/goal-view";
import { findRequestCountry } from "../users/request-country";
import { type AnalyticsEvent } from "./events";
import { getLearnerAnalyticsPolicy } from "./learner-analytics-policy";
import { getRequestPlatform } from "./request-platform";
import { trackServerEvent } from "./server";
import {
  type AnalyticsPlatform,
  type SharedEventProperties,
  buildSharedEventProperties,
} from "./shared-properties";

type LearnerEventsInput = {
  events: readonly AnalyticsEvent[];
  /** The goal the events are about; the learner's active goal when omitted. */
  goalId?: string | null;
  /** The interface language when the sender knows it; the goal's language otherwise. */
  locale?: string | null;
  /** Defaults to the request platform; workflows must pass the run's platform, or null without a client. */
  platform?: AnalyticsPlatform | null;
  userId: string;
};

async function loadEventGoal({ goalId, userId }: { goalId: string; userId: string }) {
  const goal = await prisma.goal.findFirst({
    select: { kind: true, language: true, plan: { select: { id: true, phases: true } } },
    where: { id: goalId, userId },
  });

  if (!goal?.plan) {
    return goal && { kind: goal.kind, language: goal.language, phase: null };
  }

  const phases = await loadCurrentPhases([goal.plan]);

  return { kind: goal.kind, language: goal.language, phase: phases.get(goal.plan.id) ?? null };
}

async function loadLearner({ goalId, userId }: Pick<LearnerEventsInput, "goalId" | "userId">) {
  const [user, eventGoalId] = await Promise.all([
    prisma.user.findUnique({
      select: {
        isAnonymous: true,
        learningProfile: { select: { birthYear: true, shareUsageData: true } },
      },
      where: { id: userId },
    }),
    goalId ?? findActiveGoalId(userId),
  ]);

  if (!user) {
    return null;
  }

  const goal = eventGoalId ? await loadEventGoal({ goalId: eventGoalId, userId }) : null;

  return {
    birthYear: user.learningProfile?.birthYear ?? null,
    goal,
    isAnonymous: user.isAnonymous,
    shareUsageData: user.learningProfile?.shareUsageData ?? null,
  };
}

function toSharedProperties({
  learner,
  locale,
  platform,
}: {
  learner: NonNullable<Awaited<ReturnType<typeof loadLearner>>>;
  locale?: string | null;
  platform: AnalyticsPlatform | null;
}): SharedEventProperties {
  const { goal } = learner;

  return buildSharedEventProperties({
    goal: goal ? { kind: goal.kind, phase: goal.phase } : null,
    isGuest: learner.isAnonymous,
    locale: locale ?? goal?.language ?? null,
    platform,
  });
}

/** Follows the learner's analytics policy. Lookup and analytics failures never fail the caller. */
export async function trackLearnerEvents({
  events,
  goalId,
  locale,
  platform,
  userId,
}: LearnerEventsInput): Promise<void> {
  if (events.length === 0) {
    return;
  }

  await safeAsync(async () => {
    const fromRequest = platform === undefined;

    const [learner, eventPlatform, country] = await Promise.all([
      loadLearner({ goalId, userId }),
      fromRequest ? getRequestPlatform() : platform,
      fromRequest ? findRequestCountry() : null,
    ]);

    const policy = learner && getLearnerAnalyticsPolicy({ ...learner, country });

    if (!learner || policy === "off") {
      return;
    }

    const shared = toSharedProperties({ learner, locale, platform: eventPlatform });
    const identified = policy === "identified";

    await Promise.all(
      events.map((event) => trackServerEvent({ ...event, distinctId: userId, identified, shared })),
    );
  });
}
