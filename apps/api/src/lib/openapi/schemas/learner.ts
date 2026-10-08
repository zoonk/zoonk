import { skillStateCountsSchema } from "@zoonk/core/learner/contract";
import { placementStatusSchema } from "@zoonk/core/learner/placement/contract";
import { trueFalseLabelsSchema } from "@zoonk/core/library/exams/true-false-labels";
import { MasteryState } from "@zoonk/db";
import { z } from "zod";
import { questionImageSchema, questionVisualSchema } from "./common";

const skillIdSchema = z.uuid().meta({ description: "Skill ID" });

const probabilitySchema = z.number().min(0).max(1);

const masteryStateSchema = z
  .enum(MasteryState)
  .meta({
    description:
      "New, Learning, Solid (stable for about a week) or Mastered (remembered on three different days)",
    id: "MasteryState",
  });

const skillCardSchema = z
  .object({
    areaId: z
      .string()
      .nullable()
      .meta({ description: "The goal area (chapter or phase) the skill belongs to" }),
    areaTitle: z.string().nullable(),
    description: z
      .string()
      .meta({ description: "The idea in one sentence: the front of the study card" }),
    due: z.iso.datetime().nullable().meta({ description: "When the next review is due" }),
    example: z
      .string()
      .nullable()
      .meta({ description: "A worked example: the back of the study card" }),
    fading: z
      .boolean()
      .meta({ description: "Memory has dropped below the retention reviews aim for" }),
    name: z.string(),
    recallDays: z
      .number()
      .int()
      .min(0)
      .meta({ description: "Different days the skill was remembered" }),
    retrievability: probabilitySchema
      .nullable()
      .meta({ description: "Chance of recalling it now" }),
    skillId: skillIdSchema,
    state: masteryStateSchema,
    studiedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: "SkillCard" });

export const skillListResponseSchema = z
  .object({ counts: skillStateCountsSchema, skills: z.array(skillCardSchema) })
  .meta({ id: "SkillList" });

export const reviewScheduleResponseSchema = z
  .object({
    cap: z
      .number()
      .int()
      .min(0)
      .meta({ description: "Most reviews one day holds at the goal's daily time" }),
    dueToday: z.array(
      z.object({
        due: z.iso.datetime().nullable(),
        name: z.string(),
        retrievability: probabilitySchema.nullable(),
        skillId: skillIdSchema,
      }),
    ),
    forecast: z.array(
      z.object({
        date: z.iso.date().meta({ description: "Learner-local calendar date" }),
        reviews: z.number().int().min(0),
      }),
    ),
  })
  .meta({ id: "ReviewSchedule" });

const questionBaseShape = {
  context: z.string().nullable().meta({ description: "A situation shown before the question" }),
  image: questionImageSchema,
  itemId: z.uuid().meta({ description: "Answer with this item ID" }),
  skillId: skillIdSchema,
  visual: questionVisualSchema,
};

export const bankQuestionSchema = z
  .discriminatedUnion("format", [
    z.object({
      ...questionBaseShape,
      format: z.literal("multipleChoice"),
      options: z.array(z.string()).meta({ description: "Answer with the chosen option's index" }),
      question: z.string(),
    }),
    z.object({
      ...questionBaseShape,
      format: z.literal("trueFalse"),
      options: z.null(),
      question: z.string().meta({ description: "The statement to judge true or false" }),
    }),
  ])
  .meta({ description: "A bank question without its answers", id: "BankQuestion" });

const phaseStartSchema = z
  .object({
    confident: z.boolean().meta({ description: "Placement is at least 80% sure about this start" }),
    phase: z.number().int().min(0),
    startSkillId: skillIdSchema
      .nullable()
      .meta({ description: "Null when the whole phase is known" }),
  })
  .meta({ id: "PhaseStart" });

const areaStartSchema = z
  .object({
    area: z
      .string()
      .nullable()
      .meta({
        description:
          "The plan's area: the course or exam subject the skill graph put its skills in, as plan focus names it. Null when the plan names none",
      }),
    confident: z
      .boolean()
      .meta({ description: "Placement is at least 80% sure about this start in every phase" }),
    startSkillId: skillIdSchema
      .nullable()
      .meta({
        description: "The area's first skill the learner can't do yet; null when all known",
      }),
  })
  .meta({ id: "AreaStart" });

