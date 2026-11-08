import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { type StudyBlockView } from "./_utils/session-view";
import { studyBlockSchema } from "./block-view-contract";
import { openStudyBlockInputSchema } from "./open-block-contract";

export type StudyCompletionQueue = {
  blocks: StudyBlockView[];
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
  blocks: z.array(studyBlockSchema),
  finishedChapterId: uuidSchema().nullable(),
  goalId: uuidSchema().nullable(),
  next: z
    .object({
      block: studyBlockSchema,
      opensInPlayer: z.boolean(),
      target: openStudyBlockInputSchema.shape.target.options[1],
    })
    .nullable(),
  sessionId: uuidSchema(),
};
