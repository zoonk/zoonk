import { isDeepStrictEqual } from "node:util";
import { type TransactionClient, sql } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { normalizeString } from "@zoonk/utils/string";
import { z } from "zod";
import { readSavedLessonMap } from "../../../library/lessons/lesson-map";
import {
  type Json,
  PRIVATE_CONTENT,
  type Resolution,
  changedFields,
  nonEmptyText,
  refuse,
} from "../_utils/resolved-change";
import { type ContentFixEffect } from "../contract";
import {
  type FieldChange,
  type PlanRoots,
  defineFixHandler,
  fieldChangeSchema,
  fieldTargets,
  idSchema,
  setFieldsSchema,
  toRevertedSet,
  toSetProposal,
} from "./fix-handler";

type TextModel = "Chapter" | "Course" | "Lesson";

const UNIT_KINDS = { Chapter: "chapter", Course: "course", Lesson: "lesson" } as const;

const TABLES = {
  Chapter: sql`library_chapters`,
  Course: sql`courses`,
  Lesson: sql`library_lessons`,
} as const;

const FIELDS = {
  Chapter: ["title", "description"],
  Course: ["title", "description"],
  Lesson: ["title", "description", "summary"],
} as const satisfies Record<TextModel, readonly string[]>;

const RULES = {
  Chapter: "Public chapters only. Its address keeps its slug.",
  Course: "Public courses only. Its address keeps its slug.",
  Lesson:
    "A published public lesson with no new version waiting. summary keeps its shape and its ideas in order; each idea may change only its label and text.",
} as const satisfies Record<TextModel, string>;

function summaryProblem({ after, before }: { after: unknown; before: unknown }): string | null {
  const current = readSavedLessonMap(before);
  const next = readSavedLessonMap(after);

  if (!current) {
    return "This lesson has no map to fix.";
  }

  if (!next) {
    return "summary must be a lesson map: { shape?, ideas: [{ text, label?, about?, iconId? }] }.";
  }

  if (next.ideas.length !== current.ideas.length || next.shape !== current.shape) {
    return `summary must keep its shape and its ${String(current.ideas.length)} ideas in order, since screens point at ideas by position.`;
  }

  const moved = current.ideas.findIndex((idea, index) => {
    const { label, text: _text, ...kept } = idea;
    const { label: nextLabel, text: _nextText, ...nextKept } = next.ideas[index] ?? idea;

    return (
      (label === undefined) !== (nextLabel === undefined) || !isDeepStrictEqual(kept, nextKept)
    );
  });

  return moved === -1
    ? null
    : `summary.ideas.${String(moved)} may change only its label and text; its icon, its "about" line and the rest stay.`;
}

/** A course may have no description, so reverting one added to it writes null again. */
function isClearable({ field, model }: { field: string; model: TextModel }): boolean {
  return model === "Course" && field === "description";
}

function fieldProblem({
  after,
  before,
  field,
  model,
}: {
  after: unknown;
  before: unknown;
  field: string;
  model: TextModel;
}): string | null {
  if (field === "summary") {
    return summaryProblem({ after, before });
  }

  if (after === null && isClearable({ field, model })) {
    return null;
  }

  return nonEmptyText(after) === null ? `${field} must be text that isn't blank.` : null;
}

function toValue({ after, field }: { after: Json; field: string }): Json {
  return field === "summary" || after === null ? after : nonEmptyText(after);
}

async function loadTextRow(db: TransactionClient, { id, model }: { id: string; model: TextModel }) {
  if (model === "Course") {
    const course = await db.course.findUnique({
      select: { description: true, title: true, userId: true, visibility: true },
      where: { id },
    });

    return (
      course && {
        isPrivate: course.visibility === "private" || course.userId !== null,
        row: course,
      }
    );
  }

  if (model === "Chapter") {
    const chapter = await db.chapter.findUnique({
      select: { description: true, ownerId: true, title: true, visibility: true },
      where: { id },
    });

    return (
      chapter && {
        isPrivate: chapter.visibility === "private" || chapter.ownerId !== null,
        row: chapter,
      }
    );
  }

  const lesson = await db.lesson.findUnique({
    select: { description: true, ownerId: true, summary: true, title: true, visibility: true },
    where: { id },
  });

  return (
    lesson && { isPrivate: lesson.visibility === "private" || lesson.ownerId !== null, row: lesson }
  );
}

