import { type Goal, type StudySessionBlock } from "@zoonk/db";
import { readSelectedItemFacts } from "../../plans/_utils/selected-item-contract";
import { parsePlanGraph, parsePlanSettings } from "../../plans/planner/plan-state";
import { readBlockPayload } from "../block-payload";
import { getSessionDayMinutes } from "../fresh-start";
import { getSessionUsedMinutes } from "../session-minutes";
import { pickDayLessons } from "./day-lessons";
import { isMockOnlyDay } from "./day-mock";
import { isSavedReviewDay } from "./day-review";
import { type ExamPrepAccess } from "./exam-access";
import { canAddSessionLessons } from "./session-lessons";
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
  if (
    !canAddSessionLessons({
      reviewDay: isSavedReviewDay({
        blocks,
        includesMockExams: access.includesMockExams,
        items: plan.items,
        today: localDate,
      }),
      trialEnded: access.trialEnded,
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

  const { fillItems, reservedItems } = pickDayLessons({
    awaitingOutlines: false,
    goal,
    localDate,
    plan: { ...plan, graph: parsePlanGraph(plan.graph), prerequisites },
  });

  const held = new Set(blocks.flatMap((block) => block.lessonId ?? []));

  return [...new Set([...fillItems, ...reservedItems])]
    .toSorted((a, b) => a.position - b.position)
    .filter((item) => !item.lessonId || !held.has(item.lessonId));
}

export function hasSessionLessonReservation({
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
    access,
    blocks: session.blocks,
    goal: session.goal,
    localDate: session.localDate,
    plan,
    prerequisites,
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
