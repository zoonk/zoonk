import { type TransactionClient, sql } from "@zoonk/db";
import { z } from "zod";
import { PRIVATE_CONTENT } from "../_utils/resolved-change";
import { idSchema } from "./fix-handler";
import { sharedRowHandler } from "./shared-row";

const MAX_SOURCE_PAGE = 32_767;

const text = z.string().trim().min(1);
const sourceFields = { publisher: text.nullable(), title: text, url: z.url().nullable() };

export const sourceSet = sharedRowHandler({
  fields: sourceFields,
  load: async (db, id) => {
    const row = await db.source.findUnique({
      select: { ownerId: true, publisher: true, title: true, url: true, visibility: true },
      where: { id },
    });

    return (
      row && {
        problem: row.ownerId || row.visibility !== "public" ? PRIVATE_CONTENT : undefined,
        row: { publisher: row.publisher, title: row.title, url: row.url },
        unit: { id, kind: "source" },
      }
    );
  },
  model: "Source",
  rules:
    "Public sources with no owner. Citation metadata only; identity, fetched text and hashes stay.",
  table: sql`sources`,
  write: (tx, id, values) =>
    tx.source.update({ data: z.object(sourceFields).partial().parse(values), where: { id } }),
});

export const sourceNoticeSet = sharedRowHandler({
  fields: { fields: z.array(text), message: text },
  load: async (db, id) => {
    const row = await db.sourceChangeNotice.findUnique({
      include: {
        examBlueprint: { select: { ownerId: true, visibility: true } },
        source: { select: { ownerId: true, visibility: true } },
      },
      where: { id },
    });

    return (
      row && {
        problem:
          row.source.ownerId ||
          row.source.visibility !== "public" ||
          row.examBlueprint?.ownerId ||
          (row.examBlueprint && row.examBlueprint.visibility !== "public")
            ? PRIVATE_CONTENT
            : undefined,
        row: { fields: row.fields, message: row.message },
        unit: { id: row.sourceId, kind: "source" },
      }
    );
  },
  model: "SourceChangeNotice",
  rules:
    "Public source and public blueprint with no owners. Edits the displayed notice; existing plan-change snapshots keep their copy.",
  table: sql`source_change_notices`,
  write: (tx, id, values) =>
    tx.sourceChangeNotice.update({
      data: z
        .object({ fields: z.array(text), message: text })
        .partial()
        .parse(values),
      where: { id },
    }),
});

export const stepCitationSet = sharedRowHandler({
  fields: { sourcePage: z.int().min(1).max(MAX_SOURCE_PAGE).nullable() },
  load: async (db, id) => {
    const row = await db.step.findUnique({
      include: {
        lesson: { select: { ownerId: true, visibility: true } },
        source: { select: { ownerId: true, visibility: true } },
      },
      where: { id },
    });

    return (
      row && {
        problem:
          (row.lesson.ownerId ||
          row.lesson.visibility !== "public" ||
          row.source?.ownerId ||
          (row.source && row.source.visibility !== "public")
            ? PRIVATE_CONTENT
            : undefined) ||
          (row.retiredAt || row.staged || !row.sourceId
            ? "A current screen with a source is required."
            : undefined),
        row: { sourcePage: row.sourcePage },
        unit: { id: row.lessonId, kind: "lesson" },
      }
    );
  },
  model: "Step",
  op: "setCitation",
  rules:
    "setCitation: { sourcePage }. Current public lesson screens with public sources only; content and source identity stay.",
  table: sql`library_steps`,
  write: (tx, id, values) =>
    tx.step.update({
      data: { sourcePage: z.int().nullable().parse(values.sourcePage) },
      where: { id },
    }),
});

const lessonCitations = z.array(z.object({ articles: z.array(text), sourceId: idSchema }));
const stepCitations = z.array(z.object({ contentHash: text.nullable(), sourceId: idSchema }));

async function publicCitations(db: TransactionClient, ids: string[]) {
  if (new Set(ids).size !== ids.length) {
    return "A source appears once.";
  }

  const found = await db.source.count({
    where: { id: { in: ids }, ownerId: null, visibility: "public" },
  });

  return found === ids.length ? null : "Every cited source must exist and be public with no owner.";
}

export const lessonSourcesSet = sharedRowHandler({
  fields: { citations: lessonCitations },
  load: async (db, id) => {
    const row = await db.lesson.findUnique({
      include: {
        sources: { orderBy: { sourceId: "asc" }, select: { articles: true, sourceId: true } },
      },
      where: { id },
    });

    return (
      row && {
        problem: row.ownerId || row.visibility !== "public" ? PRIVATE_CONTENT : undefined,
        row: { citations: row.sources },
        unit: { id, kind: "lesson" },
      }
    );
  },
  model: "LessonSource",
  rules:
    "id is the lesson id; set.citations is the full list of { sourceId, articles }. Public sources and published public lessons only.",
  table: sql`library_lessons`,
  validate: (_row, next, db) =>
    publicCitations(
      db,
      lessonCitations.parse(next.citations).map((row) => row.sourceId),
    ),
  write: async (tx, id, values) => {
    const citations = lessonCitations.parse(values.citations);
    await tx.lessonSource.deleteMany({ where: { lessonId: id } });
    await tx.lessonSource.createMany({ data: citations.map((row) => ({ ...row, lessonId: id })) });
  },
});

export const stepSourcesSet = sharedRowHandler({
  fields: { citations: stepCitations },
  load: async (db, id) => {
    const row = await db.step.findUnique({
      include: {
        lesson: { select: { ownerId: true, visibility: true } },
        sources: { orderBy: { sourceId: "asc" }, select: { contentHash: true, sourceId: true } },
      },
      where: { id },
    });

    return (
      row && {
        problem:
          (row.lesson.ownerId || row.lesson.visibility !== "public"
            ? PRIVATE_CONTENT
            : undefined) ||
          (row.retiredAt || row.staged ? "Only current screens can be fixed." : undefined),
        row: { citations: row.sources },
        unit: { id: row.lessonId, kind: "lesson" },
      }
    );
  },
  model: "StepSource",
  rules:
    "id is the step id; set.citations is the full list of { sourceId, contentHash }. Current public lesson screens and public sources only; existing hashes identify the edition cited.",
  table: sql`library_steps`,
  validate: (_row, next, db) =>
    publicCitations(
      db,
      stepCitations.parse(next.citations).map((row) => row.sourceId),
    ),
  write: async (tx, id, values) => {
    const citations = stepCitations.parse(values.citations);
    await tx.stepSource.deleteMany({ where: { stepId: id } });
    await tx.stepSource.createMany({ data: citations.map((row) => ({ ...row, stepId: id })) });
  },
});
