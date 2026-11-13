import { isDeepStrictEqual } from "node:util";
import { type TransactionClient, sql } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { z } from "zod";
import {
  type Json,
  PRIVATE_CONTENT,
  type Resolution,
  refuse,
  toJson,
} from "../_utils/resolved-change";
import { type ContentFixEffect } from "../contract";
import { loadBankItem } from "./bank-item";
import {
  type FieldChange,
  type FixTarget,
  defineFixHandler,
  fieldChangeSchema,
  idSchema,
  setFieldsSchema,
  toRevertedSet,
  toSetProposal,
} from "./fix-handler";
import { checkItemContent } from "./item-content-rules";

const ITEMS = sql`items`;

const contentSchema = z
  .strictObject({ content: z.json() })
  .meta({ description: "The question's whole content, as its format stores it" });

type SetStored = { fields: FieldChange[]; id: string; model: "Item"; op: "set" };

type ReplaceStored = Omit<SetStored, "op"> & { op: "replace"; replacementId: string };

function contentChange({ after, before }: { after: Json; before: unknown }): FieldChange[] {
  return [{ after, before: toJson(before), field: "content" }];
}

function contentOf(fields: readonly FieldChange[]) {
  const content = fields.find((field) => field.field === "content")?.after;

  if (!isJsonObject(content)) {
    throw new Error("A question fix holds no content object");
  }

  return content;
}

async function resolveItemSet(
  db: TransactionClient,
  { id, set }: { id: string; set: Record<string, Json> },
): Promise<Resolution<SetStored>> {
  if (!isDeepStrictEqual(Object.keys(set), ["content"])) {
    return refuse("An Item fix sets only content, the whole question as JSON.");
  }

  const loaded = await loadBankItem(db, id);

  if (!loaded.ok) {
    return loaded;
  }

  const checked = checkItemContent({ inPlace: true, item: loaded.item, sent: set.content ?? null });

  if ("ok" in checked) {
    return checked;
  }

  const explanations = await db.answerExplanation.count({ where: { itemId: id } });

  const effects: ContentFixEffect[] =
    explanations > 0 ? [{ count: explanations, itemId: id, kind: "itemExplanationsDeleted" }] : [];

  return {
    effects,
    ok: true,
    stored: {
      fields: contentChange({ after: checked.after, before: loaded.item.content }),
      id,
      model: "Item",
      op: "set",
    },
    unit: { id, kind: "item" },
  };
}

/** Ids come from the database, as its own rows' do, so they sort by when they were made. */
async function newItemId(db: TransactionClient): Promise<string> {
  const [row] = await db.$queryRaw<{ id: string }[]>`SELECT uuidv7()::text AS id`;

  if (!row) {
    throw new Error("The database made no id");
  }

  return row.id;
}

async function replacementProblem(
  db: TransactionClient,
  replacementId: string | undefined,
): Promise<string | null> {
  const taken = replacementId ? await db.item.count({ where: { id: replacementId } }) : 0;

  return taken > 0 ? `Item ${replacementId ?? ""} already replaced this question.` : null;
}

/**
 * The replacement's id is chosen when the fix is proposed, so approving prepares the same change
 * again and can tell whether anything moved.
 */
async function resolveItemReplace(
  db: TransactionClient,
  {
    id,
    replace,
    replacementId,
  }: { id: string; replace: { content: Json }; replacementId?: string },
): Promise<Resolution<ReplaceStored>> {
  const loaded = await loadBankItem(db, id);

  if (!loaded.ok) {
    return loaded;
  }

  const checked = checkItemContent({ inPlace: false, item: loaded.item, sent: replace.content });

  if ("ok" in checked) {
    return checked;
  }

  const taken = await replacementProblem(db, replacementId);

  if (taken) {
    return refuse(taken);
  }

  const newId = replacementId ?? (await newItemId(db));

  return {
    effects: [{ itemId: id, kind: "itemReplaced", replacementId: newId }],
    ok: true,
    stored: {
      fields: contentChange({ after: checked.after, before: loaded.item.content }),
      id,
      model: "Item",
      op: "replace",
      replacementId: newId,
    },
    unit: { id, kind: "item" },
  };
}

type RestoreStored = { id: string; model: "Item"; op: "restore"; retires: string };

/**
 * Undoes a replacement: the original goes back to practice and its replacement leaves it, only
 * while the replacement is still the question practice asks.
 */
async function resolveItemRestore(
  db: TransactionClient,
  { id, retires }: { id: string; retires: string },
): Promise<Resolution<RestoreStored>> {
  const items = await db.item.findMany({
    select: { id: true, retiredAt: true, skill: { select: { visibility: true } } },
    where: { id: { in: [id, retires] } },
  });

  const original = items.find((item) => item.id === id);
  const replacement = items.find((item) => item.id === retires);

  if (!original || !replacement) {
    return refuse(`No Item with id ${original ? retires : id}.`);
  }

  if (original.skill.visibility === "private") {
    return refuse(PRIVATE_CONTENT);
  }

  if (!original.retiredAt) {
    return refuse(`Item ${id} is already back in practice.`);
  }

  if (replacement.retiredAt) {
    return refuse(`Item ${retires} left practice since; another correction replaced it.`);
  }

  return {
    effects: [
      { itemId: id, kind: "itemRestored" },
      { itemId: retires, kind: "itemRetired" },
    ],
    ok: true,
    stored: { id, model: "Item", op: "restore", retires },
    unit: { id, kind: "item" },
  };
}

