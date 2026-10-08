"use server";

import { respondToMemoryInsight } from "@zoonk/core/memory/insights/respond";
import { answerStudyQuestion } from "@zoonk/core/sessions/answer";
import { catchUpToday } from "@zoonk/core/sessions/catch-up";
import { serializeStudyBlockCompletion } from "@zoonk/core/sessions/completion-contract";
import { studyAnswerInputSchema } from "@zoonk/core/sessions/contract";
import { addExtraStudyBlock } from "@zoonk/core/sessions/extra-block";
import { finishStudyBlock } from "@zoonk/core/sessions/finish-block";
import { getStudySession } from "@zoonk/core/sessions/get";
import { stopStudySession } from "@zoonk/core/sessions/stop";
import {
  type StudyAnswerOutcome,
  type StudyFinishOutcome,
  type StudyQuestionAnswer,
} from "@zoonk/learn/session/types";
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

type SessionInput = z.infer<typeof sessionInputSchema>;
type BlockInput = z.infer<typeof blockInputSchema>;

/**
 * Opens the next block of today's session ("Continue", "Take off", the moment after a block):
 * starts it and says where it's played, or the session screen for the summary once nothing is
 * left. An earlier day's session the learner has left (a lesson finished the next morning) goes on
 * with today's, on Today. Null when it couldn't be opened.
 */
export async function openNextStudyBlockAction(
  input: SessionInput,
): Promise<StudyDestination | null> {
  const parsed = sessionInputSchema.safeParse(input);

  if (!parsed.success) {
    return null;
  }

  const { data: result, error } = await safeAsync(async () => {
    const session = await getStudySession({
      input: { timeZone: parsed.data.timeZone },
      sessionId: parsed.data.sessionId,
    });

    if (session.status !== "ready") {
      return null;
    }

    if (!session.session.current) {
      return { kind: "today" } satisfies StudyDestination;
    }

    const next = session.session.blocks.find((block) => block.id === session.session.nextBlockId);

    return next
      ? openStudyBlock({ block: next, ...parsed.data })
      : ({ kind: "session" } satisfies StudyDestination);
  });

  if (error) {
    logError("[openNextStudyBlockAction] Failed to open the next block:", error);
    return null;
  }

  return result;
}

/** Opens one block the learner picked, such as a ready block while a lesson is written. */
export async function openStudyBlockAction(input: BlockInput): Promise<StudyDestination | null> {
  const parsed = blockInputSchema.safeParse(input);

  if (!parsed.success) {
    return null;
  }

  const { blockId, sessionId, timeZone } = parsed.data;

  const { data: result, error } = await safeAsync(async () => {
    const session = await getStudySession({ input: { timeZone }, sessionId });

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

/** One answer to a session question: the same core capability as `POST .../answers`. */
export async function answerStudyQuestionAction(
  input: BlockInput & { answer: StudyQuestionAnswer; durationMs: number; itemId: string },
): Promise<StudyAnswerOutcome> {
  const block = blockInputSchema.safeParse(input);

  const answer = studyAnswerInputSchema.safeParse({
    answer: input.answer,
    durationMs: input.durationMs,
    itemId: input.itemId,
    timeZone: input.timeZone,
  });

  if (!block.success || !answer.success) {
    return { status: "failed" };
  }

  const { data: result, error } = await safeAsync(() =>
    answerStudyQuestion({
      blockId: block.data.blockId,
      input: answer.data,
      sessionId: block.data.sessionId,
    }),
  );

  if (error) {
    logError("[answerStudyQuestionAction] Failed to answer a question:", error);
    return { status: "failed" };
  }

  if (result.status === "ready") {
    return { feedback: result.feedback, status: "answered" };
  }

  if (result.status === "slowDown" || result.status === "alreadyAnswered") {
    return result;
  }

  return { status: "failed" };
}

/** Finishes a question block and returns its moment: the same capability as `POST .../completions`. */
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

  // The session's end gets the next one ready, as `POST .../completions` does.
  if (result.completion.sessionCompleted) {
    prepareStudySession(sessionId);
  }

  return { moment: serializeStudyBlockCompletion(result.completion), status: "finished" };
}

/** "Stop for today": what was done counts and the rest waits, with no penalty. */
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

  // What's left waits for next time: the next session gets ready, as `POST .../stops` does.
  prepareStudySession(parsed.data.sessionId);

  return true;
}

/** "10 more minutes": adds the bonus block and opens it. Null when there's nothing to add. */
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

/**
 * "Catch up today": the lessons earlier days left that today's time didn't fit join today's
 * session. Resolves to whether they were added; Today reads itself again to show them.
 */
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

const insightAnswerSchema = z.object({
  insightId: z.uuid(),
  status: z.enum(["accepted", "dismissed"]),
});

/** Answers Today's insight: the same core capability as `PATCH /v1/me/memory/insights/{id}`. */
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
