import { EXAM_SCALES } from "@zoonk/core/exams/scales";
import { skillStateCountsSchema } from "@zoonk/core/learner/contract";
import { z } from "zod";

const shareSchema = z.number().min(0).max(1);

/** The SAT's 1,600 is the top of every scale estimates use (ENEM's runs to about 1,000). */
const MAX_ESTIMATE = 1600;

export const estimatedScoreSchema = z
  .object({
    calibrated: z
      .boolean()
      .meta({ description: "Adjusted by official results other learners reported" }),
    high: z.number().min(0).max(MAX_ESTIMATE),
    low: z.number().min(0).max(MAX_ESTIMATE),
    mocks: z.number().int().min(1),
    scale: z
      .enum(["irt", "percent", ...EXAM_SCALES])
      .meta({
        description:
          "percent correct, the exam's item response theory scale (ENEM), or the exam's own scale: ap 1 to 5, sat 400 to 1600, toefl bands 1 to 6 in half bands",
      }),
  })
  .meta({ id: "EstimatedScore" });

export const planStatusSchema = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("onTrack") }),
    z.object({ days: z.number().int().min(1), kind: z.literal("ahead") }),
    z.object({
      days: z
        .number()
        .int()
        .min(0)
        .meta({ description: "Days of extra time that catch up; 0 when lessons says it instead" }),
      extraMinutesPerDay: z.number().int().min(0),
      kind: z.literal("behind"),
      lessons: z
        .number()
        .int()
        .min(1)
        .nullable()
        .meta({
          description:
            "Lessons earlier days left that the learner hasn't caught up on: they come first in the plan, and the learner is behind until they're done. Say this count instead of days when present",
        }),
    }),
    z.object({
      kind: z.literal("needsAdjusting"),
      options: z.array(z.enum(["addTime", "narrowScope", "moveDate"])),
    }),
  ])
  .meta({ id: "PlanStatus" });

const componentsSchema = z
  .object({
    coverage: z.object({
      heaviest: z
        .object({
          studiedSkills: z.number().int().min(0),
          totalSkills: z.number().int().min(0),
          value: shareSchema,
        })
        .meta({
          description:
            "The goal's heavier part (its hardest and most asked skills) and the share of it studied: preparation reads as solid only once this part is too",
        }),
      studiedSkills: z.number().int().min(0),
      totalSkills: z.number().int().min(0),
      value: shareSchema.meta({
        description:
          "Share of the goal studied, each skill counting by the exam's weight on it and how hard it is",
      }),
    }),
    mastery: z.object({
      answered: z.number().int().min(0),
      correct: z.number().int().min(0),
      evidence: z
        .number()
        .min(0)
        .meta({ description: "How many answers the weighted ones are worth as evidence" }),
      value: shareSchema
        .nullable()
        .meta({
          description:
            "Accuracy on questions never seen before, each answer counting by its skill's importance",
        }),
    }),
    mocks: z
      .object({
        kind: z
          .enum(["fullReviews", "mockExams", "weeklyChallenges"])
          .meta({
            description:
              "fullReviews: an exam goal whose plan has no mock exams (free) counts its full reviews in the exam's format (study blocks with `fullReview`), which its plan gives it on the mock's day",
          }),
        plusRequired: z
          .boolean()
          .meta({
            description:
              "The test needs Plus now: the plan has no mocks and its free days are over. Show the mock with the Plus mark",
          }),
        taken: z.number().int().min(0),
        value: shareSchema.nullable().meta({ description: "Recent results" }),
      })
      .meta({
        description:
          "The fourth part: an exam goal's mock exams (or its full reviews when its plan has no mocks), or another goal's weekly challenges (it has no exam to rehearse). Preparation stays under 75% until one is taken, never for a test the learner's plan can't take",
      }),
    retention: z.object({
      studiedSkills: z.number().int().min(0),
      value: shareSchema
        .nullable()
        .meta({ description: "How much of what was studied is still remembered" }),
    }),
  })
  .meta({ id: "PreparationComponents" });

export const goalPreparationResponseSchema = z
  .object({
    areas: z.array(
      z.object({
        areaId: z.string(),
        needsPractice: z.boolean(),
        preparation: shareSchema,
        skills: skillStateCountsSchema,
        title: z.string(),
        weekGain: z.number().min(-1).max(1),
      }),
    ),
    components: componentsSchema,
    estimatedScore: estimatedScoreSchema
      .nullable()
      .meta({
        description: "Only for an exam goal after a mock exam, always a range labeled Estimated",
      }),
    goalId: z.uuid(),
    skills: skillStateCountsSchema,
    stage: z.enum(["starting", "building", "growing", "solid"]),
    status: planStatusSchema.nullable().meta({ description: "Null while nothing is scheduled" }),
    value: shareSchema.meta({
      description: "Preparation: coverage times how well the studied part is known",
    }),
    weakestAreaId: z.string().nullable(),
    weekGain: z
      .number()
      .min(-1)
      .max(1)
      .meta({
        description:
          "Preparation gained since the start of the learner's week (Monday, in their time zone)",
      }),
  })
  .meta({ id: "GoalPreparation" });
