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
    chapters: z
      .array(z.object({ areaId: z.string(), counts: skillStateCountsSchema, title: z.string() }))
      .meta({
        description: "Mastery per chapter (or plan phase before its chapters exist), in plan order",
      }),
    fading: z
      .array(
        z.object({
          name: z.string(),
          retrievability: z.number().min(0).max(1).nullable(),
          skillId: z.uuid(),
        }),
      )
      .meta({ description: "Up to five fading skills, most faded first" }),
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
    week: z
      .object({
        comparison: z
          .object({ days: z.number().int(), minutes: z.number(), questions: z.number().int() })
          .meta({ description: "This week minus last week" }),
        days: z.number().int().min(0),
        minutes: z.number().min(0),
        questions: z.number().int().min(0),
        turnaround: z
          .object({
            from: z.number().min(0).max(1),
            name: z.string(),
            reason: z.enum(["gold", "practice", "solid"]),
            to: z.number().min(0).max(1),
          })
          .nullable()
          .meta({ description: "The skill that moved the most this week, and why" }),
      })
      .nullable()
      .meta({ description: "This week against the learner's own last week" }),
  })
  .meta({ id: "GoalProgress" }) satisfies z.ZodType<ProgressView>;

const contentCardSchema = z
  .object({
    description: z.string().nullable().meta({ description: "The front of the card: the idea" }),
    example: z.string().nullable().meta({ description: "The back of the card: an example" }),
    fading: z.boolean(),
    name: z.string(),
    recallDays: z
      .number()
      .int()
      .min(0)
      .meta({ description: "Different days it was remembered; gold (Mastered) at three" }),
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
        .meta({ description: "Skills due for review today (capsules in Fun)" }),
    }),
    counts: skillStateCountsSchema.meta({
      description: "Counts for the All, Fading, Gold and New filters",
    }),
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
    reveal: z
      .object({
        cards: z.boolean().meta({ description: "Fun shows Cards after the first review" }),
      })
      .meta({ description: "What Fun shows yet" }),
    summaries: z
      .array(
        z.object({
          finishedAt: z.iso.datetime(),
          ideas: z.array(z.string()),
          lessonId: z.uuid(),
          title: z.string(),
        }),
      )
      .meta({ description: "The latest finished lessons' summary cards, newest first" }),
    summaryCount: z
      .number()
      .int()
      .min(0)
      .meta({ description: "Every finished lesson with a summary" }),
  })
  .meta({ id: "GoalContent" }) satisfies z.ZodType<ContentView>;

export const areaPracticeResponseSchema = z
  .object({
    block: studyBlockSchema,
    sessionId: z.uuid().meta({ description: "Today's session the block was added to" }),
  })
  .meta({ id: "AreaPractice" });