function itemTargets(ids: readonly string[]): FixTarget[] {
  return ids.flatMap((id) => [
    { id, model: "Item", part: "content" },
    { id, model: "Item", part: "retired" },
  ]);
}

export const itemSet = defineFixHandler({
  apply: async (tx, stored) => {
    await tx.item.update({ data: { content: contentOf(stored.fields) }, where: { id: stored.id } });
    await tx.answerExplanation.deleteMany({ where: { itemId: stored.id } });
  },
  model: "Item",
  op: "set",
  planRoots: ({ id }) => ({ itemIds: [id] }),
  proposal: {
    fields: ["content"],
    rules:
      "Changes a multipleChoice or trueFalse practice question's words in place: which answers are right, how many to pick, the options' count and order, its picture and visual stay. Its saved answer explanations are deleted. Any other change is a replace.",
    schema: z.strictObject({ id: idSchema, model: z.literal("Item"), set: setFieldsSchema }),
  },
  resolve: (db, proposed) => resolveItemSet(db, proposed),
  revert: (db, stored) => resolveItemSet(db, toRevertedSet(stored)),
  stored: z.object({
    fields: z.array(fieldChangeSchema).min(1),
    id: idSchema,
    model: z.literal("Item"),
    op: z.literal("set"),
  }),
  table: ITEMS,
  targets: ({ id }) => [{ id, model: "Item", part: "content" }],
  toProposed: (stored) => toSetProposal(stored),
});

export const itemReplace = defineFixHandler({
  apply: async (tx, stored, { fixId, now }) => {
    const original = await tx.item.findUniqueOrThrow({ where: { id: stored.id } });

    await tx.item.create({
      data: {
        content: contentOf(stored.fields),
        difficulty: original.difficulty,
        examBlueprintId: original.examBlueprintId,
        field: original.field,
        format: original.format,
        id: stored.replacementId,
        language: original.language,
        mediaAssetId: original.mediaAssetId,
        model: "content-fix",
        promptVersion: "content-fix",
        runId: fixId,
        skillId: original.skillId,
        sourceCitation: original.sourceCitation,
        sourceHash: original.sourceHash,
        sourceId: original.sourceId,
      },
    });

    await tx.item.update({ data: { retiredAt: now }, where: { id: stored.id } });
  },
  model: "Item",
  op: "replace",
  planRoots: ({ id }) => ({ itemIds: [id] }),
  proposal: {
    fields: ["content"],
    rules:
      "{ model: 'Item', id, replace: { content } } retires a practice question and asks a corrected copy with the same format, skill and picture: for a new right answer, or for any question graded by its words (typed, spoken, essay, numeric…). Sessions that already hold the old one keep grading it, its history stays with it, and its mistakes no longer replay.",
    schema: z.strictObject({ id: idSchema, model: z.literal("Item"), replace: contentSchema }),
  },
  resolve: (db, proposed: { id: string; replace: { content: Json }; replacementId?: string }) =>
    resolveItemReplace(db, proposed),
  revert: (db, stored) => resolveItemRestore(db, { id: stored.id, retires: stored.replacementId }),
  stored: z.object({
    fields: z.array(fieldChangeSchema).min(1),
    id: idSchema,
    model: z.literal("Item"),
    op: z.literal("replace"),
    replacementId: idSchema,
  }),
  table: ITEMS,
  targets: ({ id, replacementId }) => [
    { id, model: "Item", part: "retired" },
    ...itemTargets([replacementId]),
  ],
  toProposed: ({ fields, id, replacementId }) => ({
    id,
    replace: { content: contentOf(fields) },
    replacementId,
  }),
});

export const itemRestore = defineFixHandler({
  apply: async (tx, stored, { now }) => {
    await tx.item.update({ data: { retiredAt: null }, where: { id: stored.id } });
    await tx.item.update({ data: { retiredAt: now }, where: { id: stored.retires } });
  },
  lockIds: ({ id, retires }) => [id, retires],
  model: "Item",
  op: "restore",
  planRoots: ({ id, retires }) => ({ itemIds: [id, retires] }),
  resolve: (db, proposed: { id: string; retires: string }) => resolveItemRestore(db, proposed),
  revert: (db, stored) => resolveItemRestore(db, { id: stored.retires, retires: stored.id }),
  stored: z.object({
    id: idSchema,
    model: z.literal("Item"),
    op: z.literal("restore"),
    retires: idSchema,
  }),
  table: ITEMS,
  targets: ({ id, retires }) => itemTargets([id, retires]),
  toProposed: ({ id, retires }) => ({ id, retires }),
});
