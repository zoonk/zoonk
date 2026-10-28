import "server-only";
import { prisma } from "@zoonk/db";
import { withPlanRetry } from "../../plans/plan-conflict";
import { replaceNotStartedBlocks } from "./refresh-day-session";
import { selectDayPlan } from "./selected-day-plan";
import { STUDY_SESSION_INCLUDE, type StudySessionRow } from "./study-session-access";

/** Continue checks current inputs, saving a new selection with only the unstarted queue. */
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

    const selection = await selectDayPlan({ goal: current.goal, now: new Date(), timeZone });
    // Item-only goals keep their existing open path until the phase B legacy cutover.
    if (!selection || selection.state.graph.skills.length === 0) {
      return current;
    }

    if (
      !selection.computed &&
      !selection.inputKeyUpdate &&
      current.planVersion === selection.context.plan.version
    ) {
      return current;
    }

    await replaceNotStartedBlocks({
      day: { goal: selection.context.goal, session: current, timeZone },
      selection,
    });

    return prisma.studySession.findUniqueOrThrow({
      include: STUDY_SESSION_INCLUDE,
      where: { id: session.id },
    });
  });
}
