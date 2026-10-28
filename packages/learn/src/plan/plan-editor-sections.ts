export type PlanEditorSection = "choices" | "date" | "days" | "practice" | "time";

export function getEditorSectionId(section: PlanEditorSection): string {
  return `plan-editor-${section}`;
}

export function findSectionControl(section: PlanEditorSection): HTMLElement | null {
  return (
    document
      .querySelector(`#${getEditorSectionId(section)}`)
      ?.querySelector<HTMLElement>(
        "input:not([type=hidden]), button, select, textarea, [tabindex]:not([tabindex='-1'])",
      ) ?? null
  );
}
