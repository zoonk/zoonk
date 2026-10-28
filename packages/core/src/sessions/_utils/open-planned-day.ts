import "server-only";
import { appendLandedLessons } from "./append-landed-lessons";
import { persistEntitlementLapseRefill } from "./entitlement-lapse-refill";
import { hasSameGoalInputs } from "./goal-input-snapshot";
import { persistStudyDay } from "./persist-study-day";
import { type PlannedStudyDay, planStudyDay } from "./plan-study-day";
import { refreshStudyDaySelection } from "./refresh-study-day-selection";
import { findSavedDaySession } from "./saved-day-session";
import { selectDayPlan } from "./selected-day-plan";
import { type SessionDayContext } from "./session-placement";
import { type StudySessionRow } from "./study-session-access";

export type OpenPlannedDay =
  | { created: boolean; initialDay?: PlannedStudyDay; session: StudySessionRow; status: "opened" }
  | { status: "empty" | "stale" | "preparing" };

/** Select one resolution per request; a conflict must start a new HTTP request rather than silently reselecting. */
export async function openPlannedDay(
  context: SessionDayContext & { keepEmpty?: boolean },
): Promise<OpenPlannedDay> {
  const { goal, now, timeZone, userId } = context;
  const saved = await findSavedDaySession({ goalId: goal.id, now, timeZone, userId });

  if (saved) {
    const refilled = await persistEntitlementLapseRefill({ goal, session: saved, timeZone });

    if (!refilled) {
      return { status: "stale" };
    }

    const selected = await refreshStudyDaySelection({ session: refilled, timeZone });
    const session = await appendLandedLessons({ goal, session: selected ?? refilled, timeZone });
    return { created: false, session, status: "opened" };
  }

  const selection = await selectDayPlan({ goal, now, timeZone });

  if (!selection) {
    return { status: "preparing" };
  }

  if (!hasSameGoalInputs({ current: selection.context.goal, planned: goal })) {
    return { status: "stale" };
  }

  const planned = await planStudyDay({ ...context, selection });

  if (
    planned.blocks.length === 0 &&
    !context.keepEmpty &&
    !selection.computed &&
    !selection.inputKeyUpdate
  ) {
    return { status: "empty" };
  }

  const written = await persistStudyDay({ context, planned, selection });

  if (written.status === "stale") {
    return { status: "stale" };
  }

  const session = await findSavedDaySession({ goalId: goal.id, now, timeZone, userId });

  if (!session) {
    return { status: "stale" };
  }

  return {
    created: written.status === "created",
    initialDay: written.status === "created" ? planned : undefined,
    session,
    status: "opened",
  };
}
