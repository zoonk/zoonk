import { type MindMapStructure, mindMapStructureSchema } from "@zoonk/ai/tasks/mind-maps/schema";
import { type TransactionClient, sql } from "@zoonk/db";
import { after as afterResponse } from "next/server";
import { z } from "zod";
import { startMindMapRedraw } from "../../../follow-ups/follow-up-starter";
import {
  type Json,
  PRIVATE_CONTENT,
  type Resolution,
  changedFields,
  refuse,
  toJson,
} from "../_utils/resolved-change";
import {
  type FieldChange,
  type FixContext,
  defineFixHandler,
  fieldChangeSchema,
  fieldTargets,
  idSchema,
  setFieldsSchema,
  toRevertedSet,
  toSetProposal,
} from "./fix-handler";

const MODEL = "ChapterMindMap";

const pictureSchema = z.object({
  imageHeight: z.int().nullable(),
  imageModel: z.string().nullable(),
  imageUrl: z.string().nullable(),
  imageWidth: z.int().nullable(),
  thumbnailUrl: z.string().nullable(),
});

type Picture = z.infer<typeof pictureSchema>;

const NO_PICTURE: Picture = {
  imageHeight: null,
  imageModel: null,
  imageUrl: null,
  imageWidth: null,
  thumbnailUrl: null,
};

/**
 * A new outline replaces the picture too. `after` is null when the outline owes a redraw, and a
 * revert puts the replaced picture back instead of drawing the old outline again.
 */
const pictureChangeSchema = z.object({ after: pictureSchema.nullable(), before: pictureSchema });

type Stored = {
  fields: FieldChange[];
  id: string;
  model: typeof MODEL;
  op: "set";
  picture: z.infer<typeof pictureChangeSchema>;
};

type Proposed = {
  id: string;
  model: typeof MODEL;
  /** Only a revert sends it: the picture its old outline had. */
  restoredPicture?: Picture;
  set: Record<string, Json>;
};

function drawingShape(map: MindMapStructure): string {
  return JSON.stringify([
    map.branches.map((branch) => [branch.drawing, branch.points.length]),
    map.comparison?.columns.map((column) => column.points.length) ?? null,
  ]);
}

async function loadMap(db: TransactionClient, id: string) {
  const row = await db.chapterMindMap.findUnique({
    include: { chapter: { select: { ownerId: true, visibility: true } } },
    where: { id },
  });

  if (!row) {
    return { problem: `No ${MODEL} with id ${id}.` };
  }

  if (row.chapter.ownerId || row.chapter.visibility !== "public") {
    return { problem: PRIVATE_CONTENT };
  }

  if (row.status === "running") {
    return { problem: "Wait for the current mind-map run before fixing its text." };
  }

  return { row };
}

async function resolve(
  db: TransactionClient,
  { id, restoredPicture, set }: Proposed,
): Promise<Resolution<Stored>> {
  const { problem, row } = await loadMap(db, id);

  if (problem !== undefined) {
    return refuse(problem);
  }

  const parsed = z.strictObject({ structure: mindMapStructureSchema }).safeParse(set);

  if (!parsed.success) {
    return refuse(parsed.error.message);
  }

  const before = mindMapStructureSchema.safeParse(row.structure);

  if (!before.success) {
    return refuse("The stored map must have a valid structure.");
  }

  if (drawingShape(before.data) !== drawingShape(parsed.data.structure)) {
    return refuse("Keep the map's structure and drawing descriptions.");
  }

  const fields = changedFields({ structure: toJson(row.structure) }, [
    ["structure", toJson(parsed.data.structure)],
  ]);

  if (fields.length === 0) {
    return refuse("These values are already stored.");
  }

  const picture = { after: restoredPicture ?? null, before: pictureSchema.parse(row) };

  return {
    effects: picture.after ? [] : [{ chapterId: row.chapterId, kind: "mindMapRedrawOwed" }],
    ok: true,
    stored: { fields, id, model: MODEL, op: "set", picture },
    unit: { id: row.chapterId, kind: "chapter" },
  };
}

async function apply(tx: TransactionClient, stored: Stored, context: FixContext): Promise<void> {
  const structure = stored.fields.find((field) => field.field === "structure")?.after;
  const restored = stored.picture.after;

  const row = await tx.chapterMindMap.update({
    data: {
      ...(restored ?? NO_PICTURE),
      redrawAttempts: 0,
      redrawOwedAt: restored ? null : context.now,
      runId: null,
      status: "completed",
      structure: mindMapStructureSchema.parse(structure),
    },
    where: { id: stored.id },
  });

  if (!restored) {
    afterResponse(() => startMindMapRedraw(row.chapterId));
  }
}

export const mindMapSet = defineFixHandler({
  apply,
  model: MODEL,
  op: "set",
  proposal: {
    fields: ["structure"],
    rules:
      "Non-running maps of public chapters only. Keep branches, points, comparison columns and drawing descriptions. The outline changes and a durable workflow redraws the picture; old readers keep their copy. A revert puts the old outline's picture back with no redraw.",
    schema: z.strictObject({ id: idSchema, model: z.literal(MODEL), set: setFieldsSchema }),
  },
  resolve,
  revert: (db, stored) =>
    resolve(db, { ...toRevertedSet(stored), restoredPicture: stored.picture.before }),
  stored: z.object({
    fields: z.array(fieldChangeSchema).min(1),
    id: idSchema,
    model: z.literal(MODEL),
    op: z.literal("set"),
    picture: pictureChangeSchema,
  }),
  table: sql`chapter_mind_maps`,
  targets: (stored) => [...fieldTargets(stored), { id: stored.id, model: MODEL, part: "picture" }],
  toProposed: (stored) => ({
    ...toSetProposal(stored),
    restoredPicture: stored.picture.after ?? undefined,
  }),
});
