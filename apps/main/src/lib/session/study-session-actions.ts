"use server";

import { postAsLearner } from "@/lib/api/learner-api";
import { respondToMemoryInsight } from "@zoonk/core/memory/insights/respond";
import { catchUpToday } from "@zoonk/core/sessions/catch-up";
import { serializeStudyBlockCompletion } from "@zoonk/core/sessions/completion-contract";
import { addExtraStudyBlock } from "@zoonk/core/sessions/extra-block";
import { finishStudyBlock } from "@zoonk/core/sessions/finish-block";
import { openStudyBlock } from "@zoonk/core/sessions/open-block";
import {
  type OpenStudyBlockInput,
  type StudyBlockOpening,
  openStudyBlockInputSchema,
} from "@zoonk/core/sessions/open-block-contract";
import { saveDayForMission } from "@zoonk/core/sessions/save-for-mission";
import { stopStudySession } from "@zoonk/core/sessions/stop";
import { type StudyFinishOutcome } from "@zoonk/learn/session/types";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { isValidTimeZone } from "@zoonk/utils/time-zone";
import { z } from "zod";

const sessionInputSchema = z.object({
  sessionId: z.uuid(),
  timeZone: z.string().refine(isValidTimeZone),
});

const blockInputSchema = sessionInputSchema.extend({ blockId: z.uuid() });

const missionDayInputSchema = z.object({
  goalId: z.uuid(),
  timeZone: z.string().refine(isValidTimeZone),
});

type SessionInput = z.infer<typeof sessionInputSchema>;
type BlockInput = z.infer<typeof blockInputSchema>;

export async function openStudyBlockAction(
  input: OpenStudyBlockInput,
): Promise<StudyBlockOpening | null> {
  const parsed = openStudyBlockInputSchema.safeParse(input);

  if (!parsed.success) {
    return null;
  }

  const { data: result, error } = await safeAsync(() => openStudyBlock(parsed.data));

  if (error) {
    logError("[openStudyBlockAction] Failed to open a block:", error);
    return null;
  }

  return result.status === "ready" ? result.opening : null;
}

/**
 * The tap never waits for it: a navigation takes over from a Server Action still on its way, whose
 * request still runs, and the activity saves the day itself when this didn't get through.
 */
export async function saveMissionDayAction(
  input: z.infer<typeof missionDayInputSchema>,
): Promise<void> {
  const parsed = missionDayInputSchema.safeParse(input);

  if (!parsed.success) {
    return;
  }

  const { error } = await safeAsync(() => saveDayForMission(parsed.data));

  if (error) {
    logError("[saveMissionDayAction] Failed to save the mission's day:", error);
  }
}

export async function finishStudyBlockAction(input: BlockInput): Promise<StudyFinishOutcome> {
  const parsed = blockInputSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "failed" };
  }

  const { blockId, sessionId, timeZone } = parsed.data;

  const { data: result, error } = await safeAsync(() =>
    finishStudyBlock({ blockId, input: { timeZone }, sessionId }),
  );

  if (error) {
    logError("[finishStudyBlockAction] Failed to finish a block:", error);
    return { status: "failed" };
  }

  if (result.status !== "ready") {
    return { status: "failed" };
  }

  return { moment: serializeStudyBlockCompletion(result.completion), status: "finished" };
}

export async function stopStudySessionAction(input: SessionInput): Promise<boolean> {
  const parsed = sessionInputSchema.safeParse(input);

  if (!parsed.success) {
    return false;
  }

  const { data: result, error } = await safeAsync(() =>
    stopStudySession({
      input: { timeZone: parsed.data.timeZone },
      sessionId: parsed.data.sessionId,
    }),
  );

  if (error) {
    logError("[stopStudySessionAction] Failed to stop the session:", error);
    return false;
  }

  return result.status === "ready";
}

export async function addExtraStudyBlockAction(
  input: SessionInput,
): Promise<StudyBlockOpening | null> {
  const parsed = sessionInputSchema.safeParse(input);

  if (!parsed.success) {
    return null;
  }

  const { data: result, error } = await safeAsync(async () => {
    const added = await addExtraStudyBlock({ sessionId: parsed.data.sessionId });

    return added.status === "ready"
      ? openStudyBlock({
          target: { blockId: added.block.id, kind: "block" },
          timeZone: parsed.data.timeZone,
        })
      : null;
  });

  if (error) {
    logError("[addExtraStudyBlockAction] Failed to add extra time:", error);
    return null;
  }

  return result?.status === "ready" ? result.opening : null;
}

export async function catchUpTodayAction(input: SessionInput): Promise<boolean> {
  const parsed = sessionInputSchema.safeParse(input);

  if (!parsed.success) {
    return false;
  }

  const { data: result, error } = await safeAsync(() =>
    catchUpToday({ input: { timeZone: parsed.data.timeZone }, sessionId: parsed.data.sessionId }),
  );

  if (error) {
    logError("[catchUpTodayAction] Failed to catch up today:", error);
    return false;
  }

  return result.status === "ready";
}

/** Awaits the API so the next read already says the lessons are coming. */
export async function prepareTodayLessonsAction(input: { goalId: string }): Promise<boolean> {
  const parsed = z.object({ goalId: z.uuid() }).safeParse(input);

  if (!parsed.success) {
    return false;
  }

  const response = await postAsLearner({
    path: `/v1/goals/${encodeURIComponent(parsed.data.goalId)}/lesson-preparations`,
  });

  return response.ok;
}

const insightAnswerSchema = z.object({
  insightId: z.uuid(),
  status: z.enum(["accepted", "dismissed"]),
});

export async function answerMemoryInsightAction(input: {
  insightId: string;
  status: "accepted" | "dismissed";
}): Promise<boolean> {
  const parsed = insightAnswerSchema.safeParse(input);

  if (!parsed.success) {
    return false;
  }

  const { data: result, error } = await safeAsync(() =>
    respondToMemoryInsight({
      input: { status: parsed.data.status },
      insightId: parsed.data.insightId,
    }),
  );

  if (error) {
    logError("[answerMemoryInsightAction] Failed to answer an insight:", error);
    return false;
  }

  return result.status === "updated";
}
