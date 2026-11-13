import { type TransactionClient } from "@zoonk/db";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { z } from "zod";
import { CURRENT_STEPS } from "../../../library/lessons/lesson-versions";
import { type Resolution, changedFields, refuse } from "../_utils/resolved-change";
import { readFixClip } from "../_utils/vocabulary-voice";
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
import {
  TABLE,
  TEXT_FIELD,
  UNIT_KIND,
  type VocabularyModel,
  type VocabularyRow,
  loadRow,
} from "./vocabulary-row";

/** Text saved by a writer never has outer spaces, and a composed and decomposed accent read alike. */
function toStoredText(value: string): string {
  return value.trim().normalize("NFC");
}

async function findSameText(
  db: TransactionClient,
  {
    id,
    model,
    row,
    text,
  }: { id: string; model: VocabularyModel; row: VocabularyRow; text: string },
): Promise<string | null> {
  const where = {
    id: { not: id },
    organizationId: row.organizationId,
    targetLanguage: row.targetLanguage,
  };

  const found =
    model === "Word"
      ? await db.word.findFirst({ select: { id: true }, where: { ...where, word: text } })
      : await db.sentence.findFirst({ select: { id: true }, where: { ...where, sentence: text } });

  return found?.id ?? null;
}

/** A word no lesson links to is a word-bank tile, which lessons find by its text. */
async function isBankOnlyWord(db: TransactionClient, wordId: string): Promise<boolean> {
  const [lessonWords, steps] = await Promise.all([
    db.lessonWord.count({ where: { wordId } }),
    db.step.count({ where: { wordId, ...CURRENT_STEPS } }),
  ]);

  return lessonWords === 0 && steps === 0;
}

const setValuesSchema = z.strictObject({
  romanization: z.string().trim().min(1).nullable().optional(),
  sentence: z.string().optional(),
  word: z.string().optional(),
});

function valuesProblem({
  model,
  values,
}: {
  model: VocabularyModel;
  values: z.infer<typeof setValuesSchema>;
}): string | null {
  const other = model === "Word" ? "sentence" : "word";

  if (values[other] !== undefined) {
    return `A ${model} fix may set ${TEXT_FIELD[model]} and romanization.`;
  }

  const text = values[TEXT_FIELD[model]];

  return text !== undefined && toStoredText(text).length === 0
    ? `${TEXT_FIELD[model]} must be text that isn't blank.`
    : null;
}

async function textProblem(
  db: TransactionClient,
  {
    id,
    model,
    row,
    text,
  }: { id: string; model: VocabularyModel; row: VocabularyRow; text: string },
): Promise<string | null> {
  const existing = await findSameText(db, { id, model, row, text });

  if (existing) {
    return `${model} ${existing} already holds "${text}" in this language. Fix the lessons that show this one to use that row instead.`;
  }

  return model === "Word" && (await isBankOnlyWord(db, id))
    ? "This word is a word-bank tile that lessons find by its text, so its text can't change. Its romanization and clip can."
    : null;
}

type SetStored<Model extends VocabularyModel> = {
  fields: FieldChange[];
  id: string;
  model: Model;
  op: "set";
};

async function resolveSet<Model extends VocabularyModel>(
  db: TransactionClient,
  { id, model, set }: { id: string; model: Model; set: Record<string, unknown> },
): Promise<Resolution<SetStored<Model>>> {
  const parsed = setValuesSchema.safeParse(set);

  if (!parsed.success) {
    return refuse(`A ${model} fix may set ${TEXT_FIELD[model]} and romanization.`);
  }

  const problem = valuesProblem({ model, values: parsed.data });

  if (problem) {
    return refuse(problem);
  }

  const row = await loadRow(db, { id, model });

  if (!row) {
    return refuse(`No ${model} with id ${id}.`);
  }

  const sent = parsed.data[TEXT_FIELD[model]];
  const text = sent === undefined ? undefined : toStoredText(sent);

  const fields = changedFields({ [TEXT_FIELD[model]]: row.text, romanization: row.romanization }, [
    ...(text === undefined ? [] : [[TEXT_FIELD[model], text] as const]),
    ...(parsed.data.romanization === undefined
      ? []
      : [["romanization", parsed.data.romanization] as const]),
  ]);

  if (fields.length === 0) {
    return refuse(`${model} ${id} already has these values.`);
  }

  const collision =
    text !== undefined && text !== row.text
      ? await textProblem(db, { id, model, row, text })
      : null;

  if (collision) {
    return refuse(collision);
  }

  return {
    effects: [],
    ok: true,
    stored: { fields, id, model, op: "set" },
    unit: { id, kind: UNIT_KIND[model] },
  };
}

