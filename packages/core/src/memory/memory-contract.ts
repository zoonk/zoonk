import {
  MemoryCategory,
  type MemoryFactStatus,
  type MemoryInsightKind,
  MemoryInsightStatus,
  type MemoryOrigin,
} from "@zoonk/db";
import { z } from "zod";
import { type PlanEffect } from "../plans/planner/plan-effect";

/** A fact is one short line; the Memory screen and every task read it whole. */
export const MAX_MEMORY_STATEMENT_LENGTH = 160;

/** One chat message or session can change a few facts; an undo never covers more. */
const MAX_UNDO_CHANGES = 10;

export const memoryCategorySchema = z
  .enum(MemoryCategory)
  .meta({
    description: "Goals, background, routine, preferences, learning or context",
    id: "MemoryCategory",
  });

const MEMORY_SOURCE_KINDS = ["onboarding", "chat", "session"] as const;

/** Where a fact came from, with the goal, conversation or study session it points to. */
export const memorySourceSchema = z
  .object({
    id: z.string().nullable().meta({ description: "The goal, conversation or study session id" }),
    kind: z.enum(MEMORY_SOURCE_KINDS),
  })
  .meta({ id: "MemorySource" });

export type MemorySource = z.infer<typeof memorySourceSchema>;

export const memoryFactUpdateSchema = z
  .object({
    category: memoryCategorySchema.optional(),
    statement: z.string().trim().min(1).max(MAX_MEMORY_STATEMENT_LENGTH).optional(),
  })
  .strict()
  .refine((input) => input.category !== undefined || input.statement !== undefined, {
    message: "Send a new statement, a new category or both",
  })
  .meta({ id: "MemoryFactUpdate", override: { minProperties: 1 } });

export type MemoryFactUpdateInput = z.infer<typeof memoryFactUpdateSchema>;

export const memorySettingsUpdateSchema = z
  .object({
    enabled: z
      .boolean()
      .meta({
        description: "Off stops Zoonk from learning and using facts; the facts stay listed",
      }),
  })
  .strict()
  .meta({ id: "MemorySettingsUpdate" });

export type MemorySettingsUpdateInput = z.infer<typeof memorySettingsUpdateSchema>;

const memoryChangeReferenceSchema = z
  .object({
    factId: z.uuid().nullable().meta({ description: "The fact the change added" }),
    previousFactId: z
      .uuid()
      .nullable()
      .meta({ description: "The fact the change replaced or removed" }),
  })
  .strict()
  .refine((change) => change.factId !== null || change.previousFactId !== null, {
    message: "A change needs factId, previousFactId or both",
  })
  .meta({ id: "MemoryChangeReference" });

export type MemoryChangeReference = z.infer<typeof memoryChangeReferenceSchema>;

/** The changes a "Memory updated" notice or a delete showed, sent back to undo them together. */
export const memoryUndoInputSchema = z
  .object({ changes: z.array(memoryChangeReferenceSchema).min(1).max(MAX_UNDO_CHANGES) })
  .strict()
  .meta({ id: "MemoryUndoInput" });

export type MemoryUndoInput = z.infer<typeof memoryUndoInputSchema>;

export const memoryInsightQuerySchema = z
  .object({ goalId: z.uuid().optional().meta({ description: "Only insights for this goal" }) })
  .strict()
  .meta({ id: "MemoryInsightQuery" });

export type MemoryInsightQuery = z.infer<typeof memoryInsightQuerySchema>;

export const memoryInsightAnswerSchema = z
  .object({
    status: z
      .enum([MemoryInsightStatus.accepted, MemoryInsightStatus.dismissed])
      .meta({
        description:
          "accepted applies a plan change or schedule idea; dismissed declines it or closes a tip",
      }),
  })
  .strict()
  .meta({ id: "MemoryInsightAnswer" });

export type MemoryInsightAnswerInput = z.infer<typeof memoryInsightAnswerSchema>;

/** One fact as every screen and the API show it. */
export type MemoryFactView = {
  id: string;
  category: MemoryCategory;
  statement: string;
  origin: MemoryOrigin;
  confidence: number | null;
  sensitive: boolean;
  source: MemorySource | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * The Memory screen: the switch, the categories this learner's memory may hold (only goals and
 * learning for minors) and every active fact, newest first.
 */
export type MemoryView = {
  enabled: boolean;
  categories: MemoryCategory[];
  facts: MemoryFactView[];
};

/**
 * What one write did, shown as "Memory updated" with undo. `fact` is what memory holds now and
 * `previous` what it replaced or removed.
 */
export type MemoryChange =
  | { action: "added"; fact: MemoryFactView; previous: null }
  | { action: "removed"; fact: null; previous: MemoryFactView }
  | { action: "replaced"; fact: MemoryFactView; previous: MemoryFactView };

/** Everything a learner's memory holds, for an export with their account data. */
export type MemoryExport = {
  exportedAt: Date;
  enabled: boolean;
  facts: (MemoryFactView & {
    status: MemoryFactStatus;
    supersededById: string | null;
    lastUsedAt: Date | null;
    deletedAt: Date | null;
  })[];
  insights: {
    id: string;
    kind: MemoryInsightKind;
    message: string;
    status: MemoryInsightStatus;
    createdAt: Date;
  }[];
};

/** An insight on Today: a tip, a plan change offer or a schedule idea. */
export type MemoryInsightView = {
  id: string;
  goalId: string | null;
  kind: MemoryInsightKind;
  message: string;
  status: MemoryInsightStatus;
  /**
   * For a plan change, the plan change behind it: `applied` when its one lesson is already in the
   * plan (accepting keeps it, dismissing undoes it), `proposed` while a bigger gap (a few lessons or
   * a chapter) waits for the learner's OK. `effect` says how many lessons it adds and how it moves
   * the end date.
   */
  planChange: { effect: PlanEffect | null; id: string; status: "applied" | "proposed" } | null;
  /** The suggested study time, such as "20:00", for a schedule idea. */
  studyTime: string | null;
  createdAt: Date;
};
