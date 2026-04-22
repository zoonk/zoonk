import { type ActivityExplanationSchema } from "@zoonk/ai/tasks/activities/core/explanation";
import { type ActivitySteps } from "./get-activity-steps";

/**
 * Downstream activities reuse explanation copy, and the player now renders the
 * generated illustration inside the same readable step. Building one ordered
 * step list here keeps generation, image prompting, saving, and reuse aligned
 * on a single explanation structure.
 */
export function buildExplanationActivitySteps(content: ActivityExplanationSchema): ActivitySteps {
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
