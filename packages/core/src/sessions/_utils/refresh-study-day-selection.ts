import "server-only";
import { prisma } from "@zoonk/db";
import { withPlanRetry } from "../../plans/plan-conflict";
import { appendLandedLessons } from "./append-landed-lessons";
import { AWAITING_OUTLINES_VERSION } from "./day-plan-version";
import { selectDayPlan } from "./selected-day-plan";
import { STUDY_SESSION_INCLUDE, type StudySessionRow } from "./study-session-access";

/** Continue reuses current inputs; a changed selection can only append to the shown queue. */
export async function refreshStudyDaySelection({
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

    if (!current.goal) {
      return current;
    }

    const selection = await selectDayPlan({
      goal: current.goal,
      now: new Date(),
      timeZone,
      useFreshSaved: true,
    });

    if (!selection) {
      return current;
    }

    if (
      !selection.computed &&
      !selection.inputKeyUpdate &&
      (current.planVersion === selection.context.plan.version ||
        current.planVersion === AWAITING_OUTLINES_VERSION)
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
