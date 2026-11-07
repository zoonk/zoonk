import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { listDayStandIns } from "../../lookahead/outline-window";
import { withPlanRetry } from "../../plans/plan-conflict";
import { appendLandedLessons } from "./append-landed-lessons";
import { AWAITING_OUTLINES_VERSION } from "./day-plan-version";
import { type SelectedDayPlan, selectDayPlan } from "./selected-day-plan";
import { STUDY_SESSION_INCLUDE, type StudySessionRow } from "./study-session-access";

async function takesSelection({
  selection,
  session,
}: {
  selection: SelectedDayPlan;
  session: StudySessionRow;
}): Promise<boolean> {
  if (selection.computed || selection.inputKeyUpdate) {
    return true;
  }

  if (session.planVersion !== AWAITING_OUTLINES_VERSION) {
    return session.planVersion !== selection.context.plan.version;
  }

  // A waiting day takes the plan's day once the lessons it waited for are written into the plan.
  // While it still holds unwritten ones, it waits, or fills from the plan's next lessons once
  // nobody is writing them.
  const standIns = await listDayStandIns({
    goalId: selection.context.goal.id,
    localDate: session.localDate,
  });

  return standIns.length === 0;
}

/**
 * What Open and Continue do to a saved day: take the plan's current selection when it changed,
 * otherwise the lessons that landed since. Either only appends to the shown queue.
 */
export async function followSavedDay({
  goal,
  session,
  timeZone,
}: {
  goal: Goal;
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

    if (selection && (await takesSelection({ selection, session: current }))) {
      return appendLandedLessons({
        goal: selection.context.goal,
        selection,
        session: current,
        timeZone,
      });
    }

    return appendLandedLessons({ goal, session: current, timeZone });
  });
}
