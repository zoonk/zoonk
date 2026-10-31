import { z } from "zod";
import { answerTimeZoneSchema } from "../../learner/contract";

const MAX_NAME_LENGTH = 300;

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

export const examChoiceInputSchema = examChoicePickSchema
  .extend({ timeZone: answerTimeZoneSchema })
  .strict()
  .meta({ id: "ExamChoiceInput" });

export type ExamChoiceInput = z.infer<typeof examChoiceInputSchema>;

export const examChoiceViewSchema = z
  .object({
    group: z.string(),
    leftOut: z
      .object({
        examPoints: z.number().int().nullable(),
        examQuestions: z.number().int().nullable(),
        name: z.string(),
        points: z.number().int().nullable(),
        questions: z.number().int().nullable(),
      })
      .meta({
        description:
          "What the plan and mocks leave out while nothing is picked: `name` is the test the options make up (a specialty's own test), or the choice itself. `points` and `questions` are what an option is worth and how many questions it has; `examPoints` and `examQuestions` the whole exam's with one option. Each is null when the notice doesn't say",
      }),
    options: z.array(z.object({ name: z.string(), shortName: z.string().nullable() })),
    subject: z.string().nullable(),
  })
  .meta({ id: "ExamChoice" });

export type ExamChoiceView = z.infer<typeof examChoiceViewSchema>;
