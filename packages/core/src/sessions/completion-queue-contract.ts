import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { type StudyBlockView } from "./_utils/session-view";
import { studyBlockSchema } from "./block-view-contract";
import { openStudyBlockInputSchema } from "./open-block-contract";
import { type SessionMinutes, sessionMinutesSchema } from "./session-minutes";

export type StudyCompletionQueue = {
  blocks: StudyBlockView[];
  minutes: SessionMinutes;
  deferredLessonsCount: number;
  sessionId: string;
  goalId: string | null;
  finishedChapterId: string | null;
  next: {
    block: StudyBlockView;
    target: { blockId: string; kind: "block" };
    opensInPlayer: boolean;
  } | null;
};

export const studyCompletionQueueShape = {
  blocks: z
    .array(studyBlockSchema)
    .meta({
      description:
        "The authoritative queue after completion. A completion may shorten or extend its unstarted lesson tail to fit today's time.",
    }),
  deferredLessonsCount: z
    .number()
    .int()
    .nonnegative()
    .meta({
      description:
        "Lessons moved from the unstarted tail to a later study day by this completion. Persisted with the completion and replayed on retries; show a quiet completion-screen notice only when positive.",
    }),
  finishedChapterId: uuidSchema().nullable(),
  goalId: uuidSchema().nullable(),
  minutes: sessionMinutesSchema,
  next: z
    .object({
      block: studyBlockSchema,
      opensInPlayer: z.boolean(),
      target: openStudyBlockInputSchema.shape.target.options[1],
    })
    .nullable(),
  sessionId: uuidSchema(),
};