/** Placement also asks typed questions, graded one key point at a time, to confirm a skill. */
const placementQuestionSchema = z
  .discriminatedUnion("format", [
    ...bankQuestionSchema.options,
    z.object({
      ...questionBaseShape,
      format: z.literal("typed"),
      options: z.null(),
      question: z.string().meta({ description: "Answer in the learner's own words, as `text`" }),
    }),
  ])
  .meta({ description: "A placement question without its answer", id: "PlacementQuestion" });

export const placementResponseSchema = z
  .object({
    answered: z.number().int().min(0),
    areas: z
      .array(areaStartSchema)
      .meta({
        description: "Where each area starts, in the order the plan reaches them: areas take turns",
      }),
    complete: z
      .boolean()
      .meta({
        description:
          "Every area of every phase has a confident starting point. False while the plan has no skills yet",
      }),
    dayBudgetUsed: z
      .boolean()
      .meta({
        description:
          "Today's few minutes of placement are used: no next question today; the first week's sessions ask the rest",
      }),
    knownSkillIds: z.array(skillIdSchema),
    needsItems: z
      .array(skillIdSchema)
      .meta({ description: "Undecided skills with no question to ask yet" }),
    next: placementQuestionSchema.nullable(),
    phases: z.array(phaseStartSchema),
    started: z
      .boolean()
      .meta({
        description:
          "This goal's placement already has answers: a client coming back resumes at `next` instead of showing placement's start",
      }),
    status: placementStatusSchema,
    trueFalseLabels: trueFalseLabelsSchema,
  })
  .meta({ id: "Placement" });

export const placementAnswerResponseSchema = z
  .object({ isCorrect: z.boolean(), placement: placementResponseSchema })
  .meta({ id: "PlacementAnswerResult" });

export const placementCompletionResponseSchema = z
  .object({
    areas: z.array(areaStartSchema),
    complete: z
      .boolean()
      .meta({
        description:
          "Every area of every phase had a confident start when placement finished. False when the plan had no skills yet: nothing was placed",
      }),
    knownSkillIds: z.array(skillIdSchema),
    phases: z.array(phaseStartSchema),
    testedOutPlanItemIds: z.array(z.uuid()),
  })
  .meta({ id: "PlacementCompletion" });

export const chapterTestOutResponseSchema = z
  .object({
    chapterId: z.uuid(),
    needsItems: z
      .array(skillIdSchema)
      .meta({
        description:
          "Sampled skills without their share of questions yet: POST .../test-out/generations writes them when the learner asks",
      }),
    passMark: probabilitySchema,
    questions: z
      .array(bankQuestionSchema)
      .meta({
        description:
          "Four to eight, more the more lessons a pass skips, spread over the sampled skills (a chapter of few skills asks each several times); empty while `needsItems` lists any, so a test-out never runs on part of the chapter",
      }),
    questionsPerSkill: z
      .int()
      .min(0)
      .meta({ description: "How many questions each sampled skill gets" }),
    trueFalseLabels: trueFalseLabelsSchema,
  })
  .meta({ id: "ChapterTestOut" });

export const testOutGenerationSchema = z
  .object({
    generationId: z
      .string()
      .nullable()
      .meta({
        description: "The run writing the questions: stream GET /generations/{generationId}/events",
      }),
    status: z
      .enum(["ready", "generating"])
      .meta({
        description:
          "`ready`: GET the test-out now. `generating`: follow the run's stream until `testOutQuestionsReady`",
      }),
  })
  .meta({ id: "TestOutGeneration" });

export const chapterTestOutResultSchema = z
  .object({
    answers: z.array(z.object({ isCorrect: z.boolean(), itemId: z.uuid() })),
    changeId: z
      .uuid()
      .nullable()
      .meta({
        description:
          "The plan change that skipped the lessons; undo it through the goal's plan changes. Null when nothing was skipped or the plan isn't built yet.",
      }),
    correct: z.number().int().min(0),
    knownSkillIds: z
      .array(skillIdSchema)
      .meta({ description: "Skills answered right; skills missed or not asked stay in the plan" }),
    missedSkillIds: z.array(skillIdSchema),
    passed: z.boolean(),
    testedOutPlanItemIds: z.array(z.uuid()),
    total: z.number().int().min(0),
  })
  .meta({ id: "ChapterTestOutResult" });
