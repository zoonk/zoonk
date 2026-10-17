import "server-only";
import { persistEntitlementLapseRefill } from "./entitlement-lapse-refill";
import { persistStudyDay } from "./persist-study-day";
import { type PlannedStudyDay, planStudyDay } from "./plan-study-day";
import { findSavedDaySession } from "./saved-day-session";
import { selectDayPlan } from "./selected-day-plan";
import { type SessionDayContext } from "./session-placement";
import { type StudySessionRow } from "./study-session-access";

export type OpenPlannedDay =
  | { created: boolean; initialDay?: PlannedStudyDay; session: StudySessionRow; status: "opened" }
  | { status: "empty" | "stale" | "preparing" };

/** One selected resolution for the entire open; a conflict belongs to another HTTP request. */
export async function openPlannedDay(
  context: SessionDayContext & { keepEmpty?: boolean },
): Promise<OpenPlannedDay> {
  const { goal, now, timeZone, userId } = context;
  const saved = await findSavedDaySession({ goalId: goal.id, now, timeZone, userId });

  if (saved) {
    const session = await persistEntitlementLapseRefill({ goal, session: saved, timeZone });
    return session ? { created: false, session, status: "opened" } : { status: "stale" };
  }

  const selection = await selectDayPlan({ goal, now, timeZone });

  if (!selection) {
    return { status: "preparing" };
  }

  const planned = await planStudyDay({ ...context, selection });

  if (planned.blocks.length === 0 && !context.keepEmpty) {
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
