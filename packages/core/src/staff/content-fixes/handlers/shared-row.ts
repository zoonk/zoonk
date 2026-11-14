import { type Sql, type TransactionClient } from "@zoonk/db";
import { z } from "zod";
import {
  type FixUnit,
  type Json,
  type Resolution,
  changedFields,
  refuse,
} from "../_utils/resolved-change";
import { type ContentFixEffect } from "../contract";
import {
  type FieldChange,
  type FixContext,
  type PlanRoots,
  defineFixHandler,
  fieldChangeSchema,
  fieldTargets,
  idSchema,
  setFieldsSchema,
  toRevertedSet,
  toSetProposal,
} from "./fix-handler";

type Loaded = { row: Record<string, Json>; unit: FixUnit; problem?: string; roots?: PlanRoots };

export function sharedRowHandler<Model extends string, Op extends string = "set">(spec: {
  model: Model;
  op?: Op;
  table: Sql;
  fields: Record<string, z.ZodType>;
  rules: string;
  effects?: (unit: FixUnit) => ContentFixEffect[];
  load: (db: TransactionClient, id: string) => Promise<Loaded | null>;
  validate?: (
    row: Record<string, Json>,
    next: Record<string, Json>,
    db: TransactionClient,
  ) => string | null | Promise<string | null>;
  write: (
    tx: TransactionClient,
    id: string,
    values: Record<string, Json>,
    context: FixContext,
  ) => Promise<unknown>;
}) {
  const operation = spec.op ?? "set";

  type Stored = {
    model: Model;
    op: Op | "set";
    id: string;
    fields: FieldChange[];
    roots: PlanRoots;
  };

  async function resolve(
    db: TransactionClient,
    proposed: { model: Model; id: string; set: Record<string, Json> },
  ): Promise<Resolution<Stored>> {
    const loaded = await spec.load(db, proposed.id);

    if (!loaded) {
      return refuse(`No ${spec.model} with id ${proposed.id}.`);
    }

    if (loaded.problem) {
      return refuse(loaded.problem);
    }

    const parsed = z.strictObject(spec.fields).partial().safeParse(proposed.set);

    if (!parsed.success) {
      return refuse(parsed.error.message);
    }

    const values = z.record(z.string(), z.json()).parse(parsed.data);
    const problem = await spec.validate?.(loaded.row, { ...loaded.row, ...values }, db);

    if (problem) {
      return refuse(problem);
    }

    const fields = changedFields(loaded.row, Object.entries(values));

    if (fields.length === 0) {
      return refuse("These values are already stored.");
    }

    return {
      effects: spec.effects?.(loaded.unit) ?? [],
      ok: true,
      stored: {
        fields,
        id: proposed.id,
        model: spec.model,
        op: operation,
        roots: loaded.roots ?? {},
      },
      unit: loaded.unit,
    };
  }

  return defineFixHandler({
    apply: async (tx, stored, context) => {
      await spec.write(
        tx,
        stored.id,
        Object.fromEntries(stored.fields.map(({ field, after }) => [field, after])),
        context,
      );
    },
    model: spec.model,
    op: operation,
    planRoots: (stored) => stored.roots,
    proposal: {
      fields: Object.keys(spec.fields),
      rules: spec.rules,
      schema: z
        .strictObject({ id: idSchema, model: z.literal(spec.model) })
        .extend({ [operation]: setFieldsSchema })
        .transform((value) => ({
          id: idSchema.parse(value.id),
          model: spec.model,
          set: setFieldsSchema.parse(value[operation]),
        })),
    },
    resolve,
    revert: (db, stored) => resolve(db, toRevertedSet(stored)),
    stored: z.object({
      fields: z.array(fieldChangeSchema).min(1),
      id: idSchema,
      model: z.literal(spec.model),
      op: z.literal(operation),
      roots: z.object({
        blueprintIds: z.array(idSchema).optional(),
        chapterIds: z.array(idSchema).optional(),
        courseIds: z.array(idSchema).optional(),
        itemIds: z.array(idSchema).optional(),
        lessonIds: z.array(idSchema).optional(),
        skillIds: z.array(idSchema).optional(),
      }),
    }),
    table: spec.table,
    targets: fieldTargets,
    toProposed: toSetProposal,
  });
}
