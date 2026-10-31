import { z } from "zod";
import { answerTimeZoneSchema } from "../../learner/contract";

const MAX_NAME_LENGTH = 300;
const MAX_PICKED_OPTIONS = 20;

export const examChoicePickSchema = z
  .object({
    group: z
      .string()
      .trim()
      .min(1)
      .max(MAX_NAME_LENGTH)
      .meta({ description: "The notice's name for the choice group, such as Foreign language" }),
    subjects: z
      .array(z.string().trim().min(1).max(MAX_NAME_LENGTH))
      .min(1)
      .max(MAX_PICKED_OPTIONS)
      .meta({
        description:
          "The options the learner takes, by name: from one to the choice's `take` of its subjects",
      }),
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
          "What the plan and mocks leave out while nothing is picked: `name` is the test the options make up (a specialty's own test), or the choice itself. `points` and `questions` are what the options a candidate takes are worth and how many questions they have; `examPoints` and `examQuestions` the whole exam's with them. Each is null when the notice doesn't say",
      }),
    options: z.array(z.object({ name: z.string(), shortName: z.string().nullable() })),
    subjects: z
      .array(z.string())
      .meta({
        description: "The options the learner picked, in the notice's order; empty while unpicked",
      }),
    take: z
      .number()
      .int()
      .min(1)
      .meta({
        description: "How many of the options each candidate takes; a pick has one to this many",
      }),
  })
  .meta({ id: "ExamChoice" });

export type ExamChoiceView = z.infer<typeof examChoiceViewSchema>;
