import { skillStateCountsSchema } from "@zoonk/core/learner/contract";
import { type ContentView } from "@zoonk/core/view-models/content/get";
import { type ProgressView } from "@zoonk/core/view-models/progress/get";
import { GoalKind, MasteryState } from "@zoonk/db";
import { z } from "zod";
import { goalPreparationResponseSchema } from "./preparation";
import { logicalDateSchema, studyBlockSchema } from "./study-sessions";

const masteryStateSchema = z.enum(MasteryState);

const stillNeededAreaSchema = z.object({
  areaId: z.string(),
  left: z
    .array(z.object({ name: z.string(), skillId: z.uuid() }))
    .meta({ description: "The area's skills still below their bar, in plan order" }),
  minutes: z
    .number()
    .int()
    .min(0)
    .meta({
      description:
        "Study time the plan still gives these skills at the learner's pace, reviews included",
    }),
  title: z.string(),
  total: z.number().int().min(0).meta({ description: "The area's skills in the goal" }),
});

const stillNeededSchema = z
  .object({
    areas: z.array(stillNeededAreaSchema),
    left: z.number().int().min(0),
    minutes: z.number().int().min(0),
    rule: z
      .enum(["examWeighted", "solid"])
      .meta({
        description:
          "`solid`: every skill must be Solid. `examWeighted`: skills with an exam weight of 4 or 5 must be Solid, the rest at least Learning",
      }),
  })
  .meta({
    description:
      "\"Still needed to reach your goal\": the goal's skills below their bar by area (chapter, or plan phase before chapters exist), with the plan's time for them. Areas already at the bar have nothing left",
  });

export const goalProgressResponseSchema = z
  .object({
    goal: z.object({
      id: z.uuid(),
      kind: z.enum(GoalKind),
      targetDate: logicalDateSchema.nullable(),
      title: z.string(),
    }),
    mistakes: z.object({
      open: z.number().int().min(0).meta({ description: "Open entries in the mistakes notebook" }),
    }),
    preparation: goalPreparationResponseSchema
      .nullable()
      .meta({ description: "Null for a quick explanation: one answer, not a goal to prepare for" }),
    stillNeeded: stillNeededSchema,
  })
  .meta({ id: "GoalProgress" }) satisfies z.ZodType<ProgressView>;

const contentCardSchema = z
  .object({
    description: z.string().nullable().meta({ description: "The front of the card: the idea" }),
    dueToday: z
      .boolean()
      .meta({ description: "In today's reviews (`capsules.dueToday` counts them)" }),
    example: z.string().nullable().meta({ description: "The back of the card: an example" }),
    fading: z.boolean(),
    name: z.string(),
    recallDays: z
      .number()
      .int()
      .min(0)
      .meta({ description: "Different days it was remembered; Mastered at three" }),
    retrievability: z.number().min(0).max(1).nullable(),
    skillId: z.uuid(),
    state: masteryStateSchema,
  })
  .meta({ id: "ContentCard" });

export const goalContentResponseSchema = z
  .object({
    capsules: z.object({
      dueToday: z
        .number()
        .int()
        .min(0)
        .meta({ description: "Skills due for review today (time capsules)" }),
    }),
    counts: skillStateCountsSchema.meta({ description: "The goal's skills by state" }),
    goal: z.object({ id: z.uuid(), kind: z.enum(GoalKind), title: z.string() }),
    groups: z
      .array(
        z.object({
          areaId: z.string(),
          cards: z.array(contentCardSchema),
          counts: skillStateCountsSchema,
          section: z
            .string()
            .nullable()
            .meta({
              description:
                "The course or exam subject the chapter's skills belong to; null when the goal's graph names none",
            }),
          title: z.string(),
        }),
      )
      .meta({
        description:
          "Every skill of the goal as a card, grouped by chapter in plan order, with each section's chapters together (show a section header when there are two or more)",
      }),
  })
  .meta({ id: "GoalContent" }) satisfies z.ZodType<ContentView>;

export const areaPracticeResponseSchema = z
  .object({
    block: studyBlockSchema,
    sessionId: z.uuid().meta({ description: "Today's session the block was added to" }),
  })
  .meta({ id: "AreaPractice" });
