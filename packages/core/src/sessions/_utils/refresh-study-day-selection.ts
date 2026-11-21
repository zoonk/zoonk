import "server-only";
import { prisma } from "@zoonk/db";
import { withPlanRetry } from "../../plans/plan-conflict";
import { appendLandedLessons } from "./append-landed-lessons";
import { findRemovedWritingBlocks } from "./removed-writing-blocks";
import { selectDayPlan } from "./selected-day-plan";
import { STUDY_SESSION_INCLUDE, type StudySessionRow } from "./study-session-access";

/**
 * What Open and Continue do to a saved day: take the plan's selection once the plan changed since
 * the day was saved and drop unissued writing the notice removed.
 */
export async function followSavedDay({
  session,
  timeZone,
}: {
  session: StudySessionRow;
  timeZone: string;
}): Promise<StudySessionRow> {
  return withPlanRetry(async () => {
    const current = await prisma.studySession.findUniqueOrThrow({
      include: STUDY_SESSION_INCLUDE,
      where: { id: session.id },
    });

    const [selection, removed] = await Promise.all([
      current.goal
        ? selectDayPlan({ goal: current.goal, now: new Date(), timeZone, useFreshSaved: true })
        : null,
      findRemovedWritingBlocks({ fresh: true, session: current }),
    ]);

    const dropped = current.blocks.filter(
      ({ id, status }) => removed.has(id) && status !== "skipped",
    );

    if (
      !selection ||
      (dropped.length === 0 &&
        !selection.computed &&
        !selection.inputKeyUpdate &&
        current.planVersion === selection.context.plan.version)
    ) {
      return current;
    }

    return appendLandedLessons({
      dropped,
      goal: selection.context.goal,
      selection,
      session: current,
      timeZone,
    });
  });
}
