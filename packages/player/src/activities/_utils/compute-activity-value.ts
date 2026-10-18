import {
  type ActivityStepContent,
  getActivityTemplate,
} from "@zoonk/core/library/activities/templates";

/**
 * A number core computes from the template's fields, the same way the validator and grading do:
 * a slider graph's output at some input, a chart span's change, a solver step's value. Renderers
 * show these instead of recomputing them, so the canvas can't disagree with the check.
 */
export function computeActivityValue(
  content: ActivityStepContent,
  target: { inputs?: Readonly<Record<string, number>>; output?: string | null } = {},
): number | null {
  return (
    getActivityTemplate(content.template)?.computeValue(content.fields, {
      inputs: target.inputs ?? {},
      output: target.output ?? null,
    }) ?? null
  );
}
