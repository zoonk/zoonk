import { examDocumentSchema } from "@zoonk/core/exams/document";
import { GoalKind, ResearchUploadReason } from "@zoonk/db";
import { z } from "zod";

export const uploadRequestSchema = z.object({
  examDocument: examDocumentSchema,
  goalId: z.uuid(),
  goalKind: z.enum(GoalKind),
  language: z
    .string()
    .meta({ description: "The goal's language, to send with uploads as `language`" }),
  reason: z
    .enum(ResearchUploadReason)
    .meta({
      description:
        "`noOfficialSource`: research found no official notice or source. `unverified`: what it found didn't match what it read. `classMaterial`: a teacher's test that only the class's material describes",
    }),
});
