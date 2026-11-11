import { z } from "zod";
import { goalDraftSchema, targetRegionSchema } from "../../goals/goal-contract";
import { MAX_ONBOARDING_ANSWER_LENGTH } from "./onboarding-limits";

const STUDY_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u;

const ONBOARDING_DRAFT_TEXT_FIELDS = [
  "institution",
  "reason",
  "role",
  "targetCourse",
  "targetPosition",
  "targetScore",
] as const;

const MAX_DRAFT_GOAL_INDEX = 9;

const draftGoalSchema = z
  .int()
  .min(0)
  .max(MAX_DRAFT_GOAL_INDEX)
  .meta({ description: "Which goal of the card, in order: 0 is the main goal" });

const draftTextSchema = z.string().trim().min(1).max(MAX_ONBOARDING_ANSWER_LENGTH);

/** Dependent fields follow edits; null dates restore exam dates, while changing the original words needs a new understanding. */
export const onboardingDraftEditSchema = z
  .discriminatedUnion("field", [
    z
      .object({
        field: z.enum(["title", "displayName"]),
        goal: draftGoalSchema,
        value: goalDraftSchema.shape.title,
      })
      .strict(),
    z
      .object({
        field: z.literal("targetDate"),
        goal: draftGoalSchema,
        value: z.iso
          .date()
          .nullable()
          .meta({
            description:
              "The learner's own deadline; null brings back the exam's dates. From the day after the learner's today in the draft's `timeZone` through 3,650 days after it; a date outside either bound is refused with 422 TARGET_DATE_OUT_OF_RANGE, as POST /goals refuses it",
          }),
      })
      .strict(),
    z
      .object({
        field: z.enum(ONBOARDING_DRAFT_TEXT_FIELDS),
        goal: draftGoalSchema,
        value: draftTextSchema.nullable().meta({ description: "Null removes it" }),
      })
      .strict(),
    z
      .object({
        field: z.literal("targetRegion"),
        goal: draftGoalSchema,
        value: targetRegionSchema
          .nullable()
          .meta({ description: "One of the goal's `regionChoices`, or null for none" }),
      })
      .strict(),
    z
      .object({
        field: z.literal("studyTime"),
        value: z
          .string()
          .regex(STUDY_TIME_PATTERN)
          .meta({ description: "HH:mm, shared by every goal of the card" }),
      })
      .strict(),
  ])
  .meta({ id: "OnboardingDraftEdit" });

export type OnboardingDraftEdit = z.infer<typeof onboardingDraftEditSchema>;
