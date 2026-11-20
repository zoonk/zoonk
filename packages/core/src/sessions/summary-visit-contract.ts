import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";

export const studySessionSummaryVisitInputSchema = z
  .object({
    visitId: uuidSchema().meta({
      description: "A unique visit ID, reused on retries of that visit",
    }),
  })
  .strict()
  .meta({ id: "StudySessionSummaryVisitInput" });

export type StudySessionSummaryVisitInput = z.infer<typeof studySessionSummaryVisitInputSchema>;

export const studySessionSummaryVisitSchema = z
  .object({
    first: z
      .boolean()
      .meta({
        description: "This visit recorded the first summary visit for the session's local day",
      }),
  })
  .strict()
  .meta({ id: "StudySessionSummaryVisit" });
