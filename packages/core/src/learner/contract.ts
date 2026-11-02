import { isValidTimeZone } from "@zoonk/utils/time-zone";
import { z } from "zod";

/** An hour covers a slow typed answer; anything longer is a tab left open, not answering time. */
export const MAX_ANSWER_DURATION_MS = 3_600_000;

/** Clamp idle time instead of rejecting an otherwise valid answer. */
export const answerDurationSchema = z
  .number()
  .int()
  .min(0)
  .overwrite((durationMs) => Math.min(durationMs, MAX_ANSWER_DURATION_MS))
  .meta({
    description:
      "Milliseconds from showing the question to the answer; anything over an hour counts as an hour",
  });

const MAX_PICKS = 8;

/** dontKnow is welcome in placement and never counts as a guess. */
export const choiceAnswerSchema = z
  .union([
    z.object({ selectedIndex: z.number().int().min(0) }).strict(),
    z
      .object({
        selectedIndexes: z
          .array(z.number().int().min(0))
          .min(1)
          .max(MAX_PICKS)
          .meta({ description: "The options picked, in any order, as indexes into `options`" }),
      })
      .strict(),
    z.object({ isTrue: z.boolean() }).strict(),
    z.object({ dontKnow: z.literal(true) }).strict(),
  ])
  .meta({ id: "ChoiceAnswer" });

export type ChoiceAnswer = z.infer<typeof choiceAnswerSchema>;

export const itemAnswerInputSchema = z
  .object({ answer: choiceAnswerSchema, durationMs: answerDurationSchema, itemId: z.uuid() })
  .strict()
  .meta({ id: "ItemAnswerInput" });

export type ItemAnswerInput = z.infer<typeof itemAnswerInputSchema>;

/** The request zone is used only when the goal has no stored zone. */
export const answerTimeZoneSchema = z
  .string()
  .refine(isValidTimeZone, { message: "Invalid timezone" })
  .optional()
  .meta({
    description:
      "The device's IANA timezone. The learner's day follows the goal's stored timezone; this one is used only when the goal has none, then UTC",
  });

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
