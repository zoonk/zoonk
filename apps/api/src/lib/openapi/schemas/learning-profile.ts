import { BuddyGlasses, BuddyKind } from "@zoonk/db";
import { z } from "zod";

const buddySchema = z
  .object({
    glasses: z.enum(BuddyGlasses).meta({ description: "The buddy's glasses" }),
    kind: z.enum(BuddyKind).meta({ description: "Which buddy" }),
    name: z.string().nullable().meta({ description: "Custom name, or null for the buddy's own" }),
  })
  .meta({ id: "Buddy" });

export const learningProfileSchema = z
  .object({
    activeGoalId: z.uuid().nullable().meta({ description: "The goal the tabs show" }),
    availableGlasses: z
      .array(z.enum(BuddyGlasses))
      .meta({ description: "Glasses the buddy can wear: round plus the earned ones" }),
    buddy: buddySchema.nullable().meta({ description: "The learner's buddy, or null" }),
    dailyLimitMinutes: z
      .int()
      .nullable()
      .meta({ description: "The learner's own daily study limit in minutes, or null" }),
    soundsEnabled: z
      .boolean()
      .meta({ description: "Sounds for a right answer and for finishing; on by default" }),
  })
  .meta({ id: "LearningProfile" });

export const learningProfileResponseSchema = z
  .object({ profile: learningProfileSchema })
  .meta({ id: "LearningProfileResponse" });
