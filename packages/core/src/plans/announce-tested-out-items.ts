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
import { loadPlanAtToken } from "./_utils/plan-token";
import { computePlan } from "./_utils/replan";
import { withSeenTopics } from "./_utils/seen-effect";
import { countLessons } from "./_utils/stand-in-lessons";
import { RECENT_CHANGE_MS } from "./_utils/today-plan-change";
import { PlanConflictError, withPlanRetry } from "./plan-conflict";
import { type PlanEffect } from "./planner/plan-effect";

/** A plain note for logs and admin; the apps say "Skipped 12 lessons you already know". */
const TESTED_OUT_NOTE = "Placement or a test-out skipped lessons the learner already knows.";

type Move = { after: unknown; before: unknown };

/** A move over two skips: its first `before` and its last `after`; none when they're the same. */
function joinMove<T extends Move>(older: T | undefined, newer: T | undefined): T | undefined {
  const move = older && newer ? { ...newer, before: older.before } : (newer ?? older);
  return move && move.after !== move.before ? move : undefined;
}

/** The moves of two skips, one per phase or area (`key`), as `joinMove` joins them. */
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

type AreaTopics = { area: string; topics: string[] };

function joinTopics(older: readonly AreaTopics[] = [], newer: readonly AreaTopics[] = []) {
  const entries = [...older, ...newer];

  return [...new Set(entries.map((entry) => entry.area))].map((area) => ({
    area,
    topics: joinNames(
      entries.filter((entry) => entry.area === area).flatMap((entry) => entry.topics),
    ),
  }));
}

/**
 * Two skips as one, from the plan before the first to the plan after the last: what moved keeps its
 * first `before` and its last `after`, and what each named adds up.
 */
function joinSkipEffects(older: PlanEffect | null, newer: PlanEffect): PlanEffect {
  if (!older) {
    return newer;
  }

  const areaEnds = joinMoves({
    key: (end) => end.area,
    newer: newer.areaEnds,
    older: older.areaEnds,
  });

  const areaStarts = joinMoves({
    key: (start) => start.area,
    newer: newer.areaStarts,
    older: older.areaStarts,
  });

  const phaseEnds = joinMoves({
    key: (end) => end.name,
    newer: newer.phaseEnds,
    older: older.phaseEnds,
  });

  const lessonsLeftOut = joinNames(older.lessonsLeftOut, newer.lessonsLeftOut);
  const listeningPastBasics = joinNames(older.listeningPastBasics, newer.listeningPastBasics);
  const topicsAdded = joinTopics(older.topicsAdded, newer.topicsAdded);
  const topicsLeftOut = joinTopics(older.topicsLeftOut, newer.topicsLeftOut);
  const nextMock = joinMove(older.nextMock, newer.nextMock);
  const weeklyEvents = joinMove(older.weeklyEvents, newer.weeklyEvents);

  const areaLessons = joinMoves({
    key: (area) => area.area,
    newer: newer.areaLessons,
    older: older.areaLessons,
  });

  return {
    ...older,
    ...newer,
    endDateBefore: older.endDateBefore,
    lessonsAdded: older.lessonsAdded + newer.lessonsAdded,
    lessonsRemoved: older.lessonsRemoved + newer.lessonsRemoved,
    ...(areaEnds.length > 0 && { areaEnds }),
    ...(areaLessons.length > 0 && { areaLessons }),
    ...(areaStarts.length > 0 && { areaStarts }),
    ...(lessonsLeftOut.length > 0 && { lessonsLeftOut }),
    ...(listeningPastBasics.length > 0 && { listeningPastBasics }),
    ...(nextMock && { nextMock }),
    ...(phaseEnds.length > 0 && { phaseEnds }),
    ...(topicsAdded.length > 0 && { topicsAdded }),
    ...(topicsLeftOut.length > 0 && { topicsLeftOut }),
    ...(weeklyEvents && { weeklyEvents }),
  };
}

/**
 * The plan's latest change when it's a skip the learner hasn't seen yet, still news on Today (see
 * `RECENT_CHANGE_MS`), with the plan still as it left it, and the snapshot its Undo restores: a new
 * skip adds to it, so Today's one card counts them all and its Undo brings them all back. A
 * session's placement answers skip lessons one answer at a time: Maya's two answers skipped 60
 * each, and Today said 60.
 */
async function findUnseenSkip({
  context,
  now,
}: {
  context: PlanContext;
  now: Date;
}): Promise<{ change: PlanChange; payload: JsonObject; snapshot: JsonObject } | null> {
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
  return isJsonObject(snapshot) ? { change: latest, payload: latest.payload, snapshot } : null;
}

/**
 * After placement or a test-out skipped plan items, says so on the plan ("Skipped 12 lessons you
 * already know", with an undo) and re-plans from today, so the time those lessons would have
 * taken goes to what comes next, today's blocks not started included. Skips the learner hasn't
 * seen yet are one change (see `findUnseenSkip`). Returns the change, so the screen that skipped
 * them can offer its undo right there, the lessons it skipped as every screen counts them, and the
 * plan's version the skip left (`planVersion`); null when the plan isn't the planner's yet.
 */
export async function announceTestedOutItems({
  extraWrites,
  followToday = true,
  goalId,
  now,
  pastBasicsAreas = [],
  planItemIds,
  timeZone,
}: {
  /** Other writes that must land with the announcement, such as ending the plan setup task it is. */
  extraWrites?: (tx: TransactionClient) => Promise<unknown>;
  /**
   * Today's blocks not started follow the re-plan: true for a test the learner took on its own
   * (placement's end, a chapter test). An answer inside today's session (the first week's
   * placement questions) keeps the rest of the day as the learner was shown it, but for the
   * skipped lessons: Pedro's right answer in his quick review turned his full review the day
   * before his test into a short practice.
   */
  followToday?: boolean;
  goalId: string;
  now: Date;
  /**
   * Areas the same answers start past their basics (see `listPlacementListeningAreas`): they land
   * with the announcement, so its undo takes them back too.
   */
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
      ...withSeenTopics({ computed, shown: context.items }),
      ...getListeningPastBasicsEffect({ areas: pastBasicsAreas, state: context.state }),
    };

    // The unseen skip takes this one in. Writing the plan drops earlier changes' snapshots, so its
    // snapshot from before its first skip is kept again for the Undo.
    if (unseen) {
      const added = parsePlanChangePayload(unseen.payload);
      const counted = new Set(added.planItemIds);

      // Items it already counted (two tabs sending the same test) count once.
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
                effect: joinSkipEffects(added.effect, effect),
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

    // The learner's own answers skipped them, so today skips them too, the lesson they have open
    // included, and the part of today not started follows the plan (or keeps what it showed).
    await skipTestedOutBlocks({ goalId, notStarted: !followToday, planItemIds });

    if (followToday) {
      await followPlanToday({ changeId, context });
    }

    return { changeId, lessonsSkipped, planVersion: context.plan.version + 1 };
  });
}
