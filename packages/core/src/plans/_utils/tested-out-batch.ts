import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { type PlanEffect } from "../planner/plan-effect";
import { commitPlan } from "./commit-plan";
import {
  type LivingPlanBatch,
  appendLivingPlanBatch,
  mergeChangeTopics,
} from "./living-plan-change";
import { parsePlanChangePayload } from "./plan-change-payload";
import { type PlanContext } from "./plan-context";
import { parsePlanSnapshot } from "./plan-snapshot";
import { type ComputedPlan } from "./replan";
import { getSeenEffect } from "./seen-effect";
import { countLessons } from "./stand-in-lessons";
import { RECENT_CHANGE_MS } from "./today-plan-change";

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

export async function findUnseenSkip({
  context,
  now,
}: {
  context: PlanContext;
  now: Date;
}): Promise<LivingPlanBatch | null> {
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

  const payload = parsePlanChangePayload(latest.payload);
  const { livingPlanDay, seenAt, versionAfter } = payload;

  if (livingPlanDay || seenAt !== null || versionAfter !== context.plan.version) {
    return null;
  }

  const kept = await prisma.planChangeSnapshot.findUnique({
    select: { plan: true },
    where: { changeId: latest.id },
  });

  const snapshot = kept?.plan;
  const items = parsePlanSnapshot(snapshot)?.items;

  return isJsonObject(snapshot) && items
    ? { change: latest, items, payload, snapshot, storedPayload: latest.payload }
    : null;
}

export async function commitTestedOutBatch({
  computed,
  context,
  effect,
  livingPlanDay,
  save,
  skipped,
  unseen,
}: {
  computed: ComputedPlan;
  context: PlanContext;
  effect: PlanEffect;
  livingPlanDay?: string;
  save: (tx: TransactionClient) => Promise<unknown>;
  skipped: ReadonlySet<string>;
  unseen: LivingPlanBatch;
}): Promise<void> {
  const added = unseen.payload;
  const counted = new Set(added.planItemIds);

  const newlySkipped = countLessons(
    context.items.filter((item) => skipped.has(item.id) && !counted.has(item.id)),
  );

  await commitPlan({
    change: null,
    computed,
    context,
    extraWrites: async (tx) => {
      await save(tx);

      const seen = getSeenEffect({
        computed,
        shown: unseen.items.map((item) =>
          skipped.has(item.id) || counted.has(item.id)
            ? { ...item, status: "testedOut" as const }
            : item,
        ),
      });

      await appendLivingPlanBatch({
        batch: unseen,
        payload: {
          effect: joinSkipEffects({
            newer: effect,
            older: added.effect,
            seen: {
              ...seen,
              ...(livingPlanDay && {
                topicsAdded: mergeChangeTopics(added.effect?.topicsAdded, effect.topicsAdded),
                topicsLeftOut: mergeChangeTopics(added.effect?.topicsLeftOut, effect.topicsLeftOut),
              }),
            },
          }),
          lessonsSkipped: (added.lessonsSkipped ?? 0) + newlySkipped,
          planItemIds: [...new Set([...added.planItemIds, ...skipped])],
          versionAfter: context.plan.version + 1,
        },
        tx,
      });
    },
  });
}
