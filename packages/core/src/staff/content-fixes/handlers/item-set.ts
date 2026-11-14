import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { type TransactionClient, sql } from "@zoonk/db";
import { z } from "zod";
import { PRIVATE_CONTENT, type Resolution, refuse, toJson } from "../_utils/resolved-change";
import { defineFixHandler, idSchema } from "./fix-handler";
import { checkReplacement } from "./item-set-content-rules";

const questionSchema = z.object({ content: z.json(), id: idSchema });
const bodySchema = z.strictObject({ content: z.json(), questions: z.array(questionSchema).min(1) });

const storedSchema = z.object({
  after: bodySchema,
  before: bodySchema,
  blueprintId: idSchema.nullable(),
  copies: z.array(z.object({ id: idSchema, replacementId: idSchema })),
  id: idSchema,
  model: z.literal("ItemSet"),
  op: z.literal("replace"),
  replacementId: idSchema,
});

type Stored = z.infer<typeof storedSchema>;

type Proposed = {
  model: "ItemSet";
  id: string;
  replace: z.infer<typeof bodySchema>;
  identities?: Pick<Stored, "replacementId" | "copies">;
};

const privateRow = (row: { ownerId: string | null; visibility: string } | null) =>
  row && (row.ownerId || row.visibility !== "public");

async function resolve(db: TransactionClient, proposed: Proposed): Promise<Resolution<Stored>> {
  const set = await db.itemSet.findUnique({
    include: {
      examBlueprint: true,
      items: {
        include: { examBlueprint: true, mediaAsset: true, skill: true, source: true },
        orderBy: { setPosition: "asc" },
      },
      mediaAsset: true,
    },
    where: { id: proposed.id },
  });

  if (!set || set.items.length === 0) {
    return refuse("An ItemSet must exist and have questions.");
  }

  if (
    privateRow(set.examBlueprint) ||
    privateRow(set.mediaAsset) ||
    set.items.some(
      (item) =>
        privateRow(item.skill) ||
        privateRow(item.source) ||
        privateRow(item.mediaAsset) ||
        privateRow(item.examBlueprint),
    )
  ) {
    return refuse(PRIVATE_CONTENT);
  }

  if (set.items.some((item) => item.retiredAt !== null || item.skill.mergedIntoId)) {
    return refuse("All questions must be current and their skills unmerged.");
  }

  const screens = await db.step.count({
    where: { itemId: { in: set.items.map((item) => item.id) } },
  });

  if (screens) {
    return refuse("A lesson screen's question cannot be replaced as an ItemSet.");
  }

  const checked = checkReplacement(set, proposed.replace);

  if ("ok" in checked) {
    return checked;
  }

  const { content, questions } = checked;

  const before = {
    content: toJson(set.content),
    questions: set.items.map((item) => ({ content: toJson(item.content), id: item.id })),
  };

  const after = { content, questions };

  if (isDeepStrictEqual(before, after)) {
    return refuse("This set already has these values.");
  }

  const identities = proposed.identities ?? {
    copies: set.items.map((item) => ({ id: item.id, replacementId: randomUUID() })),
    replacementId: randomUUID(),
  };

  return {
    effects: [{ id: set.id, kind: "itemSetReplaced", replacementId: identities.replacementId }],
    ok: true,
    stored: {
      after,
      before,
      blueprintId: set.examBlueprintId,
      id: set.id,
      model: "ItemSet",
      op: "replace",
      ...identities,
    },
    unit: { id: set.id, kind: "itemSet" },
  };
}

const restoreSchema = storedSchema.omit({ op: true }).extend({ op: z.literal("restore") });

async function restore(
  db: TransactionClient,
  stored: Stored,
): Promise<Resolution<z.infer<typeof restoreSchema>>> {
  const [replacement, old, publicOriginal] = await Promise.all([
    db.itemSet.findUnique({
      include: { items: { orderBy: { setPosition: "asc" } } },
      where: { id: stored.replacementId },
    }),
    db.itemSet.findUnique({
      include: { items: { orderBy: { setPosition: "asc" } } },
      where: { id: stored.id },
    }),
    db.itemSet.count({
      where: {
        AND: [
          {
            OR: [
              { examBlueprintId: null },
              { examBlueprint: { ownerId: null, visibility: "public" } },
            ],
          },
          { OR: [{ mediaAssetId: null }, { mediaAsset: { ownerId: null, visibility: "public" } }] },
          {
            items: {
              every: {
                AND: [
                  { OR: [{ sourceId: null }, { source: { ownerId: null, visibility: "public" } }] },
                  {
                    OR: [
                      { mediaAssetId: null },
                      { mediaAsset: { ownerId: null, visibility: "public" } },
                    ],
                  },
                ],
                skill: { mergedIntoId: null, ownerId: null, visibility: "public" },
              },
            },
          },
        ],
        id: stored.id,
      },
    }),
  ]);

  if (!publicOriginal) {
    return refuse(PRIVATE_CONTENT);
  }

  if (
    !replacement ||
    !old ||
    !isDeepStrictEqual(replacement.content, stored.after.content) ||
    !isDeepStrictEqual(old.content, stored.before.content) ||
    old.items.length !== stored.before.questions.length ||
    replacement.items.length !== stored.after.questions.length ||
    old.items.some(
      (item, index) =>
        item.retiredAt === null ||
        item.id !== stored.before.questions[index]?.id ||
        !isDeepStrictEqual(item.content, stored.before.questions[index]?.content),
    ) ||
    replacement.items.some(
      (item, index) =>
        item.retiredAt !== null ||
        item.id !== stored.copies[index]?.replacementId ||
        !isDeepStrictEqual(item.content, stored.after.questions[index]?.content),
    )
  ) {
    return refuse("The original or replacement set changed; it cannot be reverted.");
  }

  return {
    effects: [{ id: stored.id, kind: "itemSetRestored" }],
    ok: true,
    stored: { ...stored, op: "restore" },
    unit: { id: stored.id, kind: "itemSet" },
  };
}

