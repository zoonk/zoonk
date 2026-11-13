import { type TransactionClient } from "@zoonk/db";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { z } from "zod";
import { type Resolution, refuse } from "../_utils/resolved-change";
import { readFixClip } from "../_utils/vocabulary-voice";
import { type FixContext, defineFixHandler, idSchema } from "./fix-handler";
import { TABLE, UNIT_KIND, type VocabularyModel, loadRow } from "./vocabulary-row";

type RevoiceStored<Model extends VocabularyModel> = {
  id: string;
  model: Model;
  op: "revoice";
  text: string;
};

async function resolveRevoice<Model extends VocabularyModel>(
  db: TransactionClient,
  { id, model }: { id: string; model: Model },
): Promise<Resolution<RevoiceStored<Model>>> {
  const row = await loadRow(db, { id, model });

  if (!row) {
    return refuse(`No ${model} with id ${id}.`);
  }

  if (!isTTSSupportedLanguage(row.targetLanguage)) {
    return refuse(`Zoonk has no voice for ${row.targetLanguage}, so there's no clip to record.`);
  }

  return {
    effects: [],
    ok: true,
    stored: { id, model, op: "revoice", text: row.text },
    unit: { id, kind: UNIT_KIND[model] },
  };
}

async function applyRevoice(
  tx: TransactionClient,
  { context, stored }: { context: FixContext; stored: RevoiceStored<VocabularyModel> },
): Promise<void> {
  const data = await readFixClip(tx, { fixId: context.fixId, text: stored.text });

  await (stored.model === "Word"
    ? tx.word.update({ data, where: { id: stored.id } })
    : tx.sentence.update({ data, where: { id: stored.id } }));
}

function vocabularyRevoice<Model extends VocabularyModel>(model: Model) {
  return defineFixHandler({
    apply: (tx, stored, context) => applyRevoice(tx, { context, stored }),
    model,
    op: "revoice",
    proposal: {
      rules: `{ revoice: true } records a new clip of a ${model.toLowerCase()} whose text is right but whose clip is wrong. The clip is voiced before it can be approved, and the approver hears it.`,
      schema: z.strictObject({ id: idSchema, model: z.literal(model), revoice: z.literal(true) }),
    },
    resolve: (db, proposed) => resolveRevoice(db, proposed),
    revert: (db, stored) => resolveRevoice(db, stored),
    stored: z.object({
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

export const wordRevoice = vocabularyRevoice("Word");
export const sentenceRevoice = vocabularyRevoice("Sentence");
