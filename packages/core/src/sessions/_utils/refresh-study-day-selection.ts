import "server-only";
import { prisma } from "@zoonk/db";
import { withPlanRetry } from "../../plans/plan-conflict";
import { appendLandedLessons } from "./append-landed-lessons";
import { selectDayPlan } from "./selected-day-plan";
import { STUDY_SESSION_INCLUDE, type StudySessionRow } from "./study-session-access";

/**
 * What Open and Continue do to a saved day: take the plan's selection once the plan changed since
 * the day was saved. Only appends to the shown queue.
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

    const selection = current.goal
      ? await selectDayPlan({ goal: current.goal, now: new Date(), timeZone, useFreshSaved: true })
      : null;

    if (
      !selection ||
      (!selection.computed &&
        !selection.inputKeyUpdate &&
        current.planVersion === selection.context.plan.version)
    ) {
      return current;
    }

    return appendLandedLessons({
      goal: selection.context.goal,
      selection,
      session: current,
      timeZone,
    });
  });
}
