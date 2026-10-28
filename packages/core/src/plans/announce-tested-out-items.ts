import "server-only";
import { type PlanChange, type TransactionClient, prisma } from "@zoonk/db";
import { type JsonObject, isJsonObject } from "@zoonk/utils/json";
import { skipTestedOutBlocks } from "../sessions/_utils/skip-tested-out-blocks";
import { isPlanReady } from "./_utils/apply-plan-change";
import { commitPlan } from "./_utils/commit-plan";
import { followPlanToday } from "./_utils/follow-plan-today";
import { getListeningPastBasicsEffect, withPastBasicsAreas } from "./_utils/level-listening-starts";
import { parsePlanChangePayload, toPlanChangePayload } from "./_utils/plan-change-payload";
import { type PlanContext } from "./_utils/plan-context";
import { type PlanSnapshot, parsePlanSnapshot } from "./_utils/plan-snapshot";
import { loadPlanAtToken } from "./_utils/plan-token";
import { computePlan } from "./_utils/replan";
import { getSeenEffect } from "./_utils/seen-effect";
import { countLessons } from "./_utils/stand-in-lessons";
import { RECENT_CHANGE_MS } from "./_utils/today-plan-change";
import { PlanConflictError, withPlanRetry } from "./plan-conflict";
import { type PlanEffect } from "./planner/plan-effect";

/** For logs and admin only; the apps word it as "Skipped 12 lessons you already know". */
const TESTED_OUT_NOTE = "Placement or a test-out skipped lessons the learner already knows.";

type Move = { after: unknown; before: unknown };

function joinMove<T extends Move>(older: T | undefined, newer: T | undefined): T | undefined {
  const move = older && newer ? { ...newer, before: older.before } : (newer ?? older);
  return move && move.after !== move.before ? move : undefined;
}

function joinMoves<T extends Move>({
  key,
  newer = [],
  older = [],
}: {
  key: (move: T) => string;
  newer?: readonly T[];
  older?: readonly T[];
}): T[] {
  const keys = new Set([...older, ...newer].map((move) => key(move)));

  return [...keys].flatMap(
    (name) =>
      joinMove(
        older.find((move) => key(move) === name),
        newer.find((move) => key(move) === name),
      ) ?? [],
  );
}

function joinNames(older: readonly string[] = [], newer: readonly string[] = []): string[] {
  return [...new Set([...older, ...newer])];
}

function joinSkipEffects({
  newer,
  older,
  seen,
}: {
  newer: PlanEffect;
  older: PlanEffect | null;
  seen: PlanEffect;
}): PlanEffect {
  const areaEnds = joinMoves({
    key: (end) => end.area,
    newer: newer.areaEnds,
    older: older?.areaEnds,
  });

  const areaStarts = joinMoves({
    key: (start) => start.area,
    newer: newer.areaStarts,
    older: older?.areaStarts,
  });

  const phaseEnds = joinMoves({
    key: (end) => end.name,
    newer: newer.phaseEnds,
    older: older?.phaseEnds,
  });

  const areaLessons = joinMoves({
    key: (area) => area.area,
    newer: newer.areaLessons,
    older: older?.areaLessons,
  });

  const listeningPastBasics = joinNames(older?.listeningPastBasics, newer.listeningPastBasics);
  const nextMock = joinMove(older?.nextMock, newer.nextMock);
  const weeklyEvents = joinMove(older?.weeklyEvents, newer.weeklyEvents);

  return {
    ...seen,
    ...(areaEnds.length > 0 && { areaEnds }),
    ...(areaLessons.length > 0 && { areaLessons }),
    ...(areaStarts.length > 0 && { areaStarts }),
    ...(listeningPastBasics.length > 0 && { listeningPastBasics }),
    ...(nextMock && { nextMock }),
    ...(phaseEnds.length > 0 && { phaseEnds }),
    ...(weeklyEvents && { weeklyEvents }),
  };
}

async function findUnseenSkip({
  context,
  now,
}: {
  context: PlanContext;
  now: Date;
}): Promise<{
  change: PlanChange;
  items: PlanSnapshot["items"];
  payload: JsonObject;
  snapshot: JsonObject;
} | null> {
  const latest = await prisma.planChange.findFirst({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    where: { planId: context.plan.id },
  });

  if (
    latest?.kind !== "testedOut" ||
    latest.status !== "applied" ||
    latest.createdAt.getTime() < now.getTime() - RECENT_CHANGE_MS ||
    !isJsonObject(latest.payload)
  ) {
    return null;
  }

  const { seenAt, versionAfter } = parsePlanChangePayload(latest.payload);

  if (seenAt !== null || versionAfter !== context.plan.version) {
    return null;
  }

  const kept = await prisma.planChangeSnapshot.findUnique({
    select: { plan: true },
    where: { changeId: latest.id },
  });

  const snapshot = kept?.plan;
  const items = parsePlanSnapshot(snapshot)?.items;

  return isJsonObject(snapshot) && items
    ? { change: latest, items, payload: latest.payload, snapshot }
    : null;
}

