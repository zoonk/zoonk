import { z } from "zod";
import { answerTimeZoneSchema } from "../../learner/contract";

const MAX_NAME_LENGTH = 300;

/** The option a learner takes for one of their exam's choices, as their plan keeps it. */
export const examChoicePickSchema = z
  .object({
    group: z
      .string()
      .trim()
      .min(1)
      .max(MAX_NAME_LENGTH)
      .meta({ description: "The notice's name for the choice group, such as Foreign language" }),
    subject: z
      .string()
      .trim()
      .min(1)
      .max(MAX_NAME_LENGTH)
      .meta({ description: "The option the learner takes: one of the choice's subjects, by name" }),
  })
  .strict()
  .meta({ id: "ExamChoicePick" });

/** A pick from the plan, which re-plans from today in the learner's time zone. */
export const examChoiceInputSchema = examChoicePickSchema
  .extend({ timeZone: answerTimeZoneSchema })
  .strict()
  .meta({ id: "ExamChoiceInput" });

export type ExamChoiceInput = z.infer<typeof examChoiceInputSchema>;

/**
 * One of the exam's choices as the learner sees it: its options (each a subject of the notice, by
 * its name and what learners call it) and the one they take, null until they pick.
 */
export const examChoiceViewSchema = z
  .object({
    group: z.string(),
    options: z.array(z.object({ name: z.string(), shortName: z.string().nullable() })),
    subject: z.string().nullable(),
  })
  .meta({ id: "ExamChoice" });

export type ExamChoiceView = z.infer<typeof examChoiceViewSchema>;
