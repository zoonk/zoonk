import { dayBlockRefSchema } from "@zoonk/core/sessions/day-block";
import { StudyBlockKind, StudyBlockStatus } from "@zoonk/db";
import { z } from "zod";
import { studyCheckpointSchema } from "./checkpoint-evidence";

const idSchema = z.uuid();

export const studyBlockSchema = z
  .object({
    answered: z.number().int().min(0),
    areaId: dayBlockRefSchema.shape.areaId.meta({
      description:
        "The area a chapter's \"Practice now\" practices: the chapter's id, or `phase:N` for skills not in a chapter yet. Null for every other block",
    }),
    brainPower: z.number().int().min(0).meta({ description: "Brain Power the block earned" }),
    canDo: z.string().nullable().meta({ description: "What the learner will be able to do" }),
    canTestOut: z
      .boolean()
      .meta({
        description:
          "Offer this lesson's chapter test unless it was failed today without a lesson studied in that chapter since; available again on the next learner-local day. False for blocks without a lesson chapter",
      }),
    capsules: z.array(
      z.object({
        format: z.enum(["rapidFire", "matchPairs", "swipe"]),
        key: z.string(),
        lessonId: idSchema.nullable(),
        opened: z.boolean(),
        questions: z.number().int().min(0),
        title: z.string(),
      }),
    ),
    chapterId: idSchema
      .nullable()
      .meta({ description: "A chapter whose lesson is written just in time" }),
    checkpoint: studyCheckpointSchema.nullable(),
    estimatedBrainPower: z.number().int().min(0),
    estimatedMinutes: z.number().int().min(0),
    extra: z.boolean().meta({ description: 'A "10 more minutes" block after the day\'s session' }),
    fullReview: z
      .boolean()
      .meta({
        description: "A full review: every topic, in place of a mock the plan doesn't have",
      }),
    id: idSchema,
    kind: z.enum(StudyBlockKind),
    lessonId: idSchema.nullable(),
    mistakesOnly: z
      .boolean()
      .meta({
        description:
          "A practice block that only fixes the learner's mistakes (their drills, no practice questions): name it for that, not as mixed practice",
      }),
    netScored: z
      .boolean()
      .meta({
        description:
          "Practice scored net (a wrong answer cancels a right one, as in Cebraspe exams): statements can be answered with dontKnow to leave them blank. Swipe capsules are scored net on their own",
      }),
    oftenTested: z
      .boolean()
      .meta({
        description: "An exam topic the board asks a lot in past papers: tiles tag it Often tested",
      }),
    planItemId: idSchema.nullable(),
    planItemKey: dayBlockRefSchema.shape.planItemKey.describe(
      "Logical plan work identity; never a database UUID",
    ),
    position: z.number().int().min(0),
    questions: z.number().int().min(0),
    refresh: z
      .boolean()
      .meta({
        description:
          "Content's \"Review\" (`POST /v1/goals/{goalId}/refresh-practice`): bonus practice on the goal's skills that are fading or due today",
      }),
    reinforcement: z.boolean().meta({ description: "A short lesson before a boss rematch" }),
    status: z.enum(StudyBlockStatus),
    subject: z
      .string()
      .nullable()
      .meta({
        description:
          "The goal's subject the block studies, by its short name (as `GET /v1/goals/{goalId}/syllabus` names it): label the block with it. Null for blocks that mix subjects, and for goals with fewer than two subjects",
      }),
    title: z.string().nullable(),
    waitReason: z
      .enum(["lessons", "challenge"])
      .nullable()
      .meta({
        description:
          "Why a phase challenge waits: earlier lessons or an earlier phase challenge in this session are still pending or active. Completed or skipped work releases it. Null for blocks that can open in any order, including lessons, review, practice, the weekly challenge and mocks",
      }),
    weakest: z
      .boolean()
      .meta({
        description:
          "A review of the learner's weakest studied topics, none of them due: a day with nothing due and nothing else to study gets it instead of staying empty. Say so rather than calling it due",
      }),
  })
  .meta({ id: "StudyBlock" });
