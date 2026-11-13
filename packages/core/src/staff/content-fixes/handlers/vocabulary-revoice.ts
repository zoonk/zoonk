import { isDeepStrictEqual } from "node:util";
import { type TransactionClient } from "@zoonk/db";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { z } from "zod";
import { type Resolution, refuse } from "../_utils/resolved-change";
import { readFixClip } from "../_utils/vocabulary-voice";
import { type FixContext, defineFixHandler, idSchema } from "./fix-handler";
import {
  type Clip,
  TABLE,
  UNIT_KIND,
  type VocabularyModel,
  clipSchema,
  loadClip,
  loadRow,
  toClipData,
} from "./vocabulary-row";

type RevoiceStored<Model extends VocabularyModel> = {
  before: Clip;
  id: string;
  model: Model;
  op: "revoice";
  text: string;
};

type RestoreStored<Model extends VocabularyModel> = Omit<RevoiceStored<Model>, "op"> & {
  after: Clip;
  op: "restoreClip";
};

type RestoreProposed<Model extends VocabularyModel> = {
  clip: Clip;
  id: string;
  model: Model;
  text: string;
};

async function loadVoicedRow(
  db: TransactionClient,
  { id, model }: { id: string; model: VocabularyModel },
): Promise<{ problem: string } | { clip: Clip; text: string }> {
  const [row, clip] = await Promise.all([loadRow(db, { id, model }), loadClip(db, { id, model })]);

  if (!row || !clip) {
    return { problem: `No ${model} with id ${id}.` };
  }

  if (!isTTSSupportedLanguage(row.targetLanguage)) {
    return {
      problem: `Zoonk has no voice for ${row.targetLanguage}, so there's no clip to record.`,
    };
  }

  return { clip, text: row.text };
}

async function resolveRevoice<Model extends VocabularyModel>(
  db: TransactionClient,
  { id, model }: { id: string; model: Model },
): Promise<Resolution<RevoiceStored<Model>>> {
  const row = await loadVoicedRow(db, { id, model });

  if ("problem" in row) {
    return refuse(row.problem);
  }

  return {
    effects: [],
    ok: true,
    stored: { before: row.clip, id, model, op: "revoice", text: row.text },
    unit: { id, kind: UNIT_KIND[model] },
  };
}

/** A clip says the text it was recorded from, so it goes back only onto that same text. */
async function resolveRestore<Model extends VocabularyModel>(
  db: TransactionClient,
  { clip, id, model, text }: RestoreProposed<Model>,
): Promise<Resolution<RestoreStored<Model>>> {
  const row = await loadVoicedRow(db, { id, model });

  if ("problem" in row) {
    return refuse(row.problem);
  }

  if (row.text !== text) {
    return refuse(`${model} ${id}'s text changed since, so its old clip no longer says it.`);
  }

  if (isDeepStrictEqual(row.clip, clip)) {
    return refuse(`${model} ${id} already has this clip.`);
  }

  return {
    effects: [],
    ok: true,
    stored: { after: clip, before: row.clip, id, model, op: "restoreClip", text },
    unit: { id, kind: UNIT_KIND[model] },
  };
}

function writeClip(
  tx: TransactionClient,
  { data, id, model }: { data: Record<string, Date | string | null>; id: string; model: string },
) {
  return model === "Word"
    ? tx.word.update({ data, where: { id } })
    : tx.sentence.update({ data, where: { id } });
}

async function applyRevoice(
  tx: TransactionClient,
  { context, stored }: { context: FixContext; stored: RevoiceStored<VocabularyModel> },
): Promise<void> {
  const data = await readFixClip(tx, { fixId: context.fixId, text: stored.text });
  await writeClip(tx, { data, id: stored.id, model: stored.model });
}

function vocabularyRevoice<Model extends VocabularyModel>(model: Model) {
  return defineFixHandler({
    apply: (tx, stored, context) => applyRevoice(tx, { context, stored }),
    model,
    op: "revoice",
    proposal: {
      rules: `{ revoice: true } records a new clip of a ${model.toLowerCase()} whose text is right but whose clip is wrong. The clip is voiced before it can be approved, and the approver hears it. A revert puts the old clip back.`,
      schema: z.strictObject({ id: idSchema, model: z.literal(model), revoice: z.literal(true) }),
    },
    resolve: (db, proposed) => resolveRevoice(db, proposed),
    revert: (db, stored) =>
      resolveRestore(db, { clip: stored.before, id: stored.id, model, text: stored.text }),
    stored: z.object({
      before: clipSchema,
      id: idSchema,
      model: z.literal(model),
      op: z.literal("revoice"),
      text: z.string(),
    }),
    table: TABLE[model],
    targets: (stored) => [{ id: stored.id, model: stored.model, part: "audio" }],
    toProposed: (stored) => ({ id: stored.id, model: stored.model, revoice: true as const }),
  });
}

/** Only a revert builds this: it puts back the clip a re-recording replaced. */
function vocabularyRestoreClip<Model extends VocabularyModel>(model: Model) {
  return defineFixHandler({
    apply: async (tx, stored) => {
      await writeClip(tx, { data: toClipData(stored.after), id: stored.id, model: stored.model });
    },
    model,
    op: "restoreClip",
    resolve: (db, proposed: RestoreProposed<Model>) => resolveRestore(db, proposed),
    revert: (db, stored) =>
      resolveRestore(db, { clip: stored.before, id: stored.id, model, text: stored.text }),
    stored: z.object({
      after: clipSchema,
      before: clipSchema,
      id: idSchema,
      model: z.literal(model),
      op: z.literal("restoreClip"),
      text: z.string(),
    }),
    table: TABLE[model],
    targets: (stored) => [{ id: stored.id, model: stored.model, part: "audio" }],
    toProposed: (stored) => ({
      clip: stored.after,
      id: stored.id,
      model: stored.model,
      text: stored.text,
    }),
  });
}

export const wordRevoice = vocabularyRevoice("Word");
export const sentenceRevoice = vocabularyRevoice("Sentence");
export const wordRestoreClip = vocabularyRestoreClip("Word");
export const sentenceRestoreClip = vocabularyRestoreClip("Sentence");
