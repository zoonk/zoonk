import "server-only";
import { type ExamBlueprint } from "@zoonk/db";
import { loadBlockedTestOutChapters } from "../../learner/test-out/_utils/offer-eligibility";
import { readBlockPayload } from "../block-payload";
import { toDayBlockRef } from "../day-block";
import { type DayView, type UnstartedDayView } from "../day-view";
import { getExtraTime } from "../extra-time";
import { loadBlockSubjects } from "./block-subjects";
import { loadCatchUpView } from "./catch-up";
import { toDayBlockView } from "./day-block-view";
import { planEntitlementLapseRefill } from "./entitlement-lapse-refill";
import { withLessonDisplayMinutes } from "./lesson-display-minutes";
import { loadStudySessionView } from "./load-session-view";
import { getSessionBar } from "./session-view";
import { type StudySessionRow } from "./study-session-access";

/** A saved day can need a POST for entitlement-only free replacements, never invented IDs. */
export async function readSavedDayView({
  blueprint,
  session,
  timeZone,
  userId,
  weekDate,
}: {
  /** The session goal's exam blueprint when the GET already read it (see `loadNotice`). */
  blueprint?: ExamBlueprint | null;
  session: StudySessionRow;
  timeZone: string;
  userId: string;
  weekDate?: Date;
}): Promise<DayView> {
  const [view, refill] = await Promise.all([
    loadStudySessionView({ blueprint, session, timeZone, userId, weekDate }),
    session.goal ? planEntitlementLapseRefill({ goal: session.goal, session, timeZone }) : null,
  ]);

  if (!refill || !view.current || !session.goalId) {
    return view;
  }

  const [display, subjects, blockedTestOutChapters, catchUp] = await Promise.all([
    withLessonDisplayMinutes({ blocks: refill.blocks }),
    loadBlockSubjects({ blocks: refill.blocks, blueprint, goal: session.goal }),
    loadBlockedTestOutChapters({
      chapterIds: [
        ...new Set(refill.blocks.flatMap((block) => readBlockPayload(block).chapterId ?? [])),
      ],
      goalId: session.goalId,
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
      trialEnded: view.examAccess.trialEnded,
      userId,
    }),
  ]);

  const savedViews = new Map(view.blocks.map((block) => [block.id, block]));

  const blocks = display.map((block) => {
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
    });
  });

  const next =
    blocks.find((block) => block.status === "active") ??
    blocks.find((block) => block.status === "pending");

  const { id: _id, nextBlockId: _next, catchUp: _catchUp, missions, ...fields } = view;

  return {
    ...fields,
    blocks,
    catchUp: catchUp
      ? { later: catchUp.later, lessonsLeft: catchUp.lessonsLeft, positions: catchUp.positions }
      : null,
    emptyDay: null,
    extraTime: getExtraTime({
      blocks: refill.blocks.map((block) => ({
        extra: readBlockPayload(block).extra,
        kind: block.kind,
        status: block.status,
      })),
      remainingLimitMinutes: view.dailyLimit?.remainingMinutes ?? null,
    }),
    minutes: {
      ...view.minutes,
      planned: refill.blocks.reduce((sum, block) => sum + (block.estimatedMinutes ?? 0), 0),
    },
    missions: missions.map((mission): UnstartedDayView["missions"][number] => {
      const { opens, ...rest } = mission;

      if (opens?.kind !== "block") {
        return { ...rest, ...(opens && { opens }) };
      }

      const target = view.blocks.find((block) => block.id === opens.blockId);
      return target ? { ...rest, opens: { kind: "block", ref: toDayBlockRef(target) } } : rest;
    }),
    nextPosition: next?.position ?? null,
    sessionBar: getSessionBar(blocks),
    status: "unstarted",
  };
}
