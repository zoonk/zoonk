import { type ActivityExplanationSchema } from "@zoonk/ai/tasks/activities/core/explanation";
import { type ActivitySteps } from "./get-activity-steps";

export type ExplanationActivityPlanEntry =
  | {
      kind: "static";
      text: string;
      title: string;
    }
  | { kind: "visual" };

type ExplanationPlan = {
  entries: ExplanationActivityPlanEntry[];
  sourceSteps: ActivitySteps;
  visualSteps: ActivitySteps;
};

/**
 * Each explanation beat becomes one prose step followed by one visual slot.
 * Keeping that pairing in one helper makes the learner-facing order obvious
 * and prevents the save step from re-deriving layout rules later.
 */
function buildStepEntries(
  step: ActivityExplanationSchema["explanation"][number],
): ExplanationActivityPlanEntry[] {
  return [{ kind: "static", text: step.text, title: step.title }, { kind: "visual" }];
}

/**
 * The shared visual-description generator should only see explanation prose
 * steps. The closing anchor does not need a visual.
 */
function buildVisualSteps(content: ActivityExplanationSchema): ActivitySteps {
  return content.explanation.map((step) => ({
    text: step.text,
    title: step.title,
  }));
}

/**
 * Practice and quiz generation need the explanation prose plus the anchor, but
 * not the visual placeholders. This helper keeps that downstream source list
 * aligned with the explanation structure in one place.
 */
function buildSourceSteps(content: ActivityExplanationSchema): ActivitySteps {
  return [
    ...content.explanation.map((step) => ({
      text: step.text,
      title: step.title,
    })),
    {
      text: content.anchor.text,
      title: content.anchor.title,
    },
  ];
}

/**
 * Explanation activities now have one simple structure: narrative copy, one
 * visual per explanation beat, then the closing anchor. Building one canonical
 * ordered plan keeps the workflow, save step, and downstream content reuse
 * anchored to the same source of truth instead of re-deriving the sequence in
 * multiple places.
 */
export function buildExplanationActivityPlan(content: ActivityExplanationSchema): ExplanationPlan {
  const stepEntries = content.explanation.flatMap((step) => buildStepEntries(step));

  return {
    entries: [
      ...stepEntries,
      {
        kind: "static",
        text: content.anchor.text,
        title: content.anchor.title,
      },
    ],
    sourceSteps: buildSourceSteps(content),
    visualSteps: buildVisualSteps(content),
  };
}
