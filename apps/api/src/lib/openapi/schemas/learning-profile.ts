import { learningBuddySchema } from "@zoonk/core/profile/contract";
import { BuddyGlasses } from "@zoonk/db";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";

export const learningProfileSchema = z
  .object({
    activeGoalId: uuidSchema().nullable().meta({ description: "The goal the tabs show" }),
    availableGlasses: z
      .array(z.enum(BuddyGlasses))
      .meta({ description: "Glasses the buddy can wear: round plus the earned ones" }),
    buddy: learningBuddySchema,
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
