import { skillStateCountsSchema } from "@zoonk/core/learner/contract";
import { placementStatusSchema } from "@zoonk/core/learner/placement/contract";
import { focusTestViewSchema } from "@zoonk/core/learner/placement/focus-test-contract";
import { trueFalseLabelsSchema } from "@zoonk/core/library/exams/true-false-labels";
import { MasteryState } from "@zoonk/db";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { questionImageSchema, questionSelectSchema, questionVisualSchema } from "./common";

export const skillIdSchema = uuidSchema().meta({ description: "Skill ID" });

export const probabilitySchema = z.number().min(0).max(1);

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
  itemId: uuidSchema().meta({ description: "Answer with this item ID" }),
  skillId: skillIdSchema,
  visual: questionVisualSchema,
};

export const bankQuestionSchema = z
  .discriminatedUnion("format", [
    z.object({
      ...questionBaseShape,
      format: z.literal("multipleChoice"),
      options: z
        .array(z.string())
        .meta({ description: "Answer with the chosen option's index, or indexes" }),
      question: z.string(),
      select: questionSelectSchema,
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
    answered: z
      .number()
      .int()
      .min(0)
      .meta({
        description:
          "This goal's placement answers so far, which number its questions (the next is `answered` + 1). Answers from before the goal, lessons and sessions on the same skills place the learner too but aren't counted. There's no total: placement asks until it's sure or today's few minutes are used",
      }),
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
    dayBudgetSpent: z
      .number()
      .min(0)
      .max(1)
      .meta({
        description:
          "How much of today's few minutes the day's answers used, from 0 to 1: the further along of its two limits, the answers and the answering time. Placement stops for the day at 1 (`dayBudgetUsed`), or sooner once it's sure, so it's how far along today's questions are at most, never a count still to come",
      }),
    dayBudgetUsed: z
      .boolean()
      .meta({
        description:
          "Today's few minutes of placement are used: no next question today; the first week's sessions ask the rest",
      }),
    focusTest: focusTestViewSchema
      .nullable()
      .meta({
        description:
          "An exam goal's placement is its Focus test: sittings of a promised number of questions instead of a few minutes a day. Then `next` is set only while a sitting is open with questions left, `dayBudgetSpent` is the sitting's share answered, `dayBudgetUsed` says it has none left, and `started` that it has answers. Null for other goals",
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
    focusTest: focusTestViewSchema
      .nullable()
      .meta({
        description:
          "An exam goal's Focus test after this finish, with its result (`checkpoint`); null for other goals",
      }),
    knownSkillIds: z.array(skillIdSchema),
    phases: z.array(phaseStartSchema),
    testedOutPlanItemIds: z.array(uuidSchema()),
  })
  .meta({ id: "PlacementCompletion" });
