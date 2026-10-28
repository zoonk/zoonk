import { type WorkField, isWorkField } from "@zoonk/ai/tasks/v2/items/work-fields";
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

export function getItemAudienceFilter({
  examBlueprintId = null,
  field = null,
  inSets = false,
  keepIds = [],
}: {
  examBlueprintId?: string | null;
  field?: string | null;
  inSets?: boolean;
  keepIds?: readonly string[];
}) {
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
