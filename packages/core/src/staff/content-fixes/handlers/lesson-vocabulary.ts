import { type TransactionClient, sql } from "@zoonk/db";
import { z } from "zod";
import { lessonProblem } from "../_utils/lesson-problem";
import { type Json, type Resolution, changedFields, refuse } from "../_utils/resolved-change";
import {
  type FieldChange,
  defineFixHandler,
  fieldChangeSchema,
  idSchema,
  setFieldsSchema,
} from "./fix-handler";

type LessonRowModel = "LessonSentence" | "LessonWord";

const text = z.string().trim().min(1);
const texts = z.array(text);

const FIELDS = {
  LessonSentence: {
    distractors: texts,
    explanation: text,
    translation: text,
    translationDistractors: texts,
  },
  LessonWord: { distractors: texts, note: text.nullable(), translation: text },
} as const satisfies Record<LessonRowModel, Record<string, z.ZodType>>;

const ROW_KEY = { LessonSentence: "sentenceId", LessonWord: "wordId" } as const;

const KEY_SCHEMAS = {
  LessonSentence: z
    .strictObject({ lessonId: idSchema, sentenceId: idSchema })
    .transform((key) => ({ lessonId: key.lessonId, rowId: key.sentenceId })),
  LessonWord: z
    .strictObject({ lessonId: idSchema, wordId: idSchema })
    .transform((key) => ({ lessonId: key.lessonId, rowId: key.wordId })),
} as const;

const UNIT_KIND = { LessonSentence: "sentence", LessonWord: "word" } as const;

const RULES = {
  LessonSentence:
    "How one lesson uses a shared sentence: its translation, explanation and the tiles mixed in (distractors in the sentence's language, translationDistractors in the learner's). Name it by id: { lessonId, sentenceId }. A new translation copies to the lesson's spoken screens, and its word orders are written again.",
  LessonWord:
    "How one lesson uses a shared word: its translation, note and the wrong options shown with it (distractors, words in the word's language). Name it by id: { lessonId, wordId }.",
} as const satisfies Record<LessonRowModel, string>;

type LessonRowStored<Model extends LessonRowModel> = {
  fields: FieldChange[];
  id: string;
  lessonId: string;
  model: Model;
  op: "set";
};

async function loadLessonRow(
  db: TransactionClient,
  { id, lessonId, model }: { id: string; lessonId: string; model: LessonRowModel },
): Promise<Record<string, Json> | null> {
  if (model === "LessonWord") {
    return db.lessonWord.findUnique({
      select: { distractors: true, note: true, translation: true },
      where: { lessonId_wordId: { lessonId, wordId: id } },
    });
  }

  return db.lessonSentence.findUnique({
    select: {
      distractors: true,
      explanation: true,
      translation: true,
      translationDistractors: true,
    },
    where: { lessonId_sentenceId: { lessonId, sentenceId: id } },
  });
}

async function resolveLessonRow<Model extends LessonRowModel>(
  db: TransactionClient,
  {
    id,
    lessonId,
    model,
    set,
  }: { id: string; lessonId: string; model: Model; set: Record<string, Json> },
): Promise<Resolution<LessonRowStored<Model>>> {
  const parsed = z.strictObject(FIELDS[model]).partial().safeParse(set);

  if (!parsed.success) {
    return refuse(
      `A ${model} fix may set ${Object.keys(FIELDS[model]).join(", ")}, each nonblank: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}.`,
    );
  }

  const [row, lesson] = await Promise.all([
    loadLessonRow(db, { id, lessonId, model }),
    lessonProblem(db, lessonId),
  ]);

  if (!row) {
    return refuse(`No ${model} with lessonId ${lessonId} and ${ROW_KEY[model]} ${id}.`);
  }

  if (lesson) {
    return refuse(lesson);
  }

  const fields = changedFields(
    row,
    Object.entries(z.record(z.string(), z.json()).parse(parsed.data)),
  );

  if (fields.length === 0) {
    return refuse(`This ${model} already has these values.`);
  }

  return {
    effects: [],
    ok: true,
    stored: { fields, id, lessonId, model, op: "set" },
    unit: { id, kind: UNIT_KIND[model] },
  };
}

function writeData(fields: readonly FieldChange[]) {
  return z
    .object({
      distractors: z.array(z.string()).optional(),
      explanation: z.string().optional(),
      note: z.string().nullable().optional(),
      translation: z.string().optional(),
      translationDistractors: z.array(z.string()).optional(),
    })
    .parse(Object.fromEntries(fields.map((field) => [field.field, field.after])));
}

async function applyLessonRow(
  tx: TransactionClient,
  { fields, id, lessonId, model }: LessonRowStored<LessonRowModel>,
): Promise<void> {
  const data = writeData(fields);

  if (model === "LessonWord") {
    await tx.lessonWord.update({ data, where: { lessonId_wordId: { lessonId, wordId: id } } });
    return;
  }

  await tx.lessonSentence.update({
    data,
    where: { lessonId_sentenceId: { lessonId, sentenceId: id } },
  });
}

/** One row per lesson: `id` is the word or sentence it uses, and `lessonId` the lesson. */
function lessonRowHandler<Model extends LessonRowModel>(model: Model) {
  const key: z.ZodType<{ lessonId: string; rowId: string }> = KEY_SCHEMAS[model];

  return defineFixHandler({
    apply: (tx, stored) => applyLessonRow(tx, stored),
    lockIds: (stored) => [stored.lessonId],
    model,
    op: "set",
    proposal: {
      fields: Object.keys(FIELDS[model]),
      rules: RULES[model],
      schema: z
        .strictObject({ id: key, model: z.literal(model), set: setFieldsSchema })
        .transform(({ id, set }) => ({ id: id.rowId, lessonId: id.lessonId, model, set })),
    },
    resolve: (db, proposed) => resolveLessonRow(db, proposed),
    revert: (db, stored) =>
      resolveLessonRow(db, {
        ...stored,
        set: Object.fromEntries(stored.fields.map((field) => [field.field, field.before])),
      }),
    stored: z.object({
      fields: z.array(fieldChangeSchema).min(1),
      id: idSchema,
      lessonId: idSchema,
      model: z.literal(model),
      op: z.literal("set"),
    }),
    table: sql`library_lessons`,
    targets: (stored) =>
      stored.fields.map(({ field }) => ({
        id: stored.id,
        model,
        part: `${stored.lessonId}.${field}`,
      })),
    toProposed: (stored) => ({
      ...stored,
      set: Object.fromEntries(stored.fields.map((field) => [field.field, field.after])),
    }),
  });
}

export const lessonWordSet = lessonRowHandler("LessonWord");
export const lessonSentenceSet = lessonRowHandler("LessonSentence");
