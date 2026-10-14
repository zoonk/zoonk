/** A part of "Adjust your plan" that the Plan's settings open it at. */
export type PlanEditorSection = "choices" | "date" | "days" | "practice" | "time";

/** The id of an editor section's element: opened at it, the editor focuses its first control. */
export function getEditorSectionId(section: PlanEditorSection): string {
  return `plan-editor-${section}`;
}

/** The first control of a section, which the editor focuses (and so scrolls to) on opening. */
export function findSectionControl(section: PlanEditorSection): HTMLElement | null {
  return (
    document
      .querySelector(`#${getEditorSectionId(section)}`)
      ?.querySelector<HTMLElement>(
        "input:not([type=hidden]), button, select, textarea, [tabindex]:not([tabindex='-1'])",
      ) ?? null
  );
}
