import { type Sql, type TransactionClient } from "@zoonk/db";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { type Json, type Resolution, refuse } from "../_utils/resolved-change";

export const idSchema = uuidSchema();

export const fieldChangeSchema = z.object({ after: z.json(), before: z.json(), field: z.string() });

export type FieldChange = { after: Json; before: Json; field: string };

export const setFieldsSchema = z
  .record(z.string(), z.json())
  .refine((fields) => Object.keys(fields).length > 0, { message: "Set at least one field" })
  .meta({ description: "Each field's whole new value" });

/** One thing a stored change writes, such as a row's field, its retirement or its picture. */
export type FixTarget = { id: string; model: string; part: string };

export type PlanRoots = {
  skillIds?: string[];
  blueprintIds?: string[];
  chapterIds?: string[];
  itemIds?: string[];
  lessonIds?: string[];
};

export type FixContext = { fixId: string; now: Date };

type FixHandlerSpec<Model extends string, Proposed, Stored extends { id: string }> = {
  model: Model;
  /** The key a proposal carries (`set`, `retire`…) and the stored change's `op`. */
  op: string;
  /** Present for an operation the CLI may propose; an operation only a revert builds has none. */
  proposal?: { fields?: readonly string[]; rules: string; schema: z.ZodType<Proposed> };
  stored: z.ZodType<Stored>;
  /** Where the rows this handler writes live, so approval locks them before checking them. */
  table: Sql;
  resolve: (db: TransactionClient, proposed: Proposed) => Promise<Resolution<Stored>>;
  /** What approving prepares again, so a rule added later still applies to a waiting fix. */
  toProposed: (stored: Stored) => Proposed;
  revert: (db: TransactionClient, stored: Stored) => Promise<Resolution<unknown>>;
  apply: (tx: TransactionClient, stored: Stored, context: FixContext) => Promise<void>;
  targets: (stored: Stored) => FixTarget[];
  lockIds?: (stored: Stored) => string[];
  planRoots?: (stored: Stored) => PlanRoots;
};

export type FixHandler<Model extends string = string, Stored = unknown> = {
  apply: (tx: TransactionClient, stored: unknown, context: FixContext) => Promise<void>;
  lockRows: (stored: unknown) => { ids: string[]; table: Sql };
  model: Model;
  op: string;
  planRoots: (stored: unknown) => PlanRoots;
  propose: (db: TransactionClient, proposed: unknown) => Promise<Resolution<unknown>>;
  proposal: { fields: readonly string[]; rules: string } | null;
  reprepare: (db: TransactionClient, stored: unknown) => Promise<Resolution<unknown>>;
  revert: (db: TransactionClient, stored: unknown) => Promise<Resolution<unknown>>;
  stored: z.ZodType<Stored>;
  targets: (stored: unknown) => FixTarget[];
};

function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "change"}: ${issue.message}`)
    .join("; ");
}

/**
 * Each model's operation keeps its rules, writes and inverse in one place. The registry calls it
 * with stored changes it reads back from the database, so each call parses them with this
 * handler's own schema first.
 */
export function defineFixHandler<Model extends string, Proposed, Stored extends { id: string }>(
  spec: FixHandlerSpec<Model, Proposed, Stored>,
): FixHandler<Model, Stored> {
  const read = (stored: unknown) => spec.stored.parse(stored);

  return {
    apply: (tx, stored, context) => spec.apply(tx, read(stored), context),
    lockRows: (stored) => {
      const change = read(stored);
      return { ids: spec.lockIds?.(change) ?? [change.id], table: spec.table };
    },
    model: spec.model,
    op: spec.op,
    planRoots: (stored) => spec.planRoots?.(read(stored)) ?? {},
    proposal: spec.proposal
      ? { fields: spec.proposal.fields ?? [], rules: spec.proposal.rules }
      : null,
    propose: async (db, proposed) => {
      const parsed = spec.proposal?.schema.safeParse(proposed);

      if (!parsed) {
        return refuse(`${spec.model} has no ${spec.op} operation.`);
      }

      return parsed.success
        ? spec.resolve(db, parsed.data)
        : refuse(`${spec.model} ${spec.op}: ${describeIssues(parsed.error)}`);
    },
    reprepare: (db, stored) => spec.resolve(db, spec.toProposed(read(stored))),
    revert: (db, stored) => spec.revert(db, read(stored)),
    stored: spec.stored,
    targets: (stored) => spec.targets(read(stored)),
  };
}

export function fieldTargets({
  fields,
  id,
  model,
}: {
  fields: readonly { field: string }[];
  id: string;
  model: string;
}): FixTarget[] {
  return fields.map(({ field }) => ({ id, model, part: field }));
}

export function toSetProposal<Model extends string>({
  fields,
  id,
  model,
}: {
  fields: readonly FieldChange[];
  id: string;
  model: Model;
}) {
  return { id, model, set: Object.fromEntries(fields.map((field) => [field.field, field.after])) };
}

export function toRevertedSet<Model extends string>({
  fields,
  id,
  model,
}: {
  fields: readonly FieldChange[];
  id: string;
  model: Model;
}) {
  return { id, model, set: Object.fromEntries(fields.map((field) => [field.field, field.before])) };
}
