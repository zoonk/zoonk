import { type UnderstoodGoalView } from "@zoonk/core/view-models/onboarding/contract";
import { type OnboardingDraftEdit } from "@zoonk/core/view-models/onboarding/draft-edit-contract";
import { type EditableField, type UnderstoodRow } from "./use-understood-rows";

type GoalDraft = UnderstoodGoalView["draft"];

export function readEditValue({ draft, row }: { draft: GoalDraft; row: UnderstoodRow }): string {
  const field = row.editable;

  if (!field || field.key === "studyTime") {
    return row.editDefault ?? row.value;
  }

  if (field.key === "displayName") {
    return draft.displayName ?? "";
  }

  if (field.key === "targetDate") {
    return draft.targetDate ?? row.editDefault ?? "";
  }

  if (field.key === "targetRegion") {
    return draft.targetRegion ?? "";
  }

  if (field.key === "contentCountry") {
    return draft.contentCountry ?? "";
  }

  const value = draft.details?.[field.key];
  return typeof value === "string" ? value : "";
}

export function toDraftEdit({
  field,
  goal,
  value,
}: {
  field: EditableField;
  goal: number;
  value: string;
}): OnboardingDraftEdit {
  if (field.key === "studyTime") {
    return { field: "studyTime", value };
  }

  if (field.key === "targetRegion") {
    return { field: "targetRegion", goal, value: value || null };
  }

  if (field.key === "contentCountry") {
    return { field: "contentCountry", goal, value };
  }

  return { field: field.key, goal, value };
}
