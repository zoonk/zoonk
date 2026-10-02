import { memoryCategorySchema, memorySourceSchema } from "@zoonk/core/memory/contract";
import { MemoryFactStatus, MemoryInsightKind, MemoryInsightStatus, MemoryOrigin } from "@zoonk/db";
import { z } from "zod";
import { planEffectSchema } from "./plans";

const memoryFactSchema = z
  .object({
    category: memoryCategorySchema,
    confidence: z
      .number()
      .min(0)
      .max(1)
      .nullable()
      .meta({
        description: "Lower for facts noticed from activity than for facts the learner said",
      }),
    createdAt: z.iso.datetime(),
    expiresAt: z.iso
      .datetime()
      .nullable()
      .meta({ description: "When a fact with an end, like an exam date, stops being true" }),
    id: z.uuid(),
    origin: z
      .enum(MemoryOrigin)
      .meta({ description: "The learner said it, or Zoonk noticed it from activity" }),
    sensitive: z
      .boolean()
      .meta({ description: "Health, beliefs and similar, kept only because the learner asked" }),
    source: memorySourceSchema.nullable(),
    statement: z.string(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: "MemoryFact" });

export const memoryResponseSchema = z
  .object({
    categories: z
      .array(memoryCategorySchema)
      .meta({ description: "The categories this learner's memory may hold, in display order" }),
    enabled: z.boolean().meta({ description: "Whether memory is on" }),
    facts: z.array(memoryFactSchema).meta({ description: "Active facts, newest first" }),
  })
  .meta({ id: "Memory" });

export const memorySettingsResponseSchema = z
  .object({ enabled: z.boolean() })
  .meta({ id: "MemorySettings" });

export const memoryFactResponseSchema = z
  .object({ fact: memoryFactSchema })
  .meta({ id: "MemoryFactResponse" });

export const memoryFactDeletionSchema = z
  .object({
    change: z
      .object({ action: z.literal("removed"), fact: z.null(), previous: memoryFactSchema })
      .meta({ description: "Send it back to undo the deletion" }),
  })
  .meta({ id: "MemoryFactDeletion" });

export const memoryChangeReversalSchema = z
  .object({
    removedFactIds: z.array(z.uuid()).meta({ description: "Facts the undo took back" }),
    restored: z.array(memoryFactSchema).meta({ description: "Facts the undo brought back" }),
  })
  .meta({ id: "MemoryChangeReversal" });

export const memoryExportSchema = z
  .object({
    enabled: z.boolean(),
    exportedAt: z.iso.datetime(),
    facts: z.array(
      memoryFactSchema.extend({
        deletedAt: z.iso.datetime().nullable(),
        lastUsedAt: z.iso.datetime().nullable(),
        status: z.enum(MemoryFactStatus),
        supersededById: z
          .uuid()
          .nullable()
          .meta({ description: "The fact that replaced this one" }),
      }),
    ),
    insights: z.array(
      z.object({
        createdAt: z.iso.datetime(),
        id: z.uuid(),
        kind: z.enum(MemoryInsightKind),
        message: z.string(),
        status: z.enum(MemoryInsightStatus),
      }),
    ),
  })
  .meta({ id: "MemoryExport" });

export const memoryInsightSchema = z
  .object({
    createdAt: z.iso.datetime(),
    goalId: z.uuid().nullable(),
    id: z.uuid(),
    kind: z
      .enum(MemoryInsightKind)
      .meta({ description: "A study tip, a plan change offer or a schedule idea" }),
    message: z.string().meta({ description: "One or two sentences in the learner's language" }),
    planChange: z
      .object({
        effect: planEffectSchema
          .nullable()
          .meta({ description: "Lessons the change adds and how it moves the plan's end date" }),
        id: z.uuid(),
        status: z
          .enum(["applied", "proposed"])
          .meta({
            description:
              "applied: its one lesson is already in the plan (accepting keeps it, dismissing undoes it). proposed: a bigger gap (a few lessons or a chapter) waits for the learner's OK",
          }),
      })
      .nullable()
      .meta({ description: "The plan change behind a plan change insight" }),
    status: z.enum(MemoryInsightStatus),
    studyTime: z
      .string()
      .nullable()
      .meta({ description: 'The suggested study time, such as "20:00", for a schedule idea' }),
  })
  .meta({ id: "MemoryInsight" });

export const currentMemoryInsightResponseSchema = z
  .object({ insight: memoryInsightSchema.nullable() })
  .meta({ id: "CurrentMemoryInsight" });

export const memoryInsightResultSchema = z
  .object({ insight: memoryInsightSchema })
  .meta({ id: "MemoryInsightResult" });
