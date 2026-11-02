import { z } from "zod";
import { answerTimeZoneSchema } from "../learner/contract";
import { lessonRunIdSchema } from "./_utils/lesson-run-id";

const MAX_SKIPPED_WRITING_STEPS = 200;

export const libraryLessonCompletionInputSchema = z
  .object({
    runId: lessonRunIdSchema,
    skippedWritingStepIds: z
      .array(z.uuid())
      .max(MAX_SKIPPED_WRITING_STEPS)
      .optional()
      .meta({
        description:
          'Typed-answer screens skipped in this run with "I don\'t know yet" or "Can\'t write now", in any lesson. Recorded on completion without grading or an answer verdict; does not skip other screens or future runs',
      }),
    timeZone: answerTimeZoneSchema,
  })
  .strict()
  .meta({ id: "LibraryLessonCompletionInput" });

export type LibraryLessonCompletionInput = z.infer<typeof libraryLessonCompletionInputSchema>;
