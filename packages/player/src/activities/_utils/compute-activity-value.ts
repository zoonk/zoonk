import {
  type ActivityStepContent,
  getActivityTemplate,
} from "@zoonk/core/library/activities/templates";

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
