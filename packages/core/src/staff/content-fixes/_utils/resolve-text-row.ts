import { isDeepStrictEqual } from "node:util";
import { type TransactionClient } from "@zoonk/db";
import { readSavedLessonMap } from "../../../library/lessons/lesson-map";
import { type ContentFixEffect } from "../contract";
import { FIXABLE_MODELS } from "../fixable-models";
import {
  type Json,
  PRIVATE_CONTENT,
  type ResolvedChange,
  changedFields,
  nonEmptyText,
  refuse,
} from "./resolved-change";

type TextModel = "Chapter" | "Course" | "Lesson";

const UNIT_KINDS = { Chapter: "chapter", Course: "course", Lesson: "lesson" } as const;

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

function fieldProblem({
  after,
  before,
  field,
}: {
  after: unknown;
  before: unknown;
  field: string;
}): string | null {
  if (field === "summary") {
    return summaryProblem({ after, before });
  }

  return nonEmptyText(after) === null ? `${field} must be text that isn't blank.` : null;
}

function toValue({ after, field }: { after: Json; field: string }): Json {
  return field === "summary" ? after : nonEmptyText(after);
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

export async function resolveTextRow(
  db: TransactionClient,
  { id, model, set }: { id: string; model: TextModel; set: Record<string, Json> },
): Promise<ResolvedChange> {
  const fixable: readonly string[] = FIXABLE_MODELS[model].fields;
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
    .map(([field, after]) => fieldProblem({ after, before: row[field], field }))
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
