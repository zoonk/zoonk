"use server";

import { openStudyDay } from "@zoonk/core/sessions/open";
import {
  type DayTargetStatus,
  type OpenStudyDayInput,
  openStudyDayInputSchema,
} from "@zoonk/core/sessions/open-day-contract";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { openStudyBlock } from "./open-study-block";
import { type StudyDestination } from "./study-destination";

/**
 * What opening a day comes back with, for the tap that sent it: the day opened, for whom and at
 * which revision, its session, and where the tapped step plays once it started (`destination`;
 * null when no step was asked for or it changed since the screen showed it, which `targetStatus`
 * says). `retryable` asks for one more try in a request of its own; `empty` is a day with nothing
 * to open. A step that should have started and didn't is `failed`, like an error.
 */
export type DayOpenOutcome =
  | {
      actorId: string;
      destination: StudyDestination | null;
      revision: string;
      sessionId: string;
      status: "opened";
      targetStatus: DayTargetStatus | null;
    }
  | { actorId: string; revision: string; status: "empty" | "retryable" }
  | { status: "failed" | "goalNotActive" | "notFound" | "preparing" | "unauthorized" };

/** The browser's zone is part of every tap here, as for the session's other actions. */
const dayOpenInputSchema = openStudyDayInputSchema.required({ timeZone: true });

function isStartable(status: DayTargetStatus | null): boolean {
  return status === "next" || status === "resolved";
}

/**
 * Opens the learner's day of one goal (`goalId`, the day the screen showed), the same core
 * capability as `POST /v1/goals/{goalId}/study-sessions`, then starts the tapped step when it's
 * still the work the screen showed, as a tap on a saved day does. Opening writes no AI work: only
 * starting the step does what starting it always did. A bare open (no `target`) only opens.
 */
export async function openStudyDayAction(input: OpenStudyDayInput): Promise<DayOpenOutcome> {
  const parsed = dayOpenInputSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "failed" };
  }

  const { data: result, error } = await safeAsync(async (): Promise<DayOpenOutcome> => {
    const opened = await openStudyDay(parsed.data);

    if (opened.status !== "opened") {
      return "actorId" in opened
        ? { actorId: opened.actorId, revision: opened.revision, status: opened.status }
        : { status: opened.status };
    }

    const { sessionId, target, targetStatus } = opened;
    const startable = target !== null && isStartable(targetStatus);

    const destination = startable
      ? await openStudyBlock({ block: target, sessionId, timeZone: parsed.data.timeZone })
      : null;

    if (startable && !destination) {
      return { status: "failed" };
    }

    return {
      actorId: opened.actorId,
      destination,
      revision: opened.revision,
      sessionId,
      status: "opened",
      targetStatus,
    };
  });

  if (error) {
    logError("[openStudyDayAction] Failed to open the day:", error);
    return { status: "failed" };
  }

  return result;
}