function toEffects({
  fields,
  id,
  model,
}: {
  fields: readonly { field: string }[];
  id: string;
  model: TextModel;
}): ContentFixEffect[] {
  return [
    fields.some((change) => change.field === "title") && { id, kind: "slugKept" as const, model },
    fields.some((change) => change.field === "summary") && {
      kind: "marksKept" as const,
      lessonId: id,
    },
  ].filter((effect) => effect !== false);
}

type TextStored<Model extends TextModel> = {
  fields: FieldChange[];
  id: string;
  model: Model;
  op: "set";
};

async function resolveTextRow<Model extends TextModel>(
  db: TransactionClient,
  { id, model, set }: { id: string; model: Model; set: Record<string, Json> },
): Promise<Resolution<TextStored<Model>>> {
  const fixable: readonly string[] = FIELDS[model];
  const unknownField = Object.keys(set).find((field) => !fixable.includes(field));

  if (unknownField) {
    return refuse(
      `${model}.${unknownField} isn't fixable. A ${model} fix may set ${fixable.join(", ")}.`,
    );
  }

  const loaded = await loadTextRow(db, { id, model });

  if (!loaded) {
    return refuse(`No ${model} with id ${id}.`);
  }

  if (loaded.isPrivate) {
    return refuse(PRIVATE_CONTENT);
  }

  const row: Record<string, Json> = loaded.row;

  const problem = Object.entries(set)
    .map(([field, after]) => fieldProblem({ after, before: row[field], field, model }))
    .find((found) => found !== null);

  if (problem) {
    return refuse(problem);
  }

  const fields = changedFields(
    row,
    Object.entries(set).map(([field, after]) => [field, toValue({ after, field })] as const),
  );

  if (fields.length === 0) {
    return refuse(`${model} ${id} already has these values.`);
  }

  return {
    effects: toEffects({ fields, id, model }),
    ok: true,
    stored: { fields, id, model, op: "set" },
    unit: { id, kind: UNIT_KINDS[model] },
  };
}

function textData(fields: readonly { after: unknown; field: string }[]) {
  const values = new Map(fields.map((field) => [field.field, field.after]));
  const title = values.get("title");
  const description = values.get("description");
  const summary = values.get("summary");

  return {
    ...(typeof title === "string" ? { normalizedTitle: normalizeString(title), title } : {}),
    ...(typeof description === "string" ? { description } : {}),
    ...(isJsonObject(summary) ? { summary } : {}),
  };
}

function clearedDescription(fields: readonly { after: unknown; field: string }[]) {
  return fields.some(({ after, field }) => field === "description" && after === null)
    ? { description: null }
    : {};
}

async function applyText(
  tx: TransactionClient,
  { fields, id, model }: { fields: readonly FieldChange[]; id: string; model: TextModel },
): Promise<void> {
  const where = { id };

  if (model === "Course") {
    await tx.course.update({ data: { ...textData(fields), ...clearedDescription(fields) }, where });
    return;
  }

  if (model === "Chapter") {
    await tx.chapter.update({ data: textData(fields), where });
    return;
  }

  await tx.lesson.update({ data: textData(fields), where });
}

/** Plans read a chapter's or lesson's title, never its description or summary. */
function textPlanRoots({
  fields,
  id,
  model,
}: {
  fields: readonly FieldChange[];
  id: string;
  model: TextModel;
}): PlanRoots {
  const ids = fields.some(({ field }) => field === "title") ? [id] : [];

  if (model === "Chapter") {
    return { chapterIds: ids };
  }

  return model === "Lesson" ? { lessonIds: ids } : {};
}

function textRowHandler<Model extends TextModel>(model: Model) {
  return defineFixHandler({
    apply: (tx, stored) => applyText(tx, stored),
    model,
    op: "set",
    planRoots: (stored) => textPlanRoots(stored),
    proposal: {
      fields: FIELDS[model],
      rules: RULES[model],
      schema: z.strictObject({ id: idSchema, model: z.literal(model), set: setFieldsSchema }),
    },
    resolve: (db, proposed) => resolveTextRow(db, proposed),
    revert: (db, stored) => resolveTextRow(db, toRevertedSet(stored)),
    stored: z.object({
      fields: z.array(fieldChangeSchema).min(1),
      id: idSchema,
      model: z.literal(model),
      op: z.literal("set"),
    }),
    table: TABLES[model],
    targets: (stored) => fieldTargets(stored),
    toProposed: (stored) => toSetProposal(stored),
  });
}

export const courseSet = textRowHandler("Course");
export const chapterSet = textRowHandler("Chapter");
export const lessonSet = textRowHandler("Lesson");
