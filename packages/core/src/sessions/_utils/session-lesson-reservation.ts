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
import { holdUnwrittenTime } from "./unwritten-time";

type ReservationBlock = Pick<
  StudySessionBlock,
  "estimatedMinutes" | "lessonId" | "payload" | "status"
>;

type ReservationGoal = Pick<Goal, "dailyMinutes" | "kind" | "targetDate">;

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
  goal: ReservationGoal;
  localDate: Date;
  plan: ReservationPlan;
  blocks: readonly ReservationBlock[];
  prerequisites?: ReadonlyMap<string, readonly string[]>;
}) {
  const reviewDay = findPlannedReview({ items: plan.items, today: localDate }) !== null;

  if (
    blocks.some((block) => readBlockPayload(block).replacedOnlyLesson) ||
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

function estimateLessonMinutes({ item, plan }: { item: SessionPlanItem; plan: ReservationPlan }) {
  const pace = parsePlanSettings(plan.settings).pace?.factor ?? 1;

  return Math.max(
    1,
    Math.round(readSelectedItemFacts(item.facts)?.parts.written ?? (item.minutes ?? 3) * pace),
  );
}

/**
 * The day's room goes to its candidates in plan order: each unwritten one holds what the written
 * lessons before it leave (`holdUnwrittenTime`), and whether the day reaches it at all.
 */
export function holdCandidateTime({
  candidates,
  plan,
  room,
  today,
}: {
  candidates: readonly SessionPlanItem[];
  plan: ReservationPlan;
  room: number;
  today: Date;
}) {
  return holdUnwrittenTime({
    lessons: candidates
      .filter((item) => !isStandIn(item))
      .map((item) => ({ minutes: estimateLessonMinutes({ item, plan }), position: item.position })),
    room,
    unwritten: candidates
      .filter((item) => isStandIn(item))
      .map((item) => ({
        item,
        minutes: getUnwrittenMinutesOn({ items: [item], today }),
        position: item.position,
      })),
  });
}

function getReservedCandidates({
  access,
  session,
  plan,
  prerequisites,
}: {
  access: ExamPrepAccess;
  session: Pick<StudySessionRow, "freshStart" | "localDate" | "plannedMinutes"> & {
    blocks: readonly ReservationBlock[];
    goal: ReservationGoal | null;
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

  const held = holdCandidateTime({ candidates, plan, room, today: session.localDate });
  const next = candidates[0];

  const reserved =
    room >= 1 &&
    next !== undefined &&
    (held.some((hold) => hold.reached) || estimateLessonMinutes({ item: next, plan }) <= room);

  return reserved ? held : null;
}

export function hasSessionLessonReservation(
  input: Parameters<typeof getReservedCandidates>[0],
): boolean {
  return getReservedCandidates(input) !== null;
}

export function getSessionLessonReservation(input: Parameters<typeof getReservedCandidates>[0]) {
  const held = getReservedCandidates(input);

  if (!held) {
    return { lessonPlaceholder: null, lessonRoom: false, unwrittenRoom: false };
  }

  const placeholder = held.find((hold) => hold.held > 0);

  return {
    lessonPlaceholder: placeholder
      ? { minutes: placeholder.held, title: placeholder.unwritten.item.titleSnapshot }
      : null,
    lessonRoom: true,
    unwrittenRoom: held.some((hold) => hold.reached),
  };
}
