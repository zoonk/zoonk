import { PlanItemKind, PlanItemStatus } from "@zoonk/db";
import { z } from "zod";

const isoDateSchema = z.iso.date();

export const planItemSchema = z
  .object({
    chapterId: z.uuid().nullable(),
    id: z
      .uuid()
      .nullable()
      .meta({
        description:
          "null for selected in-memory work until the learner opens the day; show the row without an action link",
      }),
    kind: z.enum(PlanItemKind),
    lessonId: z.uuid().nullable(),
    minutes: z.number().nullable(),
    requiresPlus: z
      .boolean()
      .meta({ description: "Free exam plans cover the first week and no mock exams" }),
    scheduledFor: isoDateSchema.nullable(),
    skillId: z.uuid().nullable(),
    status: z.enum(PlanItemStatus),
    title: z
      .string()
      .meta({
        description:
          "The lesson's title; for a skill whose lessons are still being written, its course's (empty when unknown or for the goal's own course: say \"More lessons\")",
      }),
    writing: z
      .boolean()
      .meta({
        description:
          "A stand-in for a skill whose lessons are still being written; show it as being written, never by the skill's name",
      }),
  })
  .meta({ id: "PlanItem" });
