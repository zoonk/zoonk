import { type ExamBlueprint } from "@zoonk/db";
import "server-only";
import { readCatchUpItems } from "../../learner/facts/catch-up-items";
import { readDayMissionProgress } from "../../learner/facts/day-mission-progress";
import { readLessonStates } from "../../learner/facts/lesson-states";
import { readSavedPlan } from "../../learner/facts/saved-plan";
import { readActiveSubscription } from "../../learner/facts/subscription";
import { loadBlockedTestOutChapters } from "../../learner/test-out/_utils/offer-eligibility";
import { readBlockPayload } from "../block-payload";
import { toDayBlockRef } from "../day-block";
import { getNextBlock } from "../day-blocks";
import { withDayState } from "../day-state";
import { type DayView, type UnstartedDayView } from "../day-view";
import { getExtraTime } from "../extra-time";
import { getSessionMinutes, getVisibleSessionTotal } from "../session-minutes";
import { loadBlockSubjects } from "./block-subjects";
import { loadCatchUpView } from "./catch-up";
import { type DayBlockInput, toDayBlockView } from "./day-block-view";
import { inDayOrder } from "./day-order";
import { planEntitlementLapseRefill } from "./entitlement-lapse-refill";
import { loadStudySessionView } from "./load-session-view";
import { planSavedMockReview } from "./saved-mock-review";
import { getSessionBar } from "./session-view";
import { type StudySessionRow } from "./study-session-access";
import { getBlueprintWritingTasks } from "./writing-block-tasks";

/** A saved day can need a POST for entitlement-only free replacements, never invented IDs. */
export async function readSavedDayView({
  blueprint,
  session,
  timeZone,
  userId,
  weekDate,
}: {
  blueprint?: ExamBlueprint | null;
  session: StudySessionRow;
  timeZone: string;
  userId: string;
  weekDate?: Date;
}): Promise<DayView> {
  const { goalId } = session;
  const readCatchUp = goalId ? () => readCatchUpItems(userId, goalId) : undefined;

  const [view, entitlement] = await Promise.all([
    loadStudySessionView({
      blueprint,
      readCatchUp,
      readDayProgress: readDayMissionProgress,
      readLessonStates,
      session,
      timeZone,
      userId,
      weekDate,
    }),
    session.goal
      ? planEntitlementLapseRefill({
          goal: session.goal,
          readSubscription: readActiveSubscription,
          session,
          timeZone,
        })
      : null,
  ]);

  if (!view.current || !session.goalId) {
    return view;
  }

  const preparing = new Set(
    view.blocks.filter((block) => block.preparing).map((block) => block.position),
  );

  const review =
    !entitlement && view.nextBlockId === null
      ? await planSavedMockReview({ preparing, session, timeZone })
      : null;

  const refill: { blocks: DayBlockInput[]; plannedMinutes: number } | null =
    entitlement ??
    (review && {
      blocks: [
        ...session.blocks,
        {
          ...review,
          brainPower: 0,
          position: Math.max(-1, ...session.blocks.map((block) => block.position)) + 1,
          status: "pending" as const,
        },
      ],
      plannedMinutes: session.plannedMinutes + review.estimatedMinutes,
    });

  if (!refill) {
    return view;
  }

  const [subjects, blockedTestOutChapters, catchUp] = await Promise.all([
    loadBlockSubjects({ blocks: refill.blocks, blueprint, goal: session.goal }),
    loadBlockedTestOutChapters({
      chapterIds: [
        ...new Set(refill.blocks.flatMap((block) => readBlockPayload(block).chapterId ?? [])),
      ],
      goalId: session.goalId,
      known: { blueprint, goal: session.goal, source: readSavedPlan(userId, session.goalId) },
      now: new Date(),
      timeZone,
      userId,
    }),
    loadCatchUpView({
      blocks: refill.blocks,
      dailyMinutes: session.goal?.dailyMinutes ?? 0,
      examTomorrow: view.examTomorrow,
      freshStart: session.freshStart,
      goalId: session.goalId,
      readItems: readCatchUp,
    }),
  ]);

  const savedViews = new Map(view.blocks.map((block) => [block.id, block]));

  const writingTasks = getBlueprintWritingTasks(blueprint);

  const blocks = inDayOrder(
    refill.blocks.map((block) => {
      const saved = block.id ? savedViews.get(block.id) : undefined;

      if (saved) {
        const { id: _id, ...fields } = saved;
        return fields;
      }

      return toDayBlockView({
        answeredItemIds: new Set(),
        block,
        blockedTestOutChapters,
        blocks: refill.blocks,
        subject: subjects.get(block.position) ?? null,
        writingTasks,
      });
    }),
  );

  const next = getNextBlock(blocks);

  const { id: _id, nextBlockId: _next, catchUp: _catchUp, missions, ...fields } = view;

  return withDayState<Omit<UnstartedDayView, "state">>(
    {
      ...fields,
      blocks,
      catchUp: catchUp
        ? { later: catchUp.later, lessonsLeft: catchUp.lessonsLeft, positions: catchUp.positions }
        : null,
      emptyDay: null,
      extraTime: getExtraTime({
        blocks: refill.blocks.map((block) => ({
          preparing: preparing.has(block.position),
          status: block.status,
        })),
        current: view.current,
      }),
      minutes: getSessionMinutes({
        blocks: refill.blocks,
        dailyGoal: view.minutes.dailyGoal,
        endedAt: session.endedAt,
        planned: getVisibleSessionTotal({
          blocks: session.blocks,
          planned: refill.plannedMinutes,
          visibleIds: new Set(refill.blocks.flatMap((block) => block.id ?? [])),
        }),
        reserved: view.lessonsComing || view.lessonsToPrepare,
      }),
      missions: missions.map((mission): UnstartedDayView["missions"][number] => {
        const { opens, ...rest } = mission;

        if (opens?.kind !== "block") {
          return { ...rest, ...(opens && { opens }) };
        }

        const target = view.blocks.find((block) => block.id === opens.blockId);
        return target ? { ...rest, opens: { kind: "block", ref: toDayBlockRef(target) } } : rest;
      }),
      nextPosition: next?.position ?? null,
      sessionBar: getSessionBar(refill.blocks),
      status: "unstarted",
    },
    session.endedAt,
  );
}
