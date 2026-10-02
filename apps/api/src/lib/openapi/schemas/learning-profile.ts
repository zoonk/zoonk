import { experienceModeSchema } from "@zoonk/core/profile/contract";
import { BuddyGlasses, BuddyKind, MemoryCategory } from "@zoonk/db";
import { z } from "zod";

const ageGroupSchema = z
  .enum(["child", "teen", "adult", "unknown"])
  .meta({
    description: "Age group from the birth month and year; unknown until answered",
    id: "AgeGroup",
  });

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
    ageGroup: ageGroupSchema,
    availableGlasses: z
      .array(z.enum(BuddyGlasses))
      .meta({ description: "Glasses the buddy can wear: round plus the earned ones" }),
    birth: z
      .object({ month: z.int(), year: z.int() })
      .nullable()
      .meta({ description: "Birth month and year, or null until answered" }),
    buddy: buddySchema.nullable().meta({ description: "The Fun mode buddy, or null" }),
    dailyLimitMinutes: z
      .int()
      .nullable()
      .meta({ description: "The learner's own daily study limit in minutes, or null" }),
    deeperByDefault: z
      .boolean()
      .meta({
        description:
          "Lessons open the \"Go deeper\" version of each explanation first: the learner's choice, or their memory while they haven't chosen",
      }),
    deeperFromMemory: z
      .boolean()
      .meta({ description: "On because memory says they asked for a more technical register" }),
    experienceMode: experienceModeSchema
      .nullable()
      .meta({ description: "Null until the learner chooses; show Focus meanwhile" }),
    soundsEnabled: z
      .boolean()
      .meta({ description: "Sounds for a right answer and for finishing; on by default" }),
  })
  .meta({ id: "LearningProfile" });

const learnerProtectionsSchema = z
  .object({
    ageGroup: ageGroupSchema,
    marketingEmailAllowed: z.boolean().meta({ description: "Whether marketing email may be sent" }),
    memoryCategories: z
      .array(z.enum(MemoryCategory))
      .meta({ description: "Memory categories that may be stored and read" }),
    plusPurchase: z
      .enum(["allowed", "guestNotAllowed", "needsGuardianApproval"])
      .meta({ description: "Whether the learner can subscribe to Plus now" }),
    sessionReplayAllowed: z.boolean().meta({ description: "Whether session replay may record" }),
  })
  .meta({
    description:
      "Protective defaults: under 18 or without an age answer, the most protective apply",
    id: "LearnerProtections",
  });

export const learningProfileResponseSchema = z
  .object({ profile: learningProfileSchema, protections: learnerProtectionsSchema })
  .meta({ id: "LearningProfileResponse" });
