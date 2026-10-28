import "server-only";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { findActiveGoalId, loadCurrentPhases } from "../goals/_utils/goal-view";
import { type AnalyticsEvent } from "./events";
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
    prisma.user.findUnique({ select: { isAnonymous: true }, where: { id: userId } }),
    goalId ?? findActiveGoalId(userId),
  ]);

  if (!user) {
    return null;
  }

  const goal = eventGoalId ? await loadEventGoal({ goalId: eventGoalId, userId }) : null;

  return { ...user, goal };
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

/** Lookup and analytics failures never fail the caller. */
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
    const [learner, eventPlatform] = await Promise.all([
      loadLearner({ goalId, userId }),
      platform === undefined ? getRequestPlatform() : platform,
    ]);

    if (!learner) {
      return;
    }

    const shared = toSharedProperties({ learner, locale, platform: eventPlatform });

    await Promise.all(
      events.map((event) => trackServerEvent({ ...event, distinctId: userId, shared })),
    );
  });
}
