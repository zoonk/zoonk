"use server";

import { postAsLearner } from "@/lib/api/learner-api";
import { getLessonGenerationState } from "@zoonk/core/library/generation/state";
import { respondToMemoryInsight } from "@zoonk/core/memory/insights/respond";
import { catchUpToday } from "@zoonk/core/sessions/catch-up";
import { serializeStudyBlockCompletion } from "@zoonk/core/sessions/completion-contract";
import { addExtraStudyBlock } from "@zoonk/core/sessions/extra-block";
import { finishStudyBlock } from "@zoonk/core/sessions/finish-block";
import { openStudySession } from "@zoonk/core/sessions/open";
import { getSessionPageView } from "@zoonk/core/sessions/page";
import { saveDayForMission } from "@zoonk/core/sessions/save-for-mission";
import { startStudyBlock } from "@zoonk/core/sessions/start-block";
import { stopStudySession } from "@zoonk/core/sessions/stop";
import { type StudyBlock, type StudyFinishOutcome } from "@zoonk/learn/session/types";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { isValidTimeZone } from "@zoonk/utils/time-zone";
import { z } from "zod";
import { openStudyBlock } from "./open-study-block";
import { prepareStudySession } from "./session-preparation";
import { type StudyDestination } from "./study-destination";

const sessionInputSchema = z.object({
  sessionId: z.uuid(),
  timeZone: z.string().refine(isValidTimeZone),
});

const blockInputSchema = sessionInputSchema.extend({ blockId: z.uuid() });

const nextInputSchema = sessionInputSchema.extend({ expectedBlockId: z.uuid().optional() });

const missionInputSchema = z.object({
  blockId: z.uuid(),
  timeZone: z.string().refine(isValidTimeZone),
});

const missionDayInputSchema = z.object({
  goalId: z.uuid(),
  timeZone: z.string().refine(isValidTimeZone),
});

type SessionInput = z.infer<typeof sessionInputSchema>;
type BlockInput = z.infer<typeof blockInputSchema>;

/** Start never begins a mock the learner didn't see. */
function isChangedMock({
  blocks,
  expectedBlockId,
  next,
}: {
  blocks: readonly StudyBlock[];
  expectedBlockId: string | undefined;
  next: StudyBlock | undefined;
}): boolean {
  if (!expectedBlockId || next?.id === expectedBlockId) {
    return false;
  }

  const shown = blocks.find((block) => block.id === expectedBlockId);
  return Boolean(next?.checkpoint?.mock || shown?.checkpoint?.mock);
}

export async function openNextStudyBlockAction(
  input: z.infer<typeof nextInputSchema>,
): Promise<StudyDestination | null> {
  const parsed = nextInputSchema.safeParse(input);

  if (!parsed.success) {
    return null;
  }

  const { data: result, error } = await safeAsync(async () => {
    const session = await openStudySession({
      input: { timeZone: parsed.data.timeZone },
      sessionId: parsed.data.sessionId,
    });

    if (session.status !== "ready") {
      return null;
    }

    if (!session.session.current) {
      return { kind: "today" } satisfies StudyDestination;
    }

    const { blocks, nextBlockId } = session.session;
    const { expectedBlockId, sessionId, timeZone } = parsed.data;
    const next = blocks.find((block) => block.id === nextBlockId);

    if (isChangedMock({ blocks, expectedBlockId, next })) {
      return { kind: "changed" } satisfies StudyDestination;
    }

    return next
      ? openStudyBlock({ block: next, sessionId, timeZone })
      : ({ kind: "session" } satisfies StudyDestination);
  });

  if (error) {
    logError("[openNextStudyBlockAction] Failed to open the next block:", error);
    return null;
  }

  return result;
}

export async function openStudyBlockAction(input: BlockInput): Promise<StudyDestination | null> {
  const parsed = blockInputSchema.safeParse(input);

  if (!parsed.success) {
    return null;
  }

  const { blockId, sessionId, timeZone } = parsed.data;

  const { data: result, error } = await safeAsync(async () => {
    const session = await openStudySession({ input: { timeZone }, sessionId });

    const block =
      session.status === "ready"
        ? session.session.blocks.find((candidate) => candidate.id === blockId)
        : undefined;

    return block ? openStudyBlock({ block, sessionId, timeZone }) : null;
  });

  if (error) {
    logError("[openStudyBlockAction] Failed to open a block:", error);
    return null;
  }

  return result;
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

/** Null for a block no longer free to start, so the host reads the day again. */
export async function openMissionAction(
  input: z.infer<typeof missionInputSchema>,
): Promise<StudyDestination | null> {
  const parsed = missionInputSchema.safeParse(input);

  if (!parsed.success) {
    return null;
  }

  const { blockId, timeZone } = parsed.data;

  const { data: result, error } = await safeAsync(async () => {
    const day = await getSessionPageView({ blockId });

    if (day.status !== "ready") {
      return null;
    }

    const { session } = day;

    const block = session.blocks.find(
      (candidate) =>
        candidate.id === blockId &&
        (candidate.status === "pending" || candidate.status === "active") &&
        candidate.waitReason === null,
    );

    if (!block) {
      return null;
    }

    const destination = await openStudyBlock({ block, sessionId: session.id, timeZone });

    return destination?.kind === "session" && !destination.blockId ? null : destination;
  });

  if (error) {
    logError("[openMissionAction] Failed to open a mission:", error);
    return null;
  }

  return result;
}

/** A wait becoming ready only opens what was written; it never requests more AI work. */
export async function openWrittenLessonAction(input: BlockInput): Promise<StudyDestination | null> {
  const parsed = blockInputSchema.safeParse(input);

  if (!parsed.success) {
    return null;
  }

  const { data: result, error } = await safeAsync(async () => {
    const { blockId, sessionId, timeZone } = parsed.data;
    const session = await openStudySession({ input: { timeZone }, sessionId });

    const block =
      session.status === "ready"
        ? session.session.blocks.find((candidate) => candidate.id === blockId)
        : null;

    if (block?.kind !== "learn" || !block.lessonId) {
      return null;
    }

    const state = await getLessonGenerationState(block.lessonId);

    if (state?.status !== "ready") {
      return null;
    }

    const started = await startStudyBlock({ blockId, input: { timeZone }, sessionId });

    return started.status === "ready"
      ? ({ kind: "lesson", lessonId: block.lessonId, sessionId } satisfies StudyDestination)
      : null;
  });

  if (error) {
    logError("[openWrittenLessonAction] Failed to open the written lesson:", error);
    return null;
  }

  return result;
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

  if (result.completion.sessionCompleted) {
    prepareStudySession(sessionId);
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

  if (result.status !== "ready") {
    return false;
  }

  prepareStudySession(parsed.data.sessionId);

  return true;
}

export async function addExtraStudyBlockAction(
  input: SessionInput,
): Promise<StudyDestination | null> {
  const parsed = sessionInputSchema.safeParse(input);

  if (!parsed.success) {
    return null;
  }

  const { data: result, error } = await safeAsync(async () => {
    const added = await addExtraStudyBlock({ sessionId: parsed.data.sessionId });
    return added.status === "ready" ? openStudyBlock({ block: added.block, ...parsed.data }) : null;
  });

  if (error) {
    logError("[addExtraStudyBlockAction] Failed to add extra time:", error);
    return null;
  }

  return result;
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
