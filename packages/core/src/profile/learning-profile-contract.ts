import { BuddyGlasses, BuddyKind } from "@zoonk/db";
import { z } from "zod";
import { BUDDY_NAME_MAX_LENGTH } from "./buddy-name-limit";
import { MAX_DAILY_LIMIT_MINUTES, MIN_DAILY_LIMIT_MINUTES } from "./daily-limit";
import { type ResolvedBuddy } from "./default-buddy";

export const learningBuddySchema = z
  .object({
    glasses: z.enum(BuddyGlasses).meta({ description: "The buddy's glasses" }),
    kind: z.enum(BuddyKind).meta({ description: "Which buddy" }),
    name: z.string().nullable().meta({ description: "Custom name, or null for the buddy's own" }),
    picked: z.boolean().meta({ description: "True when the learner saved a buddy choice" }),
  })
  .meta({ description: "The chosen buddy, or Zu with round glasses by default", id: "Buddy" });

const buddyInputSchema = z
  .object({
    glasses: z
      .enum(BuddyGlasses)
      .optional()
      .meta({ description: "Round comes with the buddy; the others must be earned first" }),
    kind: z.enum(BuddyKind).meta({ description: "Which buddy" }),
    name: z
      .string()
      .trim()
      .min(1)
      .max(BUDDY_NAME_MAX_LENGTH)
      .nullable()
      .optional()
      .meta({ description: "A custom name, or null to use the buddy's own name" }),
  })
  .strict()
  .meta({ id: "BuddyInput" });

function hasProfileField(input: Record<string, unknown>) {
  return Object.values(input).some((value) => value !== undefined);
}

/** Omitted fields preserve current settings, allowing independent screen updates. */
export const learningProfileUpdateSchema = z
  .object({
    activeGoalId: z
      .uuid()
      .nullable()
      .optional()
      .meta({ description: "The goal the tabs show, or null for none" }),
    buddy: buddyInputSchema
      .nullable()
      .optional()
      .meta({ description: "The learner's buddy choice, or null to return to the default buddy" }),
    dailyLimitMinutes: z
      .int()
      .min(MIN_DAILY_LIMIT_MINUTES)
      .max(MAX_DAILY_LIMIT_MINUTES)
      .nullable()
      .optional()
      .meta({ description: "The learner's daily study limit in minutes, or null for no limit" }),
    soundsEnabled: z
      .boolean()
      .optional()
      .meta({ description: "Sounds for a right answer and for finishing" }),
  })
  .strict()
  .refine(hasProfileField, { message: "At least one profile field must be provided" })
  .meta({ id: "LearningProfileUpdate", override: { minProperties: 1 } });

export type LearningProfileUpdateInput = z.infer<typeof learningProfileUpdateSchema>;

export type LearningProfileView = {
  activeGoalId: string | null;
  availableGlasses: BuddyGlasses[];
  /** The learner's own daily study limit in minutes, or null for none. */
  dailyLimitMinutes: number | null;
  buddy: ResolvedBuddy;
  soundsEnabled: boolean;
};
