import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { type StudyBlockView } from "./_utils/session-view";
import { studyBlockSchema } from "./block-view-contract";
import { openStudyBlockInputSchema } from "./open-block-contract";
import { type SessionMinutes, sessionMinutesSchema } from "./session-minutes";

const countSchema = z.number().int().nonnegative();

const studyDayProgressSchema = z
  .object({
    catchUp: z
      .object({
        doneToday: countSchema.meta({
          description:
            "Carried lessons completed since the session's learner-local day began. A lesson the learner tested out of leaves `lessonsLeft` without counting here.",
        }),
        lessonsLeft: countSchema.meta({
          description:
            "Carried lessons still to do: the number Today shows as lessons to catch up.",
        }),
      })
      .nullable()
      .meta({
        description:
          "The lessons earlier days left (the plan's latest missed-days change, the same lessons Today counts as behind), for a small line under the block's facts. Static: it holds what the completion read, so never count it down on the client. Null when nothing is carried, on a welcome-back session, or when none are left and none were caught up today. `lessonsLeft` 0 with `doneToday` above 0 means every carried lesson is done.",
      }),
    lead: z
      .enum(["done", "left", "open", "complete"])
      .meta({
        description:
          "Which count leads the day's line: `done` shows `sessionBar.completed` of `sessionBar.total` while the blocks done are no more than the blocks left (the midpoint included); `left` shows the blocks left once past the midpoint, with the done count as its caption; `open` shows only the blocks done, because the day holds time for lessons not on the queue yet and has no honest total; `complete` once the session is complete.",
      }),
    lessonsComing: z
      .boolean()
      .meta({
        description:
          "On `open`, whether the held lessons are being written now and join the queue on their own, so the line can say more are coming. False when they wait for the learner to ask for them, and outside `open`.",
      }),
    percent: z
      .number()
      .int()
      .min(0)
      .max(100)
      .nullable()
      .meta({
        description:
          "The share of the day's counted blocks done (`sessionBar`), floored: 0–99 until the session is complete and 100 only on `complete`. Null on `open` and when no block counts. Its meter draws one equal segment per counted block, so bar, count and percent agree.",
      }),
  })
  .meta({
    description:
      "Today's session progress for a block's end screen, decided in core so every client says the same thing.",
    id: "StudyDayProgress",
  });

export type StudyDayProgress = z.infer<typeof studyDayProgressSchema>;

export type StudyCompletionQueue = {
  blocks: StudyBlockView[];
  dayProgress: StudyDayProgress;
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
  dayProgress: studyDayProgressSchema,
  deferredLessonsCount: countSchema.meta({
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
