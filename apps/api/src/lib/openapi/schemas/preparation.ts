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
      days: z.number().int().min(1).meta({ description: "Days of extra time that catch up" }),
      extraMinutesPerDay: z.number().int().min(1),
      kind: z.literal("behind"),
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
      studiedSkills: z.number().int().min(0),
      totalSkills: z.number().int().min(0),
      value: shareSchema.meta({ description: "Share of the goal (by weight) studied" }),
    }),
    mastery: z.object({
      answered: z.number().int().min(0),
      correct: z.number().int().min(0),
      value: shareSchema
        .nullable()
        .meta({ description: "Accuracy on questions never seen before" }),
    }),
    mocks: z
      .object({
        kind: z.enum(["mockExams", "weeklyChallenges"]),
        taken: z.number().int().min(0),
        value: shareSchema.nullable().meta({ description: "Recent results" }),
      })
      .meta({
        description:
          "The fourth part: an exam goal's mock exams, or another goal's weekly challenges (it has no exam to rehearse)",
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
    weekGain: z.number().min(-1).max(1),
  })
  .meta({ id: "GoalPreparation" });