const targets = (stored: Stored | z.infer<typeof restoreSchema>) => [
  { id: stored.id, model: "ItemSet", part: "replacement" },
  ...stored.copies.flatMap((copy) =>
    [copy.id, copy.replacementId].map((id) => ({ id, model: "Item", part: "retired" })),
  ),
];
export const itemSetReplace = defineFixHandler({
  apply: async (tx, stored, { now }) => {
    const original = await tx.itemSet.findUniqueOrThrow({ where: { id: stored.id } });

    await tx.itemSet.create({
      data: {
        ...original,
        content: z.record(z.string(), z.json()).parse(stored.after.content),
        createdAt: now,
        id: stored.replacementId,
        updatedAt: now,
      },
    });

    for (const copy of stored.copies) {
      // oxlint-disable-next-line no-await-in-loop -- copies share the approval transaction
      const item = await tx.item.findUniqueOrThrow({ where: { id: copy.id } });
      const question = stored.after.questions.find((row) => row.id === copy.id);

      if (!question) {
        throw new Error("Missing prepared question.");
      }
      // oxlint-disable-next-line no-await-in-loop -- copies share the approval transaction
      await tx.item.create({
        data: {
          ...item,
          content: z.record(z.string(), z.json()).parse(question.content),
          createdAt: now,
          id: copy.replacementId,
          setId: stored.replacementId,
          updatedAt: now,
        },
      });
    }

    await tx.item.updateMany({
      data: { retiredAt: now },
      where: { id: { in: stored.copies.map((copy) => copy.id) } },
    });
  },
  lockIds: (stored) => stored.copies.flatMap((copy) => [copy.id, copy.replacementId]),
  model: "ItemSet",
  op: "replace",
  planRoots: (stored) => ({
    blueprintIds: stored.blueprintId ? [stored.blueprintId] : [],
    itemIds: stored.copies.map((copy) => copy.id),
  }),
  proposal: {
    fields: ["content", "questions"],
    rules:
      "replace: { content, questions: [{ id, content }] }. Whole passage and all questions together, public unmerged materials only. Always copies the set and retires its old questions, keeping old passages and grading for open sessions. Audio keeps its transcript and recording.",
    schema: z.strictObject({ id: idSchema, model: z.literal("ItemSet"), replace: bodySchema }),
  },
  resolve,
  revert: restore,
  stored: storedSchema,
  table: sql`items`,
  targets,
  toProposed: (stored): Proposed => ({
    id: stored.id,
    identities: stored,
    model: "ItemSet",
    replace: stored.after,
  }),
});

export const itemSetRestore = defineFixHandler({
  apply: async (tx, stored, { now }) => {
    await tx.item.updateMany({
      data: { retiredAt: null },
      where: { id: { in: stored.copies.map((copy) => copy.id) } },
    });

    await tx.item.updateMany({
      data: { retiredAt: now },
      where: { id: { in: stored.copies.map((copy) => copy.replacementId) } },
    });
  },
  lockIds: (stored) => stored.copies.flatMap((copy) => [copy.id, copy.replacementId]),
  model: "ItemSet",
  op: "restore",
  planRoots: (stored) => ({
    blueprintIds: stored.blueprintId ? [stored.blueprintId] : [],
    itemIds: stored.copies.flatMap((copy) => [copy.id, copy.replacementId]),
  }),
  resolve: (db, stored: Stored) => restore(db, stored),
  revert: async () => refuse("Propose a new replacement to correct this set again."),
  stored: restoreSchema,
  table: sql`items`,
  targets,
  toProposed: (stored): Stored => ({ ...stored, op: "replace" }),
});
