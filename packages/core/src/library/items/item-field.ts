import { type WorkField, isWorkField } from "@zoonk/ai/tasks/items/work-fields";
import { getString, isJsonObject } from "@zoonk/utils/json";

const FIELD_PURPOSES = new Set(["careerChange", "work"]);

export type GoalFieldInput = {
  purpose: "careerChange" | "work";
  role: string | null;
  targetRole: string | null;
  tasks: string | null;
};

function isFieldPurpose(value: unknown): value is GoalFieldInput["purpose"] {
  return typeof value === "string" && FIELD_PURPOSES.has(value);
}

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

export function getGoalField(details: unknown): WorkField | null {
  if (!isJsonObject(details) || !isFieldPurpose(details.purpose)) {
    return null;
  }

  return isWorkField(details.field) ? details.field : null;
}

type ItemAudience = {
  examBlueprintId?: string | null;
  field?: string | null;
  inSets?: boolean;
  keepIds?: readonly string[];
};

/** New picks skip a retired question, even a kept one, such as a mistake's original. */
export const IN_BANK = { retiredAt: null } as const;

/** For a question already asked, which stays answerable once retired from the bank. */
export function getAskedItemFilter({
  examBlueprintId = null,
  field = null,
  inSets = false,
  keepIds = [],
}: ItemAudience) {
  const kept = keepIds.length > 0 ? [{ id: { in: [...keepIds] } }] : [];

  return {
    AND: [
      { OR: [{ field: null }, ...(field ? [{ field }] : []), ...kept] },
      {
        OR: [{ examBlueprintId: null }, ...(examBlueprintId ? [{ examBlueprintId }] : []), ...kept],
      },
      ...(inSets ? [] : [{ OR: [{ setId: null }, ...kept] }]),
    ],
  };
}

export function getItemAudienceFilter(audience: ItemAudience) {
  return { AND: [...getAskedItemFilter(audience).AND, IN_BANK] };
}

export function getFieldRank({
  field,
  itemField,
}: {
  field: string | null;
  itemField: string | null;
}): number {
  return field !== null && itemField === field ? 0 : 1;
}

export function getPublicItemFilter() {
  const visible = { visibility: "public" as const };

  return {
    AND: [
      ...getPublicMaterialFilters(),
      { OR: [{ sourceId: null }, { source: { is: visible } }] },
      { skill: visible },
      { OR: [{ setId: null }, { set: { is: { AND: getPublicMaterialFilters() } } }] },
    ],
  };
}

export function getPublicMaterialFilters() {
  const visible = { visibility: "public" as const };

  return [
    { OR: [{ mediaAssetId: null }, { mediaAsset: { is: visible } }] },
    { OR: [{ examBlueprintId: null }, { examBlueprint: { is: visible } }] },
  ];
}
