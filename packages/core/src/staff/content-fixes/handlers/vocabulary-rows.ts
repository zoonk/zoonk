import { type TransactionClient } from "@zoonk/db";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { z } from "zod";
import { type Resolution, changedFields, refuse } from "../_utils/resolved-change";
import { readFixClip } from "../_utils/vocabulary-voice";
import { findLessonsWithWordTiles } from "../_utils/word-tile-lessons";
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
  type Clip,
  TABLE,
  TEXT_FIELD,
  UNIT_KIND,
  type VocabularyModel,
  type VocabularyRow,
  clipSchema,
  loadClip,
  loadRow,
  toClipData,
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

/**
 * Tiles find their word's row by their own text, ignoring case, so other text leaves those lessons'
 * tiles without its clip and romanization.
 */
async function tilesProblem(
  db: TransactionClient,
  { row, text }: { row: VocabularyRow; text: string },
): Promise<string | null> {
  if (text.toLowerCase() === row.text.toLowerCase()) {
    return null;
  }

  const lessons = await findLessonsWithWordTiles(db, {
    targetLanguage: row.targetLanguage,
    word: row.text,
  });

  const count = new Set(lessons.map((lesson) => lesson.lessonId)).size;

  if (count === 0) {
    return null;
  }

  const finds = count === 1 ? "1 lesson finds" : `${count} lessons find`;

  return `${finds} this word by its text in reading, fill-in-the-blank or distractor tiles, so only its case can change. Fix those lessons' tiles first. Its romanization and clip can change now.`;
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

  return model === "Word" ? tilesProblem(db, { row, text }) : null;
}

/**
 * New text replaces the clip too. `after` is null for the clip the fix voices for it, and a revert
 * puts the replaced clip back instead of recording the old text again.
 */
const clipChangeSchema = z.object({ after: clipSchema.nullable(), before: clipSchema });

type SetStored<Model extends VocabularyModel> = {
  clip?: z.infer<typeof clipChangeSchema>;
  fields: FieldChange[];
  id: string;
  model: Model;
  op: "set";
};

type SetProposed<Model extends VocabularyModel> = {
  /** Only a revert sends it: the clip its old text had. */
  restoredClip?: Clip;
  id: string;
  model: Model;
  set: Record<string, unknown>;
};

async function resolveSet<Model extends VocabularyModel>(
  db: TransactionClient,
  { id, model, restoredClip, set }: SetProposed<Model>,
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

  const changesText = text !== undefined && text !== row.text;
  const collision = changesText ? await textProblem(db, { id, model, row, text }) : null;

  if (collision) {
    return refuse(collision);
  }

  const before = changesText ? await loadClip(db, { id, model }) : null;
  const clip = before ? { clip: { after: restoredClip ?? null, before } } : {};

  return {
    effects: [],
    ok: true,
    stored: { ...clip, fields, id, model, op: "set" },
    unit: { id, kind: UNIT_KIND[model] },
  };
}

function setValues(fields: readonly FieldChange[]) {
  return new Map(fields.map((field) => [field.field, field.after]));
}

/**
 * New text takes the clip the fix voiced for it, or the one a revert puts back; a language with no
 * voice keeps no clip, since an old one would say the old text.
 */
async function clipData(
  tx: TransactionClient,
  {
    after,
    context,
    row,
    text,
  }: { after: Clip | null; context: FixContext; row: VocabularyRow; text: string },
) {
  if (after) {
    return toClipData(after);
  }

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

  const voiced =
    typeof text === "string" && stored.clip
      ? await clipData(tx, { after: stored.clip.after, context, row, text })
      : {};

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

function setTargets(stored: SetStored<VocabularyModel>) {
  return [
    ...fieldTargets(stored),
    ...(stored.clip ? [{ id: stored.id, model: stored.model, part: "audio" }] : []),
  ];
}

const RULES = {
  Sentence:
    "A shared sentence's text and romanization. New text can't match another sentence of the language. A new clip is voiced before it can be approved, and approving writes both; a revert puts the old text's clip back. Every lesson showing it changes at once: its spoken screens copy the new text, and its word orders are written again.",
  Word: "A shared word's text and romanization. New text can't match another word of the language, and only its case can change while lessons' reading, fill-in-the-blank or distractor tiles find it by its text: fix those tiles first. A new clip is voiced before it can be approved, and approving writes both; a revert puts the old text's clip back. Pronunciation guides stay unless the fix sets them (WordPronunciation).",
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
    resolve: (db, proposed: SetProposed<Model>) => resolveSet(db, proposed),
    revert: (db, stored) =>
      resolveSet(db, { ...toRevertedSet(stored), restoredClip: stored.clip?.before }),
    stored: z.object({
      clip: clipChangeSchema.optional(),
      fields: z.array(fieldChangeSchema).min(1),
      id: idSchema,
      model: z.literal(model),
      op: z.literal("set"),
    }),
    table: TABLE[model],
    targets: (stored) => setTargets(stored),
    toProposed: (stored) => ({
      ...toSetProposal(stored),
      restoredClip: stored.clip?.after ?? undefined,
    }),
  });
}

export const wordSet = vocabularySet("Word");
export const sentenceSet = vocabularySet("Sentence");
