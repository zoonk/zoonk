import { type WorkField, isWorkField } from "@zoonk/ai/tasks/v2/items/work-fields";
import { getString, isJsonObject } from "@zoonk/utils/json";

/** Purposes whose practice happens at the learner's job, or the job they're moving to. */
const FIELD_PURPOSES = new Set(["careerChange", "work"]);

/** What a goal's field is read from: the learner's answers on the role screen. */
export type GoalFieldInput = {
  purpose: "careerChange" | "work";
  role: string | null;
  targetRole: string | null;
  tasks: string | null;
};

function isFieldPurpose(value: unknown): value is GoalFieldInput["purpose"] {
  return typeof value === "string" && FIELD_PURPOSES.has(value);
}

/**
 * The role answers a work or career-change goal's field comes from, or null when the goal isn't
 * about a job or the learner skipped the role screen. A career change needs the role they want.
 */
export function getGoalFieldInput(details: unknown): GoalFieldInput | null {
  if (!isJsonObject(details) || !isFieldPurpose(details.purpose)) {
    return null;
  }

  const input = {
    purpose: details.purpose,
    role: getString(details, "role"),
    targetRole: getString(details, "targetPosition"),
    tasks: getString(details, "tasks"),
  };

  const hasJob =
    input.purpose === "careerChange"
      ? Boolean(input.targetRole)
      : Boolean(input.role ?? input.tasks);

  return hasJob ? input : null;
}

/**
 * The shareable field a goal's practice and chapter challenges are set in ("nursing"), once it's
 * been sorted from the learner's role. Null for other purposes, before it's known, and when the
 * role named no field.
 */
export function getGoalField(details: unknown): WorkField | null {
  if (!isJsonObject(details) || !isFieldPurpose(details.purpose)) {
    return null;
  }

  return isWorkField(details.field) ? details.field : null;
}

/**
 * The items a learner may get for a goal: general ones, and their goal's field's and exam's.
 * Another field's questions are practice for someone else's job and another exam's are set in
 * that exam ("on the first day of ENEM…"), so they never reach this learner, except the questions
 * in `keepIds` they already answered (a mistake's own question comes back in its drill).
 */
export function getItemAudienceFilter({
  examBlueprintId = null,
  field = null,
  keepIds = [],
}: {
  examBlueprintId?: string | null;
  field?: string | null;
  keepIds?: readonly string[];
}) {
  const kept = keepIds.length > 0 ? [{ id: { in: [...keepIds] } }] : [];

  return {
    AND: [
      { OR: [{ field: null }, ...(field ? [{ field }] : []), ...kept] },
      {
        OR: [{ examBlueprintId: null }, ...(examBlueprintId ? [{ examBlueprintId }] : []), ...kept],
      },
    ],
  };
}

/** The goal's field items come before general ones; 0 sorts first. */
export function getFieldRank({
  field,
  itemField,
}: {
  field: string | null;
  itemField: string | null;
}): number {
  return field !== null && itemField === field ? 0 : 1;
}
