import { z } from "zod";

export const studyReminderUnsubscribeQuerySchema = z
  .object({ token: z.string().min(1).meta({ description: "The token from the reminder email" }) })
  .meta({ id: "StudyReminderUnsubscribeQuery" });

export const studyReminderUnsubscribeResponseSchema = z
  .object({ emailOn: z.literal(false) })
  .meta({ id: "StudyReminderUnsubscribeResponse" });