export async function announceTestedOutItems({
  extraWrites,
  followToday = true,
  goalId,
  now,
  pastBasicsAreas = [],
  planItemIds,
  timeZone,
}: {
  extraWrites?: (tx: TransactionClient) => Promise<unknown>;
  /**
   * True for a test the learner took on its own; an answer inside today's session keeps the rest of
   * the day as shown.
   */
  followToday?: boolean;
  goalId: string;
  now: Date;
  pastBasicsAreas?: readonly string[];
  planItemIds: readonly string[];
  timeZone: string;
}): Promise<{ changeId: string | null; lessonsSkipped: number; planVersion: number } | null> {
  if (planItemIds.length === 0) {
    return null;
  }

  const skipped = new Set(planItemIds);

  return withPlanRetry(async () => {
    const context = await loadPlanAtToken(goalId, { now, timeZone });

    if (!context || !isPlanReady(context)) {
      return null;
    }

    const lessonsSkipped = countLessons(context.items.filter((item) => skipped.has(item.id)));

    const unseen = await findUnseenSkip({ context, now });
    const recorded = unseen && parsePlanChangePayload(unseen.payload);

    if (
      recorded &&
      !extraWrites &&
      !pastBasicsAreas?.length &&
      planItemIds.every((id) => recorded.planItemIds.includes(id))
    ) {
      await skipTestedOutBlocks({ goalId, notStarted: !followToday, planItemIds });

      if (followToday) {
        await followPlanToday({ changeId: unseen.change.id, context });
      }

      return { changeId: unseen.change.id, lessonsSkipped, planVersion: context.plan.version };
    }

    const computed = await computePlan({
      context,
      mode: "forced",
      now,
      state: withPastBasicsAreas({ areas: pastBasicsAreas, state: context.state }),
    });

    const effect = {
      ...computed.effect,
      ...getListeningPastBasicsEffect({ areas: pastBasicsAreas, state: context.state }),
    };

    // Writing the plan drops earlier changes' snapshots, so the one from before the first skip is
    // kept again for the Undo.
    if (unseen) {
      const added = parsePlanChangePayload(unseen.payload);
      const counted = new Set(added.planItemIds);

      const newlySkipped = countLessons(
        context.items.filter((item) => skipped.has(item.id) && !counted.has(item.id)),
      );

      await commitPlan({
        change: null,
        computed,
        context,
        extraWrites: async (tx) => {
          await extraWrites?.(tx);

          // Only the skip as it was read: a "Got it" since makes this one news of its own.
          const { count } = await tx.planChange.updateMany({
            data: {
              payload: toPlanChangePayload({
                ...added,
                effect: joinSkipEffects({
                  newer: effect,
                  older: added.effect,
                  seen: getSeenEffect({
                    computed,
                    shown: unseen.items.map((item) =>
                      skipped.has(item.id) || counted.has(item.id)
                        ? { ...item, status: "testedOut" as const }
                        : item,
                    ),
                  }),
                }),
                lessonsSkipped: (added.lessonsSkipped ?? 0) + newlySkipped,
                planItemIds: [...new Set([...added.planItemIds, ...skipped])],
                versionAfter: context.plan.version + 1,
              }),
            },
            where: { id: unseen.change.id, payload: { equals: unseen.payload } },
          });

          if (count === 0) {
            throw new PlanConflictError();
          }

          await tx.planChangeSnapshot.create({
            data: { changeId: unseen.change.id, plan: unseen.snapshot },
          });
        },
      });
    }

    const changeId = unseen
      ? unseen.change.id
      : await commitPlan({
          change: {
            kind: "testedOut",
            payload: toPlanChangePayload({
              effect,
              lessonsSkipped,
              planItemIds: [...skipped],
              source: "system",
            }),
            reason: TESTED_OUT_NOTE,
            status: "applied",
          },
          computed,
          context,
          extraWrites,
        });

    await skipTestedOutBlocks({ goalId, notStarted: !followToday, planItemIds });

    if (followToday) {
      await followPlanToday({ changeId, context });
    }

    return { changeId, lessonsSkipped, planVersion: context.plan.version + 1 };
  });
}
