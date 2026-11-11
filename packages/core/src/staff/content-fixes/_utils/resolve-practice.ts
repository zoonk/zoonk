import { type TransactionClient } from "@zoonk/db";
import { CURRENT_STEPS } from "../../../library/lessons/lesson-versions";
import {
  type Json,
  NOT_CURRENT_SCREEN,
  PRIVATE_CONTENT,
  type ResolvedChange,
  nonEmptyText,
  refuse,
} from "./resolved-change";

export async function resolveExplanation(
  db: TransactionClient,
  { id, set }: { id: string; set: Record<string, Json> },
): Promise<ResolvedChange> {
  const fields = Object.keys(set);

  if (fields.length !== 1 || fields[0] !== "explanation") {
    return refuse("An AnswerExplanation fix sets only explanation.");
  }

  const after = nonEmptyText(set.explanation);

  if (after === null) {
    return refuse("explanation must be text that isn't blank.");
  }

  const row = await db.answerExplanation.findUnique({
    select: {
      explanation: true,
      item: { select: { retiredAt: true, skill: { select: { visibility: true } } } },
      itemId: true,
      step: {
        select: {
          lesson: { select: { visibility: true } },
          lessonId: true,
          retiredAt: true,
          staged: true,
        },
      },
    },
    where: { id },
  });

  if (!row) {
    return refuse(`No AnswerExplanation with id ${id}.`);
  }

  if (row.explanation === after) {
    return refuse(`AnswerExplanation ${id} already has this explanation.`);
  }

  const stored = {
    fields: [{ after, before: row.explanation, field: "explanation" }],
    id,
    model: "AnswerExplanation" as const,
    op: "set" as const,
  };

  if (row.step) {
    if (row.step.retiredAt || row.step.staged) {
      return refuse(NOT_CURRENT_SCREEN);
    }

    return row.step.lesson.visibility === "private"
      ? refuse(PRIVATE_CONTENT)
      : { effects: [], ok: true, stored, unit: { id: row.step.lessonId, kind: "lesson" } };
  }

  if (!row.item || !row.itemId || row.item.retiredAt) {
    return refuse(
      "Only an explanation of a current screen or of a question still in practice can be fixed.",
    );
  }

  return row.item.skill.visibility === "private"
    ? refuse(PRIVATE_CONTENT)
    : { effects: [], ok: true, stored, unit: { id: row.itemId, kind: "item" } };
}

/**
 * Only a question nothing else depends on: a current screen asking it would show it again, and a
 * set's questions share one passage.
 */
export async function resolveItemRetire(
  db: TransactionClient,
  id: string,
): Promise<ResolvedChange> {
  const item = await db.item.findUnique({
    select: {
      _count: { select: { steps: { where: CURRENT_STEPS } } },
      retiredAt: true,
      setId: true,
      skill: { select: { visibility: true } },
    },
    where: { id },
  });

  if (!item) {
    return refuse(`No Item with id ${id}.`);
  }

  if (item.skill.visibility === "private") {
    return refuse(PRIVATE_CONTENT);
  }

  if (item.retiredAt) {
    return refuse(`Item ${id} is already retired.`);
  }

  if (item.setId) {
    return refuse(
      "This question belongs to a set that shares one passage; retiring one alone is a later phase.",
    );
  }

  if (item._count.steps > 0) {
    return refuse("A current lesson screen asks this question; fix that screen instead.");
  }

  return {
    effects: [{ itemId: id, kind: "itemRetired" }],
    ok: true,
    stored: { id, model: "Item", op: "retire" },
    unit: { id, kind: "item" },
  };
}

/** Reverts a retired question: it goes back to new practice only while it's still retired. */
export async function resolveItemRestore(
  db: TransactionClient,
  id: string,
): Promise<ResolvedChange> {
  const item = await db.item.findUnique({
    select: { retiredAt: true, skill: { select: { visibility: true } } },
    where: { id },
  });

  if (!item) {
    return refuse(`No Item with id ${id}.`);
  }

  if (item.skill.visibility === "private") {
    return refuse(PRIVATE_CONTENT);
  }

  if (!item.retiredAt) {
    return refuse(`Item ${id} is already back in practice.`);
  }

  return {
    effects: [{ itemId: id, kind: "itemRestored" }],
    ok: true,
    stored: { id, model: "Item", op: "unretire", retiredAt: item.retiredAt.toISOString() },
    unit: { id, kind: "item" },
  };
}
