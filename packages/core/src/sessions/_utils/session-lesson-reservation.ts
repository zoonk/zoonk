import { type Goal, type StudySessionBlock } from "@zoonk/db";
import { readSelectedItemFacts } from "../../plans/_utils/selected-item-contract";
import { parsePlanGraph, parsePlanSettings } from "../../plans/planner/plan-state";
import { readBlockPayload } from "../block-payload";
import { getSessionDayMinutes } from "../fresh-start";
import { getSessionUsedMinutes } from "../session-minutes";
import { pickDayLessons } from "./day-lessons";
import { findPlannedReview } from "./day-review";
import { keepDuelLessons, markLessonsAroundChallenges } from "./lessons-before-challenges";
import { canAddSessionLessons } from "./session-lessons";
import { type SessionPlanItem } from "./session-plan-item";
import { type StudySessionRow } from "./study-session-access";

type ReservationBlock = Pick<
  StudySessionBlock,
  "estimatedMinutes" | "lessonId" | "payload" | "status"
>;

type ReservationPlan = { graph: unknown; settings: unknown; items: readonly SessionPlanItem[] };

export function getSessionLessonCandidates({
  goal,
  localDate,
  plan,
  blocks,
  prerequisites = new Map(),
  trialEnded = false,
}: {
  goal: Pick<Goal, "kind">;
  localDate: Date;
  plan: ReservationPlan;
  blocks: readonly ReservationBlock[];
  prerequisites?: ReadonlyMap<string, readonly string[]>;
  trialEnded?: boolean;
}) {
  if (
    !canAddSessionLessons({
      reviewDay:
        Boolean(findPlannedReview({ items: plan.items, today: localDate })) ||
        blocks.some((block) => readBlockPayload(block).fullReview),
      trialEnded,
    })
  ) {
    return [];
  }

  const { fillItems, reservedItems } = pickDayLessons({
    awaitingOutlines: false,
    goal,
    localDate,
    plan: { ...plan, graph: parsePlanGraph(plan.graph), prerequisites },
  });

  const checkpoints = blocks.flatMap((block) => {
    const checkpoint = readBlockPayload(block).checkpoint;
    return checkpoint ? [{ ...checkpoint, planItemId: readBlockPayload(block).planItemId }] : [];
  });

  const selected = [...new Set([...fillItems, ...reservedItems])].toSorted(
    (a, b) => a.position - b.position,
  );

  const marked = markLessonsAroundChallenges({
    checkpoints,
    items: plan.items,
    lessons: selected.map((item) => ({ ...item, planItemId: item.id, planItemKey: item.key })),
    today: localDate,
  });

  const held = new Set(blocks.flatMap((block) => block.lessonId ?? []));

  return keepDuelLessons({ checkpoints, lessons: marked }).filter(
    (item) => !item.lessonId || !held.has(item.lessonId),
  );
}

export function hasSessionLessonReservation({
  session,
  plan,
  prerequisites,
  trialEnded = false,
}: {
  session: Pick<StudySessionRow, "goal" | "freshStart" | "localDate" | "plannedMinutes"> & {
    blocks: readonly ReservationBlock[];
    status?: StudySessionRow["status"];
  };
  plan: ReservationPlan | null;
  prerequisites?: ReadonlyMap<string, readonly string[]>;
  trialEnded?: boolean;
}): boolean {
  if (
    !session.goal ||
    !plan ||
    session.status === "completed" ||
    getSessionDayMinutes({
      dailyMinutes: session.goal.dailyMinutes,
      freshStart: session.freshStart,
    }) === 0
  ) {
    return false;
  }

  const room = session.plannedMinutes - getSessionUsedMinutes(session.blocks);

  const candidates = getSessionLessonCandidates({
    blocks: session.blocks,
    goal: session.goal,
    localDate: session.localDate,
    plan,
    prerequisites,
    trialEnded,
  });

  const pace = parsePlanSettings(plan.settings).pace?.factor ?? 1;
  const next = candidates[0];

  return (
    room >= 1 &&
    next !== undefined &&
    (candidates.some((item) => !item.lessonId) ||
      Math.max(
        1,
        Math.round(readSelectedItemFacts(next.facts)?.parts.written ?? (next.minutes ?? 3) * pace),
      ) <= room)
  );
}
