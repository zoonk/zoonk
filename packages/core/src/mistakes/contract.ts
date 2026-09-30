import { type MistakeCause, type MistakeStatus } from "@zoonk/db";
import { z } from "zod";
import { answerTimeZoneSchema, itemAnswerInputSchema } from "../learner/contract";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export const mistakeListInputSchema = z
  .object({
    cause: z.enum(["gap", "misread", "trap", "time", "guess"] satisfies MistakeCause[]).optional(),
    goalId: z.uuid().optional().meta({ description: "Only mistakes on this goal's skills" }),
    limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
    offset: z.coerce.number().int().min(0).default(0),
    skillId: z.uuid().optional(),
    status: z.enum(["open", "fixed"] satisfies MistakeStatus[]).optional(),
  })
  .strict();

export type MistakeListInput = z.infer<typeof mistakeListInputSchema>;

export const mistakePracticeInputSchema = z
  .object({
    goalId: z.uuid().optional().meta({ description: "Only mistakes on this goal's skills" }),
    timeZone: answerTimeZoneSchema,
  })
  .strict();

export type MistakePracticeInput = z.infer<typeof mistakePracticeInputSchema>;

export const mistakePracticeAnswerInputSchema = itemAnswerInputSchema
  .extend({ timeZone: answerTimeZoneSchema })
  .strict()
  .meta({ id: "MistakePracticeAnswerInput" });

export type MistakePracticeAnswerInput = z.infer<typeof mistakePracticeAnswerInputSchema>;

/** More answers than one run can hold; a run asks at most a few questions per mistake. */
const MAX_PRACTICE_ANSWERS = 50;

export const mistakePracticeFinishInputSchema = z
  .object({
    answerIds: z
      .array(z.uuid())
      .min(1)
      .max(MAX_PRACTICE_ANSWERS)
      .meta({
        description:
          "Every answer given in the run so far, as their answers returned them. Finish after each answer so a run left halfway still counts; each finish adds only the new answers to the same run",
      }),
    ended: z
      .boolean()
      .optional()
      .meta({ description: "True once, when the learner reached the end or stopped early" }),
    goalId: z.uuid().optional().meta({ description: "The goal the run practiced, when scoped" }),
    timeZone: answerTimeZoneSchema,
  })
  .strict()
  .meta({ id: "MistakePracticeFinishInput" });

export type MistakePracticeFinishInput = z.infer<typeof mistakePracticeFinishInputSchema>;
