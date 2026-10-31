import { learningBuddySchema } from "@zoonk/core/profile/contract";
import { BuddyGlasses } from "@zoonk/db";
import { z } from "zod";

export const learningProfileSchema = z
  .object({
    activeGoalId: z.uuid().nullable().meta({ description: "The goal the tabs show" }),
    availableGlasses: z
      .array(z.enum(BuddyGlasses))
      .meta({ description: "Glasses the buddy can wear: round plus the earned ones" }),
    buddy: learningBuddySchema,
    dailyLimitMinutes: z
      .int()
      .nullable()
      .meta({ description: "The learner's own daily study limit in minutes, or null" }),
    dailyTimes: z
      .array(z.int())
      .meta({
        description:
          "The daily limits to offer, in minutes: the same times a plan's day offers. Show a saved limit that isn't one of them too",
      }),
    shareUsageData: z
      .boolean()
      .nullable()
      .meta({
        description:
          "Whether Zoonk may record how the learner uses it, or null before they choose. Their events are recorded unless it's false",
      }),
    soundsEnabled: z
      .boolean()
      .meta({ description: "Sounds for a right answer and for finishing; on by default" }),
  })
  .meta({ id: "LearningProfile" });

export const learningProfileResponseSchema = z
  .object({ profile: learningProfileSchema })
  .meta({ id: "LearningProfileResponse" });
