"use server";

import { openStudyDay } from "@zoonk/core/sessions/open";
import { type StudyBlockOpening } from "@zoonk/core/sessions/open-block-contract";
import {
  type DayTargetStatus,
  type OpenStudyDayInput,
  openStudyDayInputSchema,
} from "@zoonk/core/sessions/open-day-contract";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";

/** `retryable` asks for one more try in a request of its own. */
export type DayOpenOutcome =
  | {
      destination: StudyBlockOpening | null;
      sessionId: string;
      status: "opened";
      targetStatus: DayTargetStatus | null;
    }
  | { status: "empty" | "retryable" }
  | { status: "failed" | "goalNotActive" | "notFound" | "preparing" | "unauthorized" };

const dayOpenInputSchema = openStudyDayInputSchema.required({ timeZone: true });

/** Opening writes no AI work; only starting the tapped step does. */
export async function openStudyDayAction(input: OpenStudyDayInput): Promise<DayOpenOutcome> {
  const parsed = dayOpenInputSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "failed" };
  }

  const { data: opened, error } = await safeAsync(() => openStudyDay(parsed.data));

  if (error) {
    logError("[openStudyDayAction] Failed to open the day:", error);
    return { status: "failed" };
  }

  if (opened.status !== "opened") {
    return { status: opened.status };
  }

  const { opening, sessionId, targetStatus } = opened;
  return { destination: opening, sessionId, status: "opened", targetStatus };
}
