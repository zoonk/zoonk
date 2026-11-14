import { isDeepStrictEqual } from "node:util";
import { type Sql, type TransactionClient } from "@zoonk/db";
import { z } from "zod";
import { type FixUnit, type Json, type Resolution, refuse } from "../_utils/resolved-change";
import { type ContentFixEffect } from "../contract";
import { type PlanRoots, defineFixHandler, fieldChangeSchema, idSchema } from "./fix-handler";

export type CollectionState = {
  before: Json;
  roots: PlanRoots;
  unit: FixUnit;
  problem?: string;
  effects?: ContentFixEffect[];
};

export function collectionHandler<Model extends string, Operation extends string>(spec: {
  model: Model;
  op: Operation;
  table: Sql;
  schema: z.ZodType;
  rules: string;
  load: (db: TransactionClient, id: string, after: Json) => Promise<CollectionState | null>;
  write: (tx: TransactionClient, id: string, after: Json) => Promise<void>;
}) {
  async function resolve(
    db: TransactionClient,
    proposed: { id: string; value: Json },
  ): Promise<
    Resolution<{
      id: string;
      model: Model;
      op: Operation;
      fields: { field: string; before: Json; after: Json }[];
      roots: PlanRoots;
    }>
  > {
    const parsed = spec.schema.safeParse(proposed.value);

    if (!parsed.success) {
      return refuse(parsed.error.message);
    }

    const after = z.json().parse(parsed.data);
    const state = await spec.load(db, proposed.id, after);

    if (!state) {
      return refuse(`No ${spec.model} with id ${proposed.id}.`);
    }

    if (state.problem) {
      return refuse(state.problem);
    }

    if (isDeepStrictEqual(after, state.before)) {
      return refuse("This collection is already stored.");
    }

    return {
      effects: state.effects ?? [],
      ok: true,
      stored: {
        fields: [{ after, before: state.before, field: spec.op }],
        id: proposed.id,
        model: spec.model,
        op: spec.op,
        roots: state.roots,
      },
      unit: state.unit,
    };
  }

  return defineFixHandler({
    apply: (tx, stored) => spec.write(tx, stored.id, stored.fields[0]?.after ?? null),
    model: spec.model,
    op: spec.op,
    planRoots: (stored) => stored.roots,
    proposal: {
      rules: spec.rules,
      schema: z
        .strictObject({ id: idSchema, model: z.literal(spec.model), [spec.op]: z.json() })
        .transform((value) => ({
          id: idSchema.parse(value.id),
          value: z.json().parse(value[spec.op]),
        })),
    },
    resolve,
    revert: (db, stored) => resolve(db, { id: stored.id, value: stored.fields[0]?.before ?? null }),
    stored: z.object({
      fields: z.array(fieldChangeSchema),
      id: idSchema,
      model: z.literal(spec.model),
      op: z.literal(spec.op),
      roots: z.object({
        blueprintIds: z.array(idSchema).optional(),
        chapterIds: z.array(idSchema).optional(),
        courseIds: z.array(idSchema).optional(),
        lessonIds: z.array(idSchema).optional(),
        skillIds: z.array(idSchema).optional(),
      }),
    }),
    table: spec.table,
    targets: ({ id }) => [{ id, model: spec.model, part: spec.op }],
    toProposed: (stored) => ({ id: stored.id, value: stored.fields[0]?.after ?? null }),
  });
}

export function sharedProblem(
  container: {
    language: string;
    targetLanguage: string | null;
    ownerId: string | null;
    visibility: string;
  },
  children: readonly {
    id: string;
    language: string;
    targetLanguage: string | null;
    ownerId: string | null;
    visibility: string;
    mergedIntoId?: string | null;
  }[],
  ids: readonly string[],
): string | undefined {
  if (new Set(ids).size !== ids.length) {
    return "Collection ids must be unique.";
  }

  if (container.ownerId || container.visibility !== "public") {
    return "The container must be public with no owner.";
  }

  for (const id of ids) {
    const child = children.find((row) => row.id === id);

    if (!child) {
      return `No shared child with id ${id}.`;
    }

    if (child.mergedIntoId) {
      return `Skill ${id} was merged; use surviving Skill ${child.mergedIntoId}.`;
    }

    if (child.ownerId || child.visibility !== "public") {
      return `Child ${id} must be public with no owner.`;
    }

    if (
      child.language !== container.language ||
      child.targetLanguage !== container.targetLanguage
    ) {
      return `Child ${id} has a different language or target language.`;
    }
  }

  return undefined;
}

export const collectionIds = z.array(idSchema);
