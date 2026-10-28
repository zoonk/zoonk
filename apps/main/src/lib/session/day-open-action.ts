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

/** `retryable` asks for one more try in a request of its own. */
export type DayOpenOutcome =
  | {
      destination: StudyDestination | null;
      sessionId: string;
      status: "opened";
      targetStatus: DayTargetStatus | null;
    }
  | { status: "empty" | "retryable" }
  | { status: "failed" | "goalNotActive" | "notFound" | "preparing" | "unauthorized" };

const dayOpenInputSchema = openStudyDayInputSchema.required({ timeZone: true });

function isStartable(status: DayTargetStatus | null): boolean {
  return status === "next" || status === "resolved";
}

/** Opening writes no AI work; only starting the tapped step does. */
export async function openStudyDayAction(input: OpenStudyDayInput): Promise<DayOpenOutcome> {
  const parsed = dayOpenInputSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "failed" };
  }

  const { data: result, error } = await safeAsync(async (): Promise<DayOpenOutcome> => {
    const opened = await openStudyDay(parsed.data);

    if (opened.status !== "opened") {
      return { status: opened.status };
    }

    const { sessionId, target, targetStatus } = opened;
    const startable = target !== null && isStartable(targetStatus);

    const destination = startable
      ? await openStudyBlock({ block: target, sessionId, timeZone: parsed.data.timeZone })
      : null;

    if (startable && !destination) {
      return { status: "failed" };
    }

    return { destination, sessionId, status: "opened", targetStatus };
  });

  if (error) {
    logError("[openStudyDayAction] Failed to open the day:", error);
    return { status: "failed" };
  }

  return result;
}
