import { type Goal, type StudySessionBlock } from "@zoonk/db";
import { readSelectedItemFacts } from "../../plans/_utils/selected-item-contract";
import { isStandIn } from "../../plans/planner/plan-item-rules";
import { parsePlanGraph, parsePlanSettings } from "../../plans/planner/plan-state";
import { readBlockPayload } from "../block-payload";
import { getSessionDayMinutes } from "../fresh-start";
import { getSessionUsedMinutes } from "../session-minutes";
import { getUnwrittenMinutesOn, pickDayLessons } from "./day-lessons";
import { isMockOnlyDay } from "./day-mock";
import { findPlannedReview, isSavedFullReviewDay, listReviewExtraItems } from "./day-review";
import { type ExamPrepAccess } from "./exam-access";
import { type SessionPlanItem } from "./session-plan-item";
import { type StudySessionRow } from "./study-session-access";

type ReservationBlock = Pick<
  StudySessionBlock,
  "estimatedMinutes" | "lessonId" | "payload" | "status"
>;

type ReservationPlan = { graph: unknown; settings: unknown; items: readonly SessionPlanItem[] };

export function getSessionLessonCandidates({
  access,
  goal,
  localDate,
  plan,
  blocks,
  prerequisites = new Map(),
}: {
  access: ExamPrepAccess;
  goal: Pick<Goal, "dailyMinutes" | "kind" | "targetDate">;
  localDate: Date;
  plan: ReservationPlan;
  blocks: readonly ReservationBlock[];
  prerequisites?: ReadonlyMap<string, readonly string[]>;
}) {
  const reviewDay = findPlannedReview({ items: plan.items, today: localDate }) !== null;

  if (
    (reviewDay && goal.kind !== "exam") ||
    isSavedFullReviewDay({
      blocks,
      includesMockExams: access.includesMockExams,
      items: plan.items,
      today: localDate,
    }) ||
    isMockOnlyDay({
      goal,
      hasMock: blocks.some((block) => readBlockPayload(block).checkpoint?.mock),
      items: plan.items,
      planSettings: plan.settings,
      today: localDate,
    })
  ) {
    return [];
  }

  const graph = parsePlanGraph(plan.graph);
  const items = reviewDay ? listReviewExtraItems({ ...plan, graph, today: localDate }) : plan.items;

  const { fillItems, reservedItems } = pickDayLessons({
    awaitingOutlines: false,
    goal,
    localDate,
    plan: { graph, items, prerequisites },
  });

  const held = new Set(blocks.flatMap((block) => block.lessonId ?? []));

  return [...new Set([...fillItems, ...reservedItems])]
    .toSorted((a, b) => a.position - b.position)
    .filter((item) => !item.lessonId || !held.has(item.lessonId));
}

function getReservedCandidates({
  access,
  session,
  plan,
  prerequisites,
}: {
  access: ExamPrepAccess;
  session: Pick<StudySessionRow, "goal" | "freshStart" | "localDate" | "plannedMinutes"> & {
    blocks: readonly ReservationBlock[];
    status?: StudySessionRow["status"];
  };
  plan: ReservationPlan | null;
  prerequisites?: ReadonlyMap<string, readonly string[]>;
}) {
  if (
    !session.goal ||
    !plan ||
    session.status === "completed" ||
    getSessionDayMinutes({
      dailyMinutes: session.goal.dailyMinutes,
      freshStart: session.freshStart,
    }) === 0
  ) {
    return null;
  }

  const room = session.plannedMinutes - getSessionUsedMinutes(session.blocks);

  const candidates = getSessionLessonCandidates({
    access,
    blocks: session.blocks,
    goal: session.goal,
    localDate: session.localDate,
    plan,
    prerequisites,
  });

  const pace = parsePlanSettings(plan.settings).pace?.factor ?? 1;
  const next = candidates[0];

  const reserved =
    room >= 1 &&
    next !== undefined &&
    (candidates.some((item) => !item.lessonId) ||
      Math.max(
        1,
        Math.round(readSelectedItemFacts(next.facts)?.parts.written ?? (next.minutes ?? 3) * pace),
      ) <= room);

  return reserved ? candidates : null;
}

export function hasSessionLessonReservation(
  input: Parameters<typeof getReservedCandidates>[0],
): boolean {
  return getReservedCandidates(input) !== null;
}

export function getSessionLessonReservation(input: Parameters<typeof getReservedCandidates>[0]) {
  const candidates = getReservedCandidates(input);

  if (!candidates) {
    return { lessonPlaceholder: null, lessonRoom: false };
  }

  const placeholder = candidates
    .filter((item) => isStandIn(item))
    .flatMap((item) => {
      const minutes = getUnwrittenMinutesOn({ items: [item], today: input.session.localDate });
      return minutes > 0 ? [{ minutes, title: item.titleSnapshot }] : [];
    })[0];

  return { lessonPlaceholder: placeholder ?? null, lessonRoom: true };
}