function setValues(fields: readonly FieldChange[]) {
  return new Map(fields.map((field) => [field.field, field.after]));
}

/**
 * New text takes the clip the fix voiced for it; a language with no voice keeps no clip, since an
 * old one would say the old text.
 */
async function clipData(
  tx: TransactionClient,
  { context, row, text }: { context: FixContext; row: VocabularyRow; text: string },
) {
  if (!isTTSSupportedLanguage(row.targetLanguage)) {
    return {
      audioGeneratedAt: null,
      audioModel: null,
      audioPromptVersion: null,
      audioRunId: null,
      audioUrl: null,
    };
  }

  return readFixClip(tx, { fixId: context.fixId, text });
}

async function applySet(
  tx: TransactionClient,
  { context, stored }: { context: FixContext; stored: SetStored<VocabularyModel> },
): Promise<void> {
  const values = setValues(stored.fields);
  const text = values.get(TEXT_FIELD[stored.model]);

  const romanization = values.has("romanization")
    ? { romanization: z.string().nullable().parse(values.get("romanization")) }
    : {};

  const row = await loadRow(tx, stored);

  if (!row) {
    throw new Error(`${stored.model} ${stored.id} is gone`);
  }

  const voiced = typeof text === "string" ? await clipData(tx, { context, row, text }) : {};

  if (stored.model === "Word") {
    await tx.word.update({
      data: { ...romanization, ...voiced, ...(typeof text === "string" ? { word: text } : {}) },
      where: { id: stored.id },
    });

    return;
  }

  await tx.sentence.update({
    data: { ...romanization, ...voiced, ...(typeof text === "string" ? { sentence: text } : {}) },
    where: { id: stored.id },
  });
}

/** A new text owes a new clip, so the text and its clip count as one target. */
function setTargets(stored: SetStored<VocabularyModel>) {
  const changesText = stored.fields.some((field) => field.field === TEXT_FIELD[stored.model]);

  return [
    ...fieldTargets(stored),
    ...(changesText ? [{ id: stored.id, model: stored.model, part: "audio" }] : []),
  ];
}

const RULES = {
  Sentence:
    "A shared sentence's text and romanization. New text can't match another sentence of the language. A new clip is voiced before it can be approved, and approving writes both. Every lesson showing it changes at once: its spoken screens copy the new text, and its word orders are written again.",
  Word: "A shared word's text and romanization. New text can't match another word of the language, and a word-bank tile (a word no lesson links to) keeps its text. A new clip is voiced before it can be approved, and approving writes both. Pronunciation guides stay unless the fix sets them (WordPronunciation).",
} as const satisfies Record<VocabularyModel, string>;

function vocabularySet<Model extends VocabularyModel>(model: Model) {
  return defineFixHandler({
    apply: (tx, stored, context) => applySet(tx, { context, stored }),
    model,
    op: "set",
    proposal: {
      fields: [TEXT_FIELD[model], "romanization"],
      rules: RULES[model],
      schema: z.strictObject({ id: idSchema, model: z.literal(model), set: setFieldsSchema }),
    },
    resolve: (db, proposed) => resolveSet(db, proposed),
    revert: (db, stored) => resolveSet(db, toRevertedSet(stored)),
    stored: z.object({
      fields: z.array(fieldChangeSchema).min(1),
      id: idSchema,
      model: z.literal(model),
      op: z.literal("set"),
    }),
    table: TABLE[model],
    targets: (stored) => setTargets(stored),
    toProposed: (stored) => toSetProposal(stored),
  });
}

export const wordSet = vocabularySet("Word");
export const sentenceSet = vocabularySet("Sentence");
