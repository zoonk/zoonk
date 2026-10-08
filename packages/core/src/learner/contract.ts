import { isValidTimeZone } from "@zoonk/utils/time-zone";
import { z } from "zod";

/** An hour covers a slow typed answer; anything longer is a tab left open, not answering time. */
export const MAX_ANSWER_DURATION_MS = 3_600_000;

/**
 * How long the learner took to answer. A screen left open overnight still saves: idle time isn't
 * answering time, so anything past the limit counts as the limit instead of failing the answer.
 */
export const answerDurationSchema = z
  .number()
  .int()
  .min(0)
  .overwrite((durationMs) => Math.min(durationMs, MAX_ANSWER_DURATION_MS))
  .meta({
    description:
      "Milliseconds from showing the question to the answer; anything over an hour counts as an hour",
  });

/**
 * A choice question's answer: the option picked (multiple choice), true or false (a statement),
 * or "I don't know yet", which placement welcomes and which never counts as a guess.
 */
export const choiceAnswerSchema = z
  .union([
    z.object({ selectedIndex: z.number().int().min(0) }).strict(),
    z.object({ isTrue: z.boolean() }).strict(),
    z.object({ dontKnow: z.literal(true) }).strict(),
  ])
  .meta({ id: "ChoiceAnswer" });

export type ChoiceAnswer = z.infer<typeof choiceAnswerSchema>;

/** One answer to one bank question, as placement, test-outs and mistake practice receive it. */
export const itemAnswerInputSchema = z
  .object({ answer: choiceAnswerSchema, durationMs: answerDurationSchema, itemId: z.uuid() })
  .strict()
  .meta({ id: "ItemAnswerInput" });

export type ItemAnswerInput = z.infer<typeof itemAnswerInputSchema>;

/** The learner's IANA timezone, so answers land on their local day. */
export const answerTimeZoneSchema = z
  .string()
  .refine(isValidTimeZone, { message: "Invalid timezone" })
  .optional()
  .meta({ description: "Learner's IANA timezone; defaults to the goal's timezone, then UTC" });

export const skillListInputSchema = z
  .object({
    filter: z
      .enum(["all", "new", "learning", "solid", "mastered", "fading"])
      .optional()
      .meta({ description: "Mastered is the gold card; fading means memory is dropping" }),
    goalId: z.uuid().optional().meta({ description: "Only this goal's skills, New ones included" }),
  })
  .strict()
  .meta({ id: "SkillListQuery" });

export type SkillListInput = z.infer<typeof skillListInputSchema>;

export const reviewScheduleInputSchema = z
  .object({
    goalId: z
      .uuid()
      .optional()
      .meta({ description: "Only this goal's skills, capped by its daily time" }),
    timeZone: answerTimeZoneSchema,
  })
  .strict();

export type ReviewScheduleInput = z.infer<typeof reviewScheduleInputSchema>;

const skillCountSchema = z.int().min(0);

/** How many of a set of skills are in each mastery state, and how many are fading. */
export const skillStateCountsSchema = z
  .object({
    fading: skillCountSchema,
    learning: skillCountSchema,
    mastered: skillCountSchema,
    new: skillCountSchema,
    solid: skillCountSchema,
    total: skillCountSchema,
  })
  .meta({ id: "SkillStateCounts" });
