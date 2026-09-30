import { z } from "zod";
import { answerTimeZoneSchema } from "../learner/contract";

export const weeklyRecapInputSchema = z
  .object({
    goalId: z
      .uuid()
      .optional()
      .meta({ description: "Adds the goal's phases finished that week and next week's focus" }),
    timeZone: answerTimeZoneSchema,
    weekStart: z.iso
      .date()
      .optional()
      .meta({ description: "Any date of the week to recap; defaults to the current week" }),
  })
  .strict()
  .meta({ id: "WeeklyRecapQuery" });

export type WeeklyRecapInput = z.infer<typeof weeklyRecapInputSchema>;

export const buddyStatusInputSchema = z
  .object({ timeZone: answerTimeZoneSchema })
  .strict()
  .meta({ id: "BuddyStatusQuery" });

export type BuddyStatusInput = z.infer<typeof buddyStatusInputSchema>;
