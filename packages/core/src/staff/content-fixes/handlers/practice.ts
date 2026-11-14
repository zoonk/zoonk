import { type TransactionClient, sql } from "@zoonk/db";
import { z } from "zod";
import {
  type Json,
  NOT_CURRENT_SCREEN,
  PRIVATE_CONTENT,
  type Resolution,
  nonEmptyText,
  refuse,
} from "../_utils/resolved-change";
import { loadBankItem } from "./bank-item";
import {
  type FieldChange,
  defineFixHandler,
  fieldChangeSchema,
  fieldTargets,
  idSchema,
  setFieldsSchema,
  toRevertedSet,
  toSetProposal,
} from "./fix-handler";

type ExplanationStored = {
  fields: FieldChange[];
  id: string;
  model: "AnswerExplanation";
  op: "set";
};

async function resolveExplanation(
  db: TransactionClient,
  { id, set }: { id: string; set: Record<string, Json> },
): Promise<Resolution<ExplanationStored>> {
  const fields = Object.keys(set);

  if (fields.length !== 1 || fields[0] !== "explanation") {
    return refuse("An AnswerExplanation fix sets only explanation.");
  }

  const after = nonEmptyText(set.explanation);

  if (after === null) {
    return refuse("explanation must be text that isn't blank.");
  }

  const row = await db.answerExplanation.findUnique({
    select: {
      explanation: true,
      item: { select: { retiredAt: true, skill: { select: { visibility: true } } } },
      itemId: true,
      step: {
        select: {
          lesson: { select: { visibility: true } },
          lessonId: true,
          retiredAt: true,
          staged: true,
        },
      },
    },
    where: { id },
  });

  if (!row) {
    return refuse(`No AnswerExplanation with id ${id}.`);
  }

  if (row.explanation === after) {
    return refuse(`AnswerExplanation ${id} already has this explanation.`);
  }

  const stored = {
    fields: [{ after, before: row.explanation, field: "explanation" }],
    id,
    model: "AnswerExplanation" as const,
    op: "set" as const,
  };

  if (row.step) {
    if (row.step.retiredAt || row.step.staged) {
      return refuse(NOT_CURRENT_SCREEN);
    }

    return row.step.lesson.visibility === "private"
      ? refuse(PRIVATE_CONTENT)
      : { effects: [], ok: true, stored, unit: { id: row.step.lessonId, kind: "lesson" } };
  }

  if (!row.item || !row.itemId || row.item.retiredAt) {
    return refuse(
      "Only an explanation of a current screen or of a question still in practice can be fixed.",
    );
  }

  return row.item.skill.visibility === "private"
    ? refuse(PRIVATE_CONTENT)
    : { effects: [], ok: true, stored, unit: { id: row.itemId, kind: "item" } };
}

type RetirementStored<Op extends "retire" | "unretire"> = { id: string; model: "Item"; op: Op };

async function resolveItemRetire(
  db: TransactionClient,
  id: string,
): Promise<Resolution<RetirementStored<"retire">>> {
  const loaded = await loadBankItem(db, id);

  if (!loaded.ok) {
    return loaded;
  }

  return {
    effects: [{ itemId: id, kind: "itemRetired" }],
    ok: true,
    stored: { id, model: "Item", op: "retire" },
    unit: { id, kind: "item" },
  };
}

/** Reverts a retired question: it goes back to new practice only while it's still retired. */
async function resolveItemRestore(
  db: TransactionClient,
  id: string,
): Promise<Resolution<RetirementStored<"unretire">>> {
  const item = await db.item.findUnique({
    select: { retiredAt: true, skill: { select: { visibility: true } } },
    where: { id },
  });

  if (!item) {
    return refuse(`No Item with id ${id}.`);
  }

  if (item.skill.visibility === "private") {
    return refuse(PRIVATE_CONTENT);
  }

  if (!item.retiredAt) {
    return refuse(`Item ${id} is already back in practice.`);
  }

  return {
    effects: [{ itemId: id, kind: "itemRestored" }],
    ok: true,
    stored: { id, model: "Item", op: "unretire" },
    unit: { id, kind: "item" },
  };
}

function explanationOf(fields: readonly FieldChange[]): string {
  const text = fields.find((field) => field.field === "explanation")?.after;

  if (typeof text !== "string") {
    throw new TypeError("An explanation fix holds no text");
  }

  return text;
}

export const explanationSet = defineFixHandler({
  apply: async (tx, stored) => {
    await tx.answerExplanation.update({
      data: { explanation: explanationOf(stored.fields) },
      where: { id: stored.id },
    });
  },
  model: "AnswerExplanation",
  op: "set",
  proposal: {
    fields: ["explanation"],
    rules:
      "The explanation of a current screen's answer, or of a question still in practice. Fix it with { model, id, set: { explanation } }.",
    schema: z.strictObject({
      id: idSchema,
      model: z.literal("AnswerExplanation"),
      set: setFieldsSchema,
    }),
  },
  resolve: (db, proposed) => resolveExplanation(db, proposed),
  revert: (db, stored) => resolveExplanation(db, toRevertedSet(stored)),
  stored: z.object({
    fields: z.array(fieldChangeSchema).min(1),
    id: idSchema,
    model: z.literal("AnswerExplanation"),
    op: z.literal("set"),
  }),
  table: sql`answer_explanations`,
  targets: (stored) => fieldTargets(stored),
  toProposed: (stored) => toSetProposal(stored),
});

const retirementStored = <Op extends "retire" | "unretire">(op: Op) =>
  z.object({ id: idSchema, model: z.literal("Item"), op: z.literal(op) });

const retirementTarget = ({ id }: { id: string }) => [{ id, model: "Item", part: "retired" }];

export const itemRetire = defineFixHandler({
  apply: async (tx, stored, { now }) => {
    await tx.item.update({ data: { retiredAt: now }, where: { id: stored.id } });
  },
  model: "Item",
  op: "retire",
  planRoots: ({ id }) => ({ itemIds: [id] }),
  proposal: {
    rules:
      "{ model: 'Item', id, retire: true } takes a practice question out of new practice. Only one no current screen asks and that isn't in a set.",
    schema: z.strictObject({ id: idSchema, model: z.literal("Item"), retire: z.literal(true) }),
  },
  resolve: (db, proposed) => resolveItemRetire(db, proposed.id),
  revert: (db, stored) => resolveItemRestore(db, stored.id),
  stored: retirementStored("retire"),
  table: sql`items`,
  targets: retirementTarget,
  toProposed: ({ id }) => ({ id, model: "Item" as const, retire: true as const }),
});

export const itemUnretire = defineFixHandler({
  apply: async (tx, stored) => {
    await tx.item.update({ data: { retiredAt: null }, where: { id: stored.id } });
  },
  model: "Item",
  op: "unretire",
  planRoots: ({ id }) => ({ itemIds: [id] }),
  resolve: (db, proposed: { id: string }) => resolveItemRestore(db, proposed.id),
  revert: (db, stored) => resolveItemRetire(db, stored.id),
  stored: retirementStored("unretire"),
  table: sql`items`,
  targets: retirementTarget,
  toProposed: ({ id }) => ({ id }),
});
