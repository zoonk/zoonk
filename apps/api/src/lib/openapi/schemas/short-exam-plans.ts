import { SHORT_EXAM_FOCUSES } from "@zoonk/core/plans/view-contract";
import { z } from "zod";
import { logicalDateSchema } from "./study-sessions";

const isoDateSchema = z.iso.date();

/** A test at most a week away is planned day by day; these say which day and what it's for. */
const shortExamFocusSchema = z
  .enum(SHORT_EXAM_FOCUSES)
  .meta({
    description:
      "What a day of a plan for a test days away is for: the exam map and gaps, practice, a class test's short mock with a review of what it finds, or a public exam's light review",
    id: "ShortExamFocus",
  });

const MAX_SHORT_PLAN_DAYS = 7;

const mockDateDescription = "The short mock's day; null when the last day is a light review";

export const shortPhaseSchema = z
  .object({ firstDay: z.int().min(1), focus: shortExamFocusSchema, lastDay: z.int().min(1) })
  .nullable()
  .meta({
    description:
      "The study days the phase covers in a plan for a test days away (Days 1 to 4) and what they're for; null in any other plan",
  });

export const shortPlanSchema = z
  .object({
    days: z.int().min(1).max(MAX_SHORT_PLAN_DAYS),
    mockDate: isoDateSchema.nullable().meta({ description: mockDateDescription }),
  })
  .nullable()
  .meta({
    description:
      "A test at most a week away, planned day by day: its study days and the day of its short mock; null for any other plan",
  });

export const todayShortPlanSchema = z
  .object({
    day: z.int().min(1).max(MAX_SHORT_PLAN_DAYS),
    days: z.int().min(1).max(MAX_SHORT_PLAN_DAYS),
    focus: shortExamFocusSchema,
    mockDate: logicalDateSchema.nullable().meta({ description: mockDateDescription }),
  })
  .nullable()
  .meta({
    description:
      "A test days away, planned day by day: which day today is (Day 1 of 3), what it's for, and the day of its short mock; null for any other plan",
  });
