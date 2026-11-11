import "server-only";
import { isUuid } from "@zoonk/utils/uuid";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { getBlockElapsedMs, pausedBlockTiming } from "../sessions/_utils/block-timing";
import { readBlockPayload } from "../sessions/block-payload";
import { getSession } from "../users/get-session";
import { findLessonRun, getRunStudySessionId } from "./_utils/lesson-runs";
import { type LessonClockInput, lessonClockInputSchema } from "./lesson-clock-contract";

export type LessonClockOutcome = { status: "updated" | "ignored" | "unauthorized" | "notFound" };

/** Authorizes the run; stale, replayed and superseded clock transitions change nothing. */
export async function updateLessonClock({
  input: requestInput,
  lessonId,
}: {
  input: LessonClockInput;
  lessonId: string;
}): Promise<LessonClockOutcome> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const parsed = lessonClockInputSchema.safeParse(requestInput);

  if (!isUuid(lessonId) || !parsed.success) {
    return { status: "notFound" };
  }

  const input = parsed.data;
  const userId = session.user.id;
  const run = await findLessonRun({ lessonId, runId: input.runId, userId });

  if (!run) {
    return { status: "notFound" };
  }

  const sessionId = getRunStudySessionId(run);

  if (!sessionId || run.endedAt) {
    return { status: "ignored" };
  }

  return writeLearnerChange({ userId }, async (tx) => {
    const found = await tx.studySessionBlock.findFirst({
      where: {
        kind: "learn",
        lessonId,
        payload: { equals: input.clockId, path: ["timing", "clock", "id"] },
        session: { userId },
        sessionId,
        status: "active",
      },
    });

    if (!found) {
      return unchanged({ status: "ignored" as const });
    }

    await tx.$queryRaw`SELECT id FROM study_session_blocks WHERE id = ${found.id}::uuid FOR UPDATE`;
    const block = await tx.studySessionBlock.findUniqueOrThrow({ where: { id: found.id } });
    const timing = readBlockPayload(block).timing;
    const clock = timing?.clock;

    if (!timing || !clock || clock.runId !== run.id || input.sequence <= clock.sequence) {
      return unchanged({ status: "ignored" as const });
    }

    const now = new Date();

    await tx.studySessionBlock.update({
      data: {
        payload: {
          ...readBlockPayload(block),
          timing: {
            ...(input.state === "paused"
              ? pausedBlockTiming({ block, now })
              : {
                  ...timing,
                  activeAt: now.toISOString(),
                  elapsedMs: getBlockElapsedMs({ block, now }),
                }),
            clock: { ...clock, sequence: input.sequence },
          },
        },
      },
      where: { id: block.id },
    });

    return { status: "updated" as const };
  });
}
